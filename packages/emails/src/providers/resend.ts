import { Resend } from 'resend';
import { assertValidSendOptions } from '../security';
import { EmailSendError, type EmailProvider, type SendOptions, type SendResult } from '../types';

/** https://resend.com/docs/api-reference/errors */
const TRANSIENT_ERROR_NAMES = new Set([
  'rate_limit_exceeded',
  'internal_server_error',
  'application_error',
  'concurrent_idempotent_requests',
]);
const INVALID_ADDRESS_ERROR_NAMES = new Set([
  'validation_error',
  'invalid_from_address',
  'missing_required_field',
]);

export class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(options: SendOptions): Promise<SendResult> {
    const validated = assertValidSendOptions(options);
    const result = await this.client.emails.send({
      to: validated.to,
      from: validated.from,
      replyTo: validated.replyTo,
      subject: validated.subject,
      html: validated.html,
      text: validated.text,
      headers: validated.headers,
      tags: validated.tags
        ? Object.entries(validated.tags).map(([name, value]) => ({ name, value }))
        : undefined,
    });

    if (result.error) {
      throw mapResendError(result.error);
    }
    if (!result.data) {
      throw new EmailSendError('Resend returned no data and no error', 'other');
    }
    return { provider: this.name, messageId: result.data.id };
  }
}

function mapResendError(error: { name: string; message: string }): EmailSendError {
  if (TRANSIENT_ERROR_NAMES.has(error.name)) {
    return new EmailSendError(error.message, 'transient', error);
  }
  if (INVALID_ADDRESS_ERROR_NAMES.has(error.name)) {
    return new EmailSendError(error.message, 'invalid-address', error);
  }
  return new EmailSendError(error.message, 'other', error);
}
