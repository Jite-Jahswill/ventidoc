import { assertValidSendOptions } from '../security';
import type { EmailProvider, SendOptions, SendResult } from '../types';

export interface MemorySentMessage extends SendOptions {
  messageId: string;
}

/** Stores every sent message in memory. Tests only — never used at runtime. */
export class MemoryProvider implements EmailProvider {
  readonly name = 'memory';
  readonly sent: MemorySentMessage[] = [];
  private counter = 0;

  async send(options: SendOptions): Promise<SendResult> {
    const validated = assertValidSendOptions(options);
    this.counter += 1;
    const messageId = `memory-${this.counter}`;
    this.sent.push({ ...validated, messageId });
    return { provider: this.name, messageId };
  }

  clear(): void {
    this.sent.length = 0;
    this.counter = 0;
  }
}
