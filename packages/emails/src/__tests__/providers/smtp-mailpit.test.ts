import { afterAll, describe, expect, it } from 'vitest';
import { SmtpProvider } from '../../providers/smtp';

/**
 * Integration test against the real local Mailpit instance (see
 * docker-compose.yml / pnpm db:up) — no mocking. Verifies SmtpProvider
 * actually delivers over SMTP and that the message arrives with the right
 * subject, recipient, and both HTML and plain-text parts.
 */

interface MailpitMessageSummary {
  ID: string;
}

interface MailpitSearchResponse {
  messages: MailpitMessageSummary[];
}

interface MailpitMessageDetail {
  Subject: string;
  To: { Address: string }[];
  Text: string;
  HTML: string;
}

const MAILPIT_BASE_URL = 'http://localhost:8025';

async function findMailpitMessage(recipient: string): Promise<MailpitMessageDetail> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${MAILPIT_BASE_URL}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`,
    );
    const body = (await response.json()) as MailpitSearchResponse;
    if (body.messages.length > 0) {
      const detailResponse = await fetch(
        `${MAILPIT_BASE_URL}/api/v1/message/${body.messages[0]!.ID}`,
      );
      return (await detailResponse.json()) as MailpitMessageDetail;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No message arrived at Mailpit for ${recipient} within the deadline`);
}

describe('SmtpProvider -> Mailpit (integration)', () => {
  const provider = new SmtpProvider({ host: 'localhost', port: 1025, secure: false });

  afterAll(() => {
    provider.close();
  });

  it('delivers a real message over SMTP with the right subject, recipient, and both parts', async () => {
    const recipient = `smtp-integration-${Date.now()}@example.test`;

    const result = await provider.send({
      to: recipient,
      from: 'Ventidoc <no-reply@ventidoc.local>',
      subject: 'SmtpProvider integration test',
      html: '<p>Hello <strong>world</strong></p>',
      text: 'Hello world',
    });

    expect(result.provider).toBe('smtp');
    expect(result.messageId).toBeTruthy();

    const message = await findMailpitMessage(recipient);
    expect(message.Subject).toBe('SmtpProvider integration test');
    expect(message.To[0]?.Address).toBe(recipient);
    expect(message.HTML).toContain('Hello');
    expect(message.HTML).toContain('<strong>world</strong>');
    expect(message.Text).toContain('Hello world');
  });
});
