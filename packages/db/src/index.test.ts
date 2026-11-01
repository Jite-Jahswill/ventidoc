import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder } from './index';

describe('@ventidoc/db', () => {
  it('exposes a placeholder until Stage 1 adds the real schema', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });
});
