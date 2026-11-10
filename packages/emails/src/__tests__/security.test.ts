import { describe, expect, it } from 'vitest';
import { assertValidSendOptions } from '../security';

const validOptions = {
  to: 'customer@example.test',
  from: 'Ventidoc <no-reply@ventidoc.local>',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('assertValidSendOptions', () => {
  it('accepts well-formed options, including "Name <email>" addresses', () => {
    expect(() => assertValidSendOptions(validOptions)).not.toThrow();
  });

  it('rejects a CRLF-injected subject', () => {
    expect(() =>
      assertValidSendOptions({ ...validOptions, subject: 'Hi\r\nBcc: attacker@evil.test' }),
    ).toThrow(/CR or LF/);
  });

  it('rejects a CRLF-injected recipient address', () => {
    expect(() =>
      assertValidSendOptions({ ...validOptions, to: 'a@example.test\r\nBcc: attacker@evil.test' }),
    ).toThrow();
  });

  it('rejects a CRLF-injected from address', () => {
    expect(() =>
      assertValidSendOptions({ ...validOptions, from: 'a@example.test\nBcc: attacker@evil.test' }),
    ).toThrow();
  });

  it('rejects a CRLF-injected replyTo address', () => {
    expect(() =>
      assertValidSendOptions({ ...validOptions, replyTo: 'a@example.test\r\nX-Injected: 1' }),
    ).toThrow();
  });

  it('rejects a CRLF-injected custom header value', () => {
    expect(() =>
      assertValidSendOptions({
        ...validOptions,
        headers: { 'X-Custom': 'value\r\nBcc: attacker@evil.test' },
      }),
    ).toThrow();
  });

  it('rejects a malformed email address', () => {
    expect(() => assertValidSendOptions({ ...validOptions, to: 'not-an-email' })).toThrow();
  });

  it('rejects an empty subject', () => {
    expect(() => assertValidSendOptions({ ...validOptions, subject: '' })).toThrow();
  });

  it('accepts a "Name <email>" formatted address', () => {
    const result = assertValidSendOptions({
      ...validOptions,
      to: 'Ada Lovelace <ada@example.test>',
    });
    expect(result.to).toBe('Ada Lovelace <ada@example.test>');
  });
});
