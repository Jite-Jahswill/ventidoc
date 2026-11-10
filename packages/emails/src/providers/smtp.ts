import nodemailer, { type Transporter } from 'nodemailer';
import { assertValidSendOptions } from '../security';
import { EmailSendError, type EmailProvider, type SendOptions, type SendResult } from '../types';

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

/** Transient network-level failures nodemailer can surface before a response ever comes back. */
const TRANSIENT_CONNECTION_CODES = new Set([
  'ETIMEDOUT',
  'ECONNECTION',
  'ESOCKET',
  'EDNS',
  'ECONNREFUSED',
]);

export class SmtpProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(config: SmtpProviderConfig) {
    this.transporter = nodemailer.createTransport({
      pool: true,
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
  }

  async send(options: SendOptions): Promise<SendResult> {
    const validated = assertValidSendOptions(options);
    try {
      const info = await this.transporter.sendMail({
        to: validated.to,
        from: validated.from,
        replyTo: validated.replyTo,
        subject: validated.subject,
        html: validated.html,
        text: validated.text,
        headers: validated.headers,
      });
      return { provider: this.name, messageId: info.messageId ?? '' };
    } catch (error) {
      throw mapSmtpError(error);
    }
  }

  /** Closes the pooled connection. Call on shutdown (and in tests, between suites). */
  close(): void {
    this.transporter.close();
  }
}

function mapSmtpError(error: unknown): EmailSendError {
  const details = error as { code?: string; responseCode?: number; message?: string };
  const message = details.message ?? 'SMTP send failed';

  const isTransientConnection = !!details.code && TRANSIENT_CONNECTION_CODES.has(details.code);
  // A 4xx SMTP response is a temporary failure (rate limiting, greylisting,
  // a full mailbox); 5xx is permanent (e.g. the address doesn't exist).
  const isTransientResponse =
    !!details.responseCode && details.responseCode >= 400 && details.responseCode < 500;

  if (isTransientConnection || isTransientResponse) {
    return new EmailSendError(message, 'transient', error);
  }
  return new EmailSendError(message, 'other', error);
}
