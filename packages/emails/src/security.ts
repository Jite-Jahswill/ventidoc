import { z } from 'zod';

const CRLF_PATTERN = /[\r\n]/;

/** Rejects a string containing a bare CR or LF — the building block of SMTP header injection. */
const headerSafeString = z
  .string()
  .refine((value) => !CRLF_PATTERN.test(value), { message: 'must not contain CR or LF' });

/** "Name <email@example.com>" or a bare "email@example.com", with no CR/LF anywhere in it. */
const ADDRESS_PATTERN = /^(?:[^<>\r\n]*<)?([^<>\s]+@[^<>\s]+?)>?$/;

export const emailAddressSchema = headerSafeString.refine(
  (value) => {
    const match = ADDRESS_PATTERN.exec(value.trim());
    if (!match?.[1]) return false;
    return z.email().safeParse(match[1]).success;
  },
  { message: 'must be a valid email address, optionally as "Name <email@example.com>"' },
);

export const headerValueSchema = headerSafeString;

export const sendOptionsSchema = z.object({
  to: emailAddressSchema,
  from: emailAddressSchema,
  replyTo: emailAddressSchema.optional(),
  subject: headerSafeString.min(1, 'subject must not be empty'),
  html: z.string(),
  text: z.string(),
  headers: z.record(z.string().min(1), headerValueSchema).optional(),
  tags: z.record(z.string().min(1), z.string()).optional(),
});

export type ValidatedSendOptions = z.infer<typeof sendOptionsSchema>;

/**
 * Validates send options against `sendOptionsSchema`, throwing a single
 * readable error listing every problem found. Every `EmailProvider`
 * implementation calls this before touching the network, so header
 * injection and malformed addresses are rejected the same way regardless
 * of provider.
 */
export function assertValidSendOptions(options: unknown): ValidatedSendOptions {
  const result = sendOptionsSchema.safeParse(options);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid email send options:\n${issues}`);
  }
  return result.data;
}
