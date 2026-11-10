import {
  emailLogs,
  generateId,
  updatePlatformEmailLogStatus,
  withPlatform,
  withTenant,
} from '@ventidoc/db';
import { eq } from 'drizzle-orm';
import { resolveEmailProvider } from './providers/factory';
import { renderTemplate } from './render';
import type { TemplateName, TemplateRegistry } from './templates';
import { EmailSendError, type EmailProvider } from './types';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function backoffDelayMs(attempt: number): number {
  return BASE_DELAY_MS * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toEmailSendError(error: unknown): EmailSendError {
  if (error instanceof EmailSendError) return error;
  return new EmailSendError(error instanceof Error ? error.message : String(error), 'other', error);
}

/** Never includes the full email body, an address book, or any secret — just a short summary. */
function summarizeError(error: unknown): string {
  if (error instanceof EmailSendError) {
    return `${error.kind}: ${error.message}`.slice(0, 500);
  }
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

const DEFAULT_FROM = 'Ventidoc <no-reply@ventidoc.local>';

export interface SendEmailInput<Name extends TemplateName> {
  template: Name;
  props: TemplateRegistry[Name];
  to: string;
  tenantId?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface SendEmailResult {
  ok: boolean;
  logId: string;
  error?: string;
}

export interface SendEmailOptions {
  /** Test/advanced seam — overrides resolveEmailProvider(tenantId). */
  provider?: EmailProvider;
}

interface LogFinalization {
  status: 'sent' | 'failed';
  attempts: number;
  messageId: string | null;
  errorSummary: string | null;
  sentAt: Date | null;
}

async function insertQueuedLog<Name extends TemplateName>(
  id: string,
  input: SendEmailInput<Name>,
  provider: string,
): Promise<void> {
  const row = {
    id,
    tenantId: input.tenantId ?? null,
    template: input.template,
    recipient: input.to,
    provider,
    status: 'queued',
    attempts: 0,
  };
  if (input.tenantId) {
    await withTenant(input.tenantId, (tx) => tx.insert(emailLogs).values(row));
  } else {
    await withPlatform((tx) => tx.insert(emailLogs).values(row));
  }
}

async function finalizeLog(
  id: string,
  tenantId: string | undefined,
  update: LogFinalization,
): Promise<void> {
  if (tenantId) {
    await withTenant(tenantId, (tx) =>
      tx
        .update(emailLogs)
        .set({
          status: update.status,
          attempts: update.attempts,
          messageId: update.messageId,
          errorSummary: update.errorSummary,
          sentAt: update.sentAt,
        })
        .where(eq(emailLogs.id, id)),
    );
  } else {
    await withPlatform((tx) => updatePlatformEmailLogStatus(tx, { id, ...update }));
  }
}

/**
 * Renders `template`, sends it through the resolved (or overridden) email
 * provider, and logs every attempt to `email_logs`. Never throws — delivery
 * failures come back as `{ ok: false, error }`, with the log row already
 * recording what happened.
 *
 * Retries up to 3 attempts with exponential backoff, but only for
 * `EmailSendError`s of kind `'transient'` (connection/timeout failures, a
 * 4xx SMTP response, Resend's rate-limit/5xx-equivalent errors). An invalid
 * address or any other error fails immediately without retrying.
 */
export async function sendEmail<Name extends TemplateName>(
  input: SendEmailInput<Name>,
  options: SendEmailOptions = {},
): Promise<SendEmailResult> {
  const logId = generateId();
  let logInserted = false;

  try {
    const provider = options.provider ?? resolveEmailProvider(input.tenantId);
    const from = input.from ?? DEFAULT_FROM;

    await insertQueuedLog(logId, input, provider.name);
    logInserted = true;

    const rendered = await renderTemplate(input.template, input.props);

    let lastErrorSummary = 'unknown error';
    for (let attempts = 1; attempts <= MAX_ATTEMPTS; attempts += 1) {
      try {
        const result = await provider.send({
          to: input.to,
          from,
          replyTo: input.replyTo,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          headers: input.headers,
          tags: input.tags,
        });

        await finalizeLog(logId, input.tenantId, {
          status: 'sent',
          attempts,
          messageId: result.messageId,
          errorSummary: null,
          sentAt: new Date(),
        });
        return { ok: true, logId };
      } catch (error) {
        const sendError = toEmailSendError(error);
        lastErrorSummary = summarizeError(sendError);

        if (sendError.kind !== 'transient' || attempts === MAX_ATTEMPTS) {
          await finalizeLog(logId, input.tenantId, {
            status: 'failed',
            attempts,
            messageId: null,
            errorSummary: lastErrorSummary,
            sentAt: null,
          });
          return { ok: false, logId, error: lastErrorSummary };
        }

        await sleep(backoffDelayMs(attempts));
      }
    }

    return { ok: false, logId, error: lastErrorSummary };
  } catch (error) {
    const errorSummary = summarizeError(error);
    if (logInserted) {
      await finalizeLog(logId, input.tenantId, {
        status: 'failed',
        attempts: 0,
        messageId: null,
        errorSummary,
        sentAt: null,
      }).catch(() => {
        // Best-effort: even if writing the failure itself fails, still
        // return ok:false below instead of throwing.
      });
    }
    return { ok: false, logId, error: errorSummary };
  }
}

/**
 * The one call site every email send goes through. Keeping it separate from
 * `sendEmail()` is the seam a durable job queue (BullMQ, pg-boss, ...)
 * replaces later: this function's body becomes "push a job, return a logId
 * immediately" instead of awaiting delivery in-process, with no change
 * needed at any call site — they already call `enqueueEmail()`, not
 * `sendEmail()` directly.
 */
export async function enqueueEmail<Name extends TemplateName>(
  input: SendEmailInput<Name>,
  options?: SendEmailOptions,
): Promise<SendEmailResult> {
  return sendEmail(input, options);
}
