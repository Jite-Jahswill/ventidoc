import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const validEnv = {
  DATABASE_URL: 'postgresql://ventidoc_app:ventidoc_app@localhost:5433/ventidoc',
  DATABASE_URL_TEST: 'postgresql://ventidoc_app:ventidoc_app@localhost:5433/ventidoc_test',
  DATABASE_MIGRATION_URL: 'postgresql://ventidoc_owner:ventidoc_owner@localhost:5433/ventidoc',
  DATABASE_MIGRATION_URL_TEST:
    'postgresql://ventidoc_owner:ventidoc_owner@localhost:5433/ventidoc_test',
  APP_URL: 'http://localhost:3000',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  EMAIL_FROM: 'Ventidoc <no-reply@ventidoc.local>',
};

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    const env = parseEnv(validEnv);
    expect(env.EMAIL_PROVIDER).toBe('smtp');
    if (env.EMAIL_PROVIDER === 'smtp') {
      expect(env.SMTP_PORT).toBe(1025);
      expect(env.SMTP_SECURE).toBe(false);
    }
  });

  it('fails fast with a clear message when a required variable is missing', () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrowError(/DATABASE_URL/);
  });

  it('requires SMTP_HOST when EMAIL_PROVIDER is smtp', () => {
    const { SMTP_HOST: _SMTP_HOST, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrowError(/SMTP_HOST/);
  });

  it('requires RESEND_API_KEY when EMAIL_PROVIDER is resend', () => {
    expect(() =>
      parseEnv({ ...validEnv, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: undefined }),
    ).toThrowError(/RESEND_API_KEY/);
  });

  it('requires SMTP_PORT when EMAIL_PROVIDER is smtp', () => {
    const { SMTP_PORT: _SMTP_PORT, ...rest } = validEnv as Record<string, string | undefined>;
    expect(() => parseEnv(rest)).toThrowError(/SMTP_PORT/);
  });

  it('requires EMAIL_FROM regardless of provider', () => {
    const { EMAIL_FROM: _EMAIL_FROM, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrowError(/EMAIL_FROM/);
  });

  it('parses a valid resend environment without any SMTP_* variables', () => {
    const env = parseEnv({
      DATABASE_URL: validEnv.DATABASE_URL,
      DATABASE_URL_TEST: validEnv.DATABASE_URL_TEST,
      DATABASE_MIGRATION_URL: validEnv.DATABASE_MIGRATION_URL,
      DATABASE_MIGRATION_URL_TEST: validEnv.DATABASE_MIGRATION_URL_TEST,
      APP_URL: validEnv.APP_URL,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: validEnv.EMAIL_FROM,
    });
    expect(env.EMAIL_PROVIDER).toBe('resend');
    if (env.EMAIL_PROVIDER === 'resend') {
      expect(env.RESEND_API_KEY).toBe('re_test_key');
    }
  });

  it('defaults EMAIL_PROVIDER to smtp when unset', () => {
    const { EMAIL_PROVIDER: _EMAIL_PROVIDER, ...rest } = validEnv;
    const env = parseEnv(rest);
    expect(env.EMAIL_PROVIDER).toBe('smtp');
  });
});
