import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryProvider } from '../../providers/memory';

describe('MemoryProvider', () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = new MemoryProvider();
  });

  it('stores every sent message and returns a unique message id', async () => {
    const first = await provider.send({
      to: 'a@example.test',
      from: 'Ventidoc <no-reply@ventidoc.local>',
      subject: 'Hello A',
      html: '<p>A</p>',
      text: 'A',
    });
    const second = await provider.send({
      to: 'b@example.test',
      from: 'Ventidoc <no-reply@ventidoc.local>',
      subject: 'Hello B',
      html: '<p>B</p>',
      text: 'B',
    });

    expect(first.provider).toBe('memory');
    expect(first.messageId).not.toBe(second.messageId);
    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0]).toMatchObject({ to: 'a@example.test', subject: 'Hello A' });
    expect(provider.sent[1]).toMatchObject({ to: 'b@example.test', subject: 'Hello B' });
  });

  it('validates options the same way every other provider does', async () => {
    await expect(
      provider.send({
        to: 'a@example.test',
        from: 'Ventidoc <no-reply@ventidoc.local>',
        subject: 'Hi\r\nBcc: attacker@evil.test',
        html: '<p>A</p>',
        text: 'A',
      }),
    ).rejects.toThrow(/CR or LF/);
    expect(provider.sent).toHaveLength(0);
  });

  it('clear() empties the sent list', async () => {
    await provider.send({
      to: 'a@example.test',
      from: 'Ventidoc <no-reply@ventidoc.local>',
      subject: 'Hello',
      html: '<p>A</p>',
      text: 'A',
    });
    provider.clear();
    expect(provider.sent).toHaveLength(0);
  });
});
