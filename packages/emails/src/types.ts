export interface SendOptions {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface SendResult {
  provider: string;
  messageId: string;
}

/** Transient errors are retried by `sendEmail()`; anything else is not. */
export type EmailErrorKind = 'transient' | 'invalid-address' | 'other';

export class EmailSendError extends Error {
  readonly kind: EmailErrorKind;
  override readonly cause?: unknown;

  constructor(message: string, kind: EmailErrorKind, cause?: unknown) {
    super(message);
    this.name = 'EmailSendError';
    this.kind = kind;
    this.cause = cause;
  }
}

export interface EmailProvider {
  readonly name: string;
  send(options: SendOptions): Promise<SendResult>;
}
