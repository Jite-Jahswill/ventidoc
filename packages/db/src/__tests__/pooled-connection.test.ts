import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Exercises the exact mechanism withTenant()/withSystem() rely on —
 * `set_config('app.tenant_id', value, true)` inside a transaction — through
 * a dedicated single-connection pool (`max: 1`), so the "same physical
 * connection" claim is deterministic regardless of what the rest of the
 * suite does to the shared pool.
 */
describe('app.tenant_id does not leak across a reused pooled connection', () => {
  const sql = postgres(process.env.DATABASE_URL_TEST!, { max: 1 });

  afterAll(async () => {
    await sql.end();
  });

  it('resets to unset between transactions on the same connection', async () => {
    const tenantA = '11111111-1111-7111-8111-111111111111';
    const tenantB = '22222222-2222-7222-8222-222222222222';

    // Postgres custom GUCs read as NULL via current_setting(name, true) only
    // until they've been touched in the session; after a transaction-local
    // set_config(..., true) reverts, they read back as '' (empty string),
    // not NULL again. That's exactly why the RLS policies normalise with
    // NULLIF(current_setting(...), '') — both mean "no tenant context".
    const isUnset = (value: unknown) => value === null || value === '';

    const before = await sql.begin(async (tx) => {
      return tx`select current_setting('app.tenant_id', true) as setting, pg_backend_pid() as pid`;
    });
    expect(isUnset(before[0]?.setting)).toBe(true);

    const afterA = await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenantA}, true)`;
      return tx`select current_setting('app.tenant_id', true) as setting, pg_backend_pid() as pid`;
    });
    expect(afterA[0]?.setting).toBe(tenantA);

    const betweenAandB = await sql.begin(async (tx) => {
      return tx`select current_setting('app.tenant_id', true) as setting, pg_backend_pid() as pid`;
    });
    expect(isUnset(betweenAandB[0]?.setting)).toBe(true);

    const afterB = await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenantB}, true)`;
      return tx`select current_setting('app.tenant_id', true) as setting, pg_backend_pid() as pid`;
    });
    expect(afterB[0]?.setting).toBe(tenantB);

    const afterNoContext = await sql.begin(async (tx) => {
      return tx`select current_setting('app.tenant_id', true) as setting, pg_backend_pid() as pid`;
    });
    expect(isUnset(afterNoContext[0]?.setting)).toBe(true);

    // Prove every one of those transactions really did run on the same
    // backend connection, so the resets above are a leak test and not
    // just five independent, never-set sessions.
    const pids = [before, afterA, betweenAandB, afterB, afterNoContext].map((r) => r[0]?.pid);
    expect(new Set(pids).size).toBe(1);
  });
});
