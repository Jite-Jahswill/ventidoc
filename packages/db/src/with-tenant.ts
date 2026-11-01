import { sql, type ExtractTablesWithRelations } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { getAppDb } from './client';
import type { schema } from './schema';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Runs `fn` inside a transaction on the `ventidoc_app` connection with
 * `app.tenant_id` set for the current tenant.
 *
 * `set_config(..., true)` makes the setting transaction-local: it's reset
 * automatically when the transaction commits or rolls back, so it never
 * leaks onto the next transaction even when the pool reuses the same
 * physical connection. Row-Level Security policies read it via
 * `NULLIF(current_setting('app.tenant_id', true), '')::uuid`.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error(`withTenant() requires a UUID tenantId, got: ${tenantId}`);
  }

  const db = getAppDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
