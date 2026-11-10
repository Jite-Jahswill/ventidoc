import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendProvider } from '../../providers/resend';

const SEND_OPTIONS = {
  to: 'customer@example.test',
  from: 'Ventidoc <no-reply@ventidoc.local>',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ResendProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends successfully and returns the Resend message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'resend-msg-123' }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendProvider('re_test_key');
    const result = await provider.send(SEND_OPTIONS);

    expect(result).toEqual({ provider: 'resend', messageId: 'resend-msg-123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/emails');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer re_test_key');
  });

  it('maps a rate_limit_exceeded error to a transient EmailSendError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(429, {
          name: 'rate_limit_exceeded',
          message: 'Too many requests',
          statusCode: 429,
        }),
      ),
    );

    const provider = new ResendProvider('re_test_key');
    await expect(provider.send(SEND_OPTIONS)).rejects.toMatchObject({
      name: 'EmailSendError',
      kind: 'transient',
    });
  });

  it('maps a validation_error to an invalid-address EmailSendError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          name: 'validation_error',
          message: 'Invalid `to` field',
          statusCode: 422,
        }),
      ),
    );

    const provider = new ResendProvider('re_test_key');
    await expect(provider.send(SEND_OPTIONS)).rejects.toMatchObject({
      name: 'EmailSendError',
      kind: 'invalid-address',
    });
  });

  it('maps an unrecognized error to kind "other"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(403, {
          name: 'invalid_access',
          message: 'Not allowed',
          statusCode: 403,
        }),
      ),
    );

    const provider = new ResendProvider('re_test_key');
    await expect(provider.send(SEND_OPTIONS)).rejects.toMatchObject({
      name: 'EmailSendError',
      kind: 'other',
    });
  });

  it('rejects CRLF injection before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendProvider('re_test_key');
    await expect(
      provider.send({ ...SEND_OPTIONS, subject: 'Hi\r\nBcc: attacker@evil.test' }),
    ).rejects.toThrow(/CR or LF/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
