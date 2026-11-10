import { describe, expect, it } from 'vitest';
import { generateId } from '../id';
import { withTenant } from '../with-tenant';

describe('withTenant', () => {
  it('rejects an invalid tenant id', async () => {
    await expect(withTenant('not-a-uuid', async () => {})).rejects.toThrow(/UUID/);
    await expect(withTenant('', async () => {})).rejects.toThrow(/UUID/);
  });

  it('propagates an error thrown by the callback (rolls back instead of swallowing it)', async () => {
    const tenantId = generateId();

    await expect(
      withTenant(tenantId, async () => {
        throw new Error('callback boom');
      }),
    ).rejects.toThrow('callback boom');
  });
});
