import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder } from './index';

describe('@ventidoc/auth', () => {
  it('exposes a placeholder until Stage 3 adds authentication', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });
});
