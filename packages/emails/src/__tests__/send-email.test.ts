import { emailLogs, generateId, tenants, users, withTenant } from '@ventidoc/db';
import { withSystem } from '@ventidoc/db/system';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryProvider } from '../providers/memory';
import { SmtpProvider } from '../providers/smtp';
import { sendEmail } from '../send-email';
import { EmailSendError, type EmailProvider, type SendOptions, type SendResult } from '../types';

async function createTenant(label: string): Promise<string> {
  const tenantId = generateId();
  const ownerUserId = generateId();
  // The full id, not a slice of it: UUIDv7's leading bytes are a millisecond
  // timestamp, coarse enough that two ids generated in separate test runs
  // within the same ~65s window can share an 8-character prefix, colliding
  // on the unique email index against a row a previous run never cleaned up
  // (this package has no resetting globalSetup of its own — see turbo.json).
  const suffix = tenantId;

  await withSystem(async (tx) => {
    await tx.insert(users).values({ id: ownerUserId, email: `${label}-${suffix}@example.test` });
  });
  await withTenant(tenantId, (tx) =>
    tx.insert(tenants).values({
      id: tenantId,
      name: `${label} tenant`,
      slug: `${label}-${suffix}`,
      ownerUserId,
    }),
  );
  return tenantId;
}

/** Throws a scripted sequence of outcomes, then (optionally) succeeds. Lets tests drive retries deterministically. */
class ScriptedProvider implements EmailProvider {
  readonly name = 'scripted';
  readonly calls: SendOptions[] = [];
  private readonly script: (EmailSendError | null)[];
  private index = 0;

  constructor(script: (EmailSendError | null)[]) {
    this.script = script;
  }

  async send(options: SendOptions): Promise<SendResult> {
    this.calls.push(options);
    const outcome = this.script[this.index] ?? this.script.at(-1) ?? null;
    this.index += 1;
    if (outcome) throw outcome;
    return { provider: this.name, messageId: `scripted-${this.index}` };
  }
}

async function readEmailLog(id: string, tenantId?: string) {
  const rows = tenantId
    ? await withTenant(tenantId, (tx) => tx.select().from(emailLogs).where(eq(emailLogs.id, id)))
    : await withSystem((tx) => tx.select().from(emailLogs).where(eq(emailLogs.id, id)));
  return rows[0];
}

describe('sendEmail', () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = await createTenant('send-email');
  });

  it('sends successfully for a tenant and logs a sent row', async () => {
    const provider = new MemoryProvider();
    const result = await sendEmail(
      {
        template: 'Welcome',
        props: { appUrl: 'https://ventidoc.local/app' },
        to: 'customer@example.test',
        tenantId,
      },
      { provider },
    );

    expect(result.ok).toBe(true);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      to: 'customer@example.test',
      subject: 'Welcome to Ventidoc',
    });

    const row = await readEmailLog(result.logId, tenantId);
    expect(row).toMatchObject({
      status: 'sent',
      attempts: 1,
      template: 'Welcome',
      recipient: 'customer@example.test',
      tenantId,
    });
    expect(row?.messageId).toBeTruthy();
  });

  it('sends successfully for a platform (no tenantId) email and logs a platform row', async () => {
    const provider = new MemoryProvider();
    const result = await sendEmail(
      {
        template: 'GenericNotification',
        props: { title: 'Platform notice', message: 'Scheduled maintenance tonight.' },
        to: 'admin@example.test',
      },
      { provider },
    );

    expect(result.ok).toBe(true);

    const row = await readEmailLog(result.logId);
    expect(row).toMatchObject({ status: 'sent', attempts: 1, tenantId: null });
  });

  it('returns ok:false and logs a failed row when the provider rejects with a non-transient error', async () => {
    const provider = new ScriptedProvider([
      new EmailSendError('mailbox does not exist', 'invalid-address'),
    ]);
    const result = await sendEmail(
      {
        template: 'Welcome',
        props: { appUrl: 'https://ventidoc.local/app' },
        to: 'bounces@example.test',
        tenantId,
      },
      { provider },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('mailbox does not exist');
    expect(provider.calls).toHaveLength(1); // not retried

    const row = await readEmailLog(result.logId, tenantId);
    expect(row).toMatchObject({ status: 'failed', attempts: 1 });
    expect(row?.errorSummary).toContain('mailbox does not exist');
  });

  it('retries a transient error up to 3 attempts, then succeeds', async () => {
    const provider = new ScriptedProvider([
      new EmailSendError('temporary SMTP failure', 'transient'),
      new EmailSendError('temporary SMTP failure', 'transient'),
      null,
    ]);
    const result = await sendEmail(
      {
        template: 'Welcome',
        props: { appUrl: 'https://ventidoc.local/app' },
        to: 'retry-success@example.test',
        tenantId,
      },
      { provider },
    );

    expect(result.ok).toBe(true);
    expect(provider.calls).toHaveLength(3);

    const row = await readEmailLog(result.logId, tenantId);
    expect(row).toMatchObject({ status: 'sent', attempts: 3 });
  });

  it('retries a transient error up to 3 attempts, then gives up and logs failed', async () => {
    const provider = new ScriptedProvider([
      new EmailSendError('still down', 'transient'),
      new EmailSendError('still down', 'transient'),
      new EmailSendError('still down', 'transient'),
    ]);
    const result = await sendEmail(
      {
        template: 'Welcome',
        props: { appUrl: 'https://ventidoc.local/app' },
        to: 'retry-exhausted@example.test',
        tenantId,
      },
      { provider },
    );

    expect(result.ok).toBe(false);
    expect(provider.calls).toHaveLength(3);

    const row = await readEmailLog(result.logId, tenantId);
    expect(row).toMatchObject({ status: 'failed', attempts: 3 });
  });

  it('never leaks the SMTP password into the logged error summary on a real connection failure', async () => {
    const secretPassword = 'super-secret-password-should-never-be-logged';
    // Nothing listens on this port, so nodemailer fails to connect at all —
    // exercising SmtpProvider's real error-mapping path end to end, not a
    // scripted stand-in.
    const provider = new SmtpProvider({
      host: 'localhost',
      port: 65_535,
      user: 'mailpit',
      pass: secretPassword,
    });

    const result = await sendEmail(
      {
        template: 'Welcome',
        props: { appUrl: 'https://ventidoc.local/app' },
        to: 'conn-fail@example.test',
        tenantId,
      },
      { provider },
    );

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain(secretPassword);

    const row = await readEmailLog(result.logId, tenantId);
    expect(row).toMatchObject({ status: 'failed' });
    expect(row?.errorSummary).toBeTruthy();
    expect(row?.errorSummary).not.toContain(secretPassword);
  });
});
