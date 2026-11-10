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

/**
 * Runs `fn` inside a transaction on the `ventidoc_app` connection with no
 * tenant context set at all — used only to insert platform-level rows
 * (`tenant_id IS NULL`), such as a platform `email_logs`/`audit_logs` row.
 * RLS's INSERT policies on those tables allow a NULL-`tenant_id` row
 * regardless of session context, but every SELECT/UPDATE/DELETE policy still
 * requires an exact tenant match — so this session can never read back what
 * it just wrote. Still runs as `ventidoc_app`; RLS is not bypassed. Only
 * `withSystem()` (a different role entirely) can read platform rows back.
 */
export async function withPlatform<T>(fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
  const db = getAppDb();
  return db.transaction(async (tx) => fn(tx));
}

export interface PlatformEmailLogStatusUpdate {
  id: string;
  status: string;
  attempts: number;
  messageId: string | null;
  errorSummary: string | null;
  sentAt: Date | null;
}

/**
 * Updates a platform (`tenant_id IS NULL`) `email_logs` row's delivery
 * status via the `update_platform_email_log_status` SECURITY DEFINER
 * function (migration 0004) — the narrow escape hatch that lets
 * `ventidoc_app` mark its own platform row as sent/failed without RLS
 * granting it broader read/write access to platform data. Call this inside
 * a `withPlatform()` (or `withTenant()`) transaction; a tenant-owned
 * `email_logs` row is updated with a normal `UPDATE` statement instead.
 */
export async function updatePlatformEmailLogStatus(
  tx: TenantTransaction,
  update: PlatformEmailLogStatusUpdate,
): Promise<void> {
  await tx.execute(
    sql`select update_platform_email_log_status(
      ${update.id}, ${update.status}, ${update.attempts}, ${update.messageId},
      ${update.errorSummary}, ${update.sentAt?.toISOString() ?? null}
    )`,
  );
}
