import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const validEnv = {
  DATABASE_URL: 'postgresql://ventidoc:ventidoc@localhost:5432/ventidoc',
  DATABASE_URL_TEST: 'postgresql://ventidoc:ventidoc@localhost:5432/ventidoc_test',
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
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_SECURE).toBe(false);
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
});
