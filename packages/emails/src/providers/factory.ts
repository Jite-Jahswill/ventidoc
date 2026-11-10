import { parseEnv } from '@ventidoc/config';
import type { EmailProvider } from '../types';
import { ResendProvider } from './resend';
import { SmtpProvider } from './smtp';

let platformProvider: EmailProvider | undefined;

function buildPlatformProvider(): EmailProvider {
  const env = parseEnv();
  if (env.EMAIL_PROVIDER === 'resend') {
    return new ResendProvider(env.RESEND_API_KEY);
  }
  return new SmtpProvider({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  });
}

/**
 * Returns the email provider to send through, chosen by `EMAIL_PROVIDER`
 * (default `smtp`).
 *
 * `tenantId` is accepted now so every call site already threads it through,
 * but every tenant currently shares the one platform provider built from
 * `EMAIL_PROVIDER`/`SMTP_*`/`RESEND_API_KEY`. Per-tenant SMTP settings (a
 * tenant bringing its own SMTP credentials) are explicitly out of scope for
 * this stage — when that lands, this is the one place that needs to change:
 * look up the tenant's own settings first and fall back to this platform
 * provider.
 */
export function resolveEmailProvider(tenantId?: string): EmailProvider {
  void tenantId;
  platformProvider ??= buildPlatformProvider();
  return platformProvider;
}

/** Test-only: clears the cached platform provider so the next call rebuilds it from the current env. */
export function resetEmailProviderCache(): void {
  platformProvider = undefined;
}
