import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateId } from '../id';
import { auditLogs, emailLogs } from '../schema';
import { withSystem } from '../with-system';
import { updatePlatformEmailLogStatus, withPlatform, withTenant } from '../with-tenant';
import { createTenantFixture, type TenantFixture } from './fixtures';

describe('platform rows (tenant_id IS NULL)', () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    tenantA = await createTenantFixture('platform-rows-a');
    tenantB = await createTenantFixture('platform-rows-b');
  });

  it('app role can insert a platform audit_logs row but can never select it back', async () => {
    const id = generateId();
    await withPlatform((tx) =>
      tx
        .insert(auditLogs)
        .values({ id, tenantId: null, action: 'platform.test', entityType: 'platform' }),
    );

    const seenByApp = await withPlatform((tx) =>
      tx.select().from(auditLogs).where(eq(auditLogs.id, id)),
    );
    expect(seenByApp).toHaveLength(0);

    const seenByTenantA = await withTenant(tenantA.tenantId, (tx) =>
      tx.select().from(auditLogs).where(eq(auditLogs.id, id)),
    );
    expect(seenByTenantA).toHaveLength(0);

    const seenBySystem = await withSystem((tx) =>
      tx.select().from(auditLogs).where(eq(auditLogs.id, id)),
    );
    expect(seenBySystem).toHaveLength(1);
  });

  it('app role can insert a platform email_logs row but can never select it back', async () => {
    const id = generateId();
    await withPlatform((tx) =>
      tx.insert(emailLogs).values({
        id,
        tenantId: null,
        template: 'GenericNotification',
        recipient: 'platform@example.test',
        provider: 'memory',
      }),
    );

    const seenByApp = await withPlatform((tx) =>
      tx.select().from(emailLogs).where(eq(emailLogs.id, id)),
    );
    expect(seenByApp).toHaveLength(0);

    const seenBySystem = await withSystem((tx) =>
      tx.select().from(emailLogs).where(eq(emailLogs.id, id)),
    );
    expect(seenBySystem).toHaveLength(1);
  });

  it('updatePlatformEmailLogStatus marks a platform row sent via the SECURITY DEFINER function', async () => {
    const id = generateId();
    await withPlatform((tx) =>
      tx.insert(emailLogs).values({
        id,
        tenantId: null,
        template: 'GenericNotification',
        recipient: 'platform-status@example.test',
        provider: 'memory',
      }),
    );

    const sentAt = new Date();
    await withPlatform((tx) =>
      updatePlatformEmailLogStatus(tx, {
        id,
        status: 'sent',
        attempts: 1,
        messageId: 'mem-123',
        errorSummary: null,
        sentAt,
      }),
    );

    const [row] = await withSystem((tx) => tx.select().from(emailLogs).where(eq(emailLogs.id, id)));
    expect(row).toMatchObject({ status: 'sent', attempts: 1, messageId: 'mem-123' });
    expect(row?.sentAt).toBeInstanceOf(Date);
  });

  it("tenant A cannot see tenant B's email_logs rows", async () => {
    const idA = generateId();
    const idB = generateId();

    await withTenant(tenantA.tenantId, (tx) =>
      tx.insert(emailLogs).values({
        id: idA,
        tenantId: tenantA.tenantId,
        template: 'Welcome',
        recipient: 'a@example.test',
        provider: 'memory',
      }),
    );
    await withTenant(tenantB.tenantId, (tx) =>
      tx.insert(emailLogs).values({
        id: idB,
        tenantId: tenantB.tenantId,
        template: 'Welcome',
        recipient: 'b@example.test',
        provider: 'memory',
      }),
    );

    const seenByA = await withTenant(tenantA.tenantId, (tx) =>
      tx.select().from(emailLogs).where(eq(emailLogs.id, idA)),
    );
    expect(seenByA).toHaveLength(1);

    const crossTenantRead = await withTenant(tenantA.tenantId, (tx) =>
      tx.select().from(emailLogs).where(eq(emailLogs.id, idB)),
    );
    expect(crossTenantRead).toHaveLength(0);
  });

  it('app role can update the allowed status columns on its own tenant email_logs row', async () => {
    const id = generateId();
    await withTenant(tenantA.tenantId, (tx) =>
      tx.insert(emailLogs).values({
        id,
        tenantId: tenantA.tenantId,
        template: 'Welcome',
        recipient: 'status-update@example.test',
        provider: 'memory',
      }),
    );

    await withTenant(tenantA.tenantId, (tx) =>
      tx.update(emailLogs).set({ status: 'sent', attempts: 1 }).where(eq(emailLogs.id, id)),
    );

    const [row] = await withTenant(tenantA.tenantId, (tx) =>
      tx.select().from(emailLogs).where(eq(emailLogs.id, id)),
    );
    expect(row).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('app role cannot update an email_logs column outside the allowed set', async () => {
    const id = generateId();
    await withTenant(tenantA.tenantId, (tx) =>
      tx.insert(emailLogs).values({
        id,
        tenantId: tenantA.tenantId,
        template: 'Welcome',
        recipient: 'column-check@example.test',
        provider: 'memory',
      }),
    );

    await expect(
      withTenant(tenantA.tenantId, (tx) =>
        tx.update(emailLogs).set({ template: 'hacked' }).where(eq(emailLogs.id, id)),
      ),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });
});
