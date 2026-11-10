import { z } from 'zod';

const booleanFromString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean());

const baseEnvSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url(),
  DATABASE_MIGRATION_URL: z.url(),
  DATABASE_MIGRATION_URL_TEST: z.url(),
  APP_URL: z.url(),
});

/** Mailpit needs no auth locally, so SMTP_USER/SMTP_PASS stay optional. */
const smtpEnvSchema = z.object({
  EMAIL_PROVIDER: z.literal('smtp'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: booleanFromString.optional().default(false),
  EMAIL_FROM: z.string().min(1),
});

const resendEnvSchema = z.object({
  EMAIL_PROVIDER: z.literal('resend'),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
});

const emailEnvSchema = z.discriminatedUnion('EMAIL_PROVIDER', [smtpEnvSchema, resendEnvSchema]);

const envSchema = z.intersection(baseEnvSchema, emailEnvSchema);

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const withDefaultProvider = { EMAIL_PROVIDER: 'smtp', ...source };
  const result = envSchema.safeParse(withDefaultProvider);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
