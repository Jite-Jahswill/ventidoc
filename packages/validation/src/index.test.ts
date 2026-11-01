import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, placeholder, placeholderSchema } from './index';

describe('@ventidoc/validation', () => {
  it('exposes a placeholder until later stages add real schemas', () => {
    expect(placeholder()).toContain(PACKAGE_NAME);
  });

  it('validates with zod', () => {
    expect(placeholderSchema.parse({ message: 'ok' })).toEqual({ message: 'ok' });
    expect(() => placeholderSchema.parse({ message: '' })).toThrow();
  });
});
