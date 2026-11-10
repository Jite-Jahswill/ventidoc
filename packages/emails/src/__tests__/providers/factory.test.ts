import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetEmailProviderCache, resolveEmailProvider } from '../../providers/factory';
import { ResendProvider } from '../../providers/resend';
import { SmtpProvider } from '../../providers/smtp';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://ventidoc_app:ventidoc_app@localhost:5433/ventidoc',
  DATABASE_URL_TEST: 'postgresql://ventidoc_app:ventidoc_app@localhost:5433/ventidoc_test',
  DATABASE_MIGRATION_URL: 'postgresql://ventidoc_owner:ventidoc_owner@localhost:5433/ventidoc',
  DATABASE_MIGRATION_URL_TEST:
    'postgresql://ventidoc_owner:ventidoc_owner@localhost:5433/ventidoc_test',
  APP_URL: 'http://localhost:3000',
};

describe('resolveEmailProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetEmailProviderCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEmailProviderCache();
  });

  it('resolves an SmtpProvider when EMAIL_PROVIDER=smtp (the default)', () => {
    process.env = {
      ...BASE_ENV,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      EMAIL_FROM: 'Ventidoc <no-reply@ventidoc.local>',
    };

    const provider = resolveEmailProvider();
    expect(provider).toBeInstanceOf(SmtpProvider);
  });

  it('resolves a ResendProvider when EMAIL_PROVIDER=resend', () => {
    process.env = {
      ...BASE_ENV,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: 'Ventidoc <no-reply@ventidoc.local>',
    };

    const provider = resolveEmailProvider();
    expect(provider).toBeInstanceOf(ResendProvider);
  });

  it('fails clearly when EMAIL_PROVIDER=smtp but SMTP_HOST is missing', () => {
    process.env = { ...BASE_ENV, EMAIL_PROVIDER: 'smtp', EMAIL_FROM: 'a@b.test' };
    expect(() => resolveEmailProvider()).toThrowError(/SMTP_HOST/);
  });

  it('fails clearly when EMAIL_PROVIDER=resend but RESEND_API_KEY is missing', () => {
    process.env = { ...BASE_ENV, EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'a@b.test' };
    expect(() => resolveEmailProvider()).toThrowError(/RESEND_API_KEY/);
  });

  it('caches the platform provider across calls until reset', () => {
    process.env = {
      ...BASE_ENV,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      EMAIL_FROM: 'Ventidoc <no-reply@ventidoc.local>',
    };

    const first = resolveEmailProvider();
    const second = resolveEmailProvider('some-tenant-id');
    expect(first).toBe(second);
  });
});
