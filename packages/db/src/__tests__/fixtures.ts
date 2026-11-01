import { generateId } from '../id';
import { auditLogs, shops, tenantMembers, tenants, users } from '../schema';
import { withSystem } from '../with-system';
import { withTenant } from '../with-tenant';

export interface TenantFixture {
  tenantId: string;
  shopId: string;
  userId: string;
  auditLogId: string;
}

/** Creates one tenant with one shop, one member and one audit log entry, via the public API. */
export async function createTenantFixture(label: string): Promise<TenantFixture> {
  const tenantId = generateId();
  const userId = generateId();
  const shopId = generateId();
  const auditLogId = generateId();
  const suffix = tenantId.slice(0, 8);

  await withSystem(async (tx) => {
    await tx.insert(users).values({ id: userId, email: `${label}-${suffix}@example.test` });
  });

  await withTenant(tenantId, async (tx) => {
    await tx.insert(tenants).values({
      id: tenantId,
      name: `${label} tenant`,
      slug: `${label}-${suffix}`,
      ownerUserId: userId,
    });
    await tx.insert(shops).values({ id: shopId, tenantId, name: `${label} shop` });
    await tx.insert(tenantMembers).values({ tenantId, userId });
    await tx.insert(auditLogs).values({
      id: auditLogId,
      tenantId,
      actorUserId: userId,
      action: 'fixture.create',
      entityType: 'tenant',
      entityId: tenantId,
    });
  });

  return { tenantId, shopId, userId, auditLogId };
}
