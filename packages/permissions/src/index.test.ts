import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder } from './index';

describe('@ventidoc/permissions', () => {
  it('exposes a placeholder until Stage 4 adds RBAC', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });
});
