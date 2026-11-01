import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder } from './index';

describe('@ventidoc/core', () => {
  it('exposes a placeholder until later stages add business logic services', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });
});
