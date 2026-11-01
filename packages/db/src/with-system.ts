import { getOwnerDb } from './client';
import type { TenantTransaction } from './with-tenant';

/**
 * Runs `fn` inside a transaction on the `ventidoc_owner` connection — the
 * table-owning role, which bypasses Row-Level Security entirely.
 *
 * For seeds, migrations and tests ONLY. Never import this in apps/web or any
 * request-handling code: it sees and can write every tenant's data with no
 * isolation at all.
 */
export async function withSystem<T>(fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
  const db = getOwnerDb();
  return db.transaction(async (tx) => fn(tx));
}
