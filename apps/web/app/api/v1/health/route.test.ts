import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/v1/health', () => {
  it('returns ok status and a version string', async () => {
    const response = GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
  });
});
