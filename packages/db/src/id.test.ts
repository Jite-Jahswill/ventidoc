import { describe, expect, it } from 'vitest';
import { generateId } from './id';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateId', () => {
  it('generates a well-formed UUIDv7', () => {
    expect(generateId()).toMatch(UUID_V7_PATTERN);
  });

  it('never generates the same id twice', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });

  it('is monotonically increasing when generated in sequence', () => {
    const ids = Array.from({ length: 100 }, () => generateId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});
