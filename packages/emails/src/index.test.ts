import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder } from './index';

describe('@ventidoc/emails', () => {
  it('exposes a placeholder until Stage 2 adds the email service', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });
});
