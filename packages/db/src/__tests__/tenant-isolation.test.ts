import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAppDb } from '../client';
import { auditLogs, shops, tenantMembers, tenants } from '../schema';
import { withTenant } from '../with-tenant';
import { createTenantFixture, type TenantFixture } from './fixtures';

describe('tenant isolation', () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    tenantA = await createTenantFixture('tenant-a');
    tenantB = await createTenantFixture('tenant-b');
  });

  it('returns 0 rows when no tenant context is set', async () => {
    const rows = await getAppDb().select().from(shops).where(eq(shops.id, tenantA.shopId));
    expect(rows).toHaveLength(0);
  });

  it("sees only its own tenant, shops, members and audit logs under tenant A's context", async () => {
    await withTenant(tenantA.tenantId, async (tx) => {
      const seenTenants = await tx.select().from(tenants);
      expect(seenTenants).toHaveLength(1);
      expect(seenTenants[0]?.id).toBe(tenantA.tenantId);

      const seenShops = await tx.select().from(shops);
      expect(seenShops.map((s) => s.id)).toEqual([tenantA.shopId]);
      expect(seenShops.some((s) => s.id === tenantB.shopId)).toBe(false);

      const seenMembers = await tx.select().from(tenantMembers);
      expect(seenMembers).toHaveLength(1);
      expect(seenMembers[0]?.userId).toBe(tenantA.userId);

      const seenAuditLogs = await tx.select().from(auditLogs);
      expect(seenAuditLogs.map((a) => a.id)).toEqual([tenantA.auditLogId]);
      expect(seenAuditLogs.some((a) => a.id === tenantB.auditLogId)).toBe(false);
    });
  });

  it("rejects inserting a shop stamped with tenant B's id under tenant A's context", async () => {
    await expect(
      withTenant(tenantA.tenantId, async (tx) => {
        await tx.insert(shops).values({ tenantId: tenantB.tenantId, name: 'malicious shop' });
      }),
    ).rejects.toThrow();
  });

  it("affects 0 rows updating tenant B's shop under tenant A's context", async () => {
    const updated = await withTenant(tenantA.tenantId, (tx) =>
      tx.update(shops).set({ name: 'hacked' }).where(eq(shops.id, tenantB.shopId)).returning(),
    );
    expect(updated).toHaveLength(0);
  });

  it("affects 0 rows deleting tenant B's shop under tenant A's context", async () => {
    const deleted = await withTenant(tenantA.tenantId, (tx) =>
      tx.delete(shops).where(eq(shops.id, tenantB.shopId)).returning(),
    );
    expect(deleted).toHaveLength(0);

    // Prove it: tenant B can still see its own shop afterwards.
    const stillThere = await withTenant(tenantB.tenantId, (tx) =>
      tx.select().from(shops).where(eq(shops.id, tenantB.shopId)),
    );
    expect(stillThere).toHaveLength(1);
  });

  it('never leaks rows across 20+ concurrent withTenant calls for two tenants', async () => {
    const calls = Array.from({ length: 24 }, (_, i) => {
      const fixture = i % 2 === 0 ? tenantA : tenantB;
      return withTenant(fixture.tenantId, async (tx) => {
        const rows = await tx.select().from(shops);
        return { expectedShopId: fixture.shopId, rows };
      });
    });

    const results = await Promise.all(calls);

    for (const { expectedShopId, rows } of results) {
      expect(rows.map((r) => r.id)).toEqual([expectedShopId]);
    }
  });
});
