import { z } from 'zod';

const booleanFromString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean());

const envSchema = z
  .object({
    DATABASE_URL: z.url(),
    DATABASE_URL_TEST: z.url(),
    DATABASE_MIGRATION_URL: z.url(),
    DATABASE_MIGRATION_URL_TEST: z.url(),
    APP_URL: z.url(),
    EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: booleanFromString.optional(),
    EMAIL_FROM: z.string().min(1),
    RESEND_API_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_PROVIDER === 'smtp' && !value.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required when EMAIL_PROVIDER=smtp',
      });
    }
    if (value.EMAIL_PROVIDER === 'resend' && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
