import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder } from './index';

describe('@ventidoc/ui', () => {
  it('exposes a placeholder until shared components are added', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });
});
