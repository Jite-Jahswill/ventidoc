import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getAppDb } from '../client';

/** Asserts the query rejects with Postgres SQLSTATE 42501 (insufficient_privilege). */
async function expectPermissionDenied(query: Promise<unknown>): Promise<void> {
  await expect(query).rejects.toMatchObject({ cause: { code: '42501' } });
}

describe('ventidoc_app role privileges', () => {
  it('cannot ALTER TABLE', async () => {
    await expectPermissionDenied(getAppDb().execute(sql`alter table shops add column hacked text`));
  });

  it('cannot DISABLE ROW LEVEL SECURITY', async () => {
    await expectPermissionDenied(
      getAppDb().execute(sql`alter table shops disable row level security`),
    );
  });

  it('cannot UPDATE audit_logs', async () => {
    await expectPermissionDenied(
      getAppDb().execute(sql`update audit_logs set action = 'tampered' where false`),
    );
  });

  it('cannot DELETE from audit_logs', async () => {
    await expectPermissionDenied(getAppDb().execute(sql`delete from audit_logs where false`));
  });

  it('can INSERT and SELECT on audit_logs (append-only, not locked out)', async () => {
    const result = await getAppDb().execute(
      sql`select has_table_privilege('ventidoc_app', 'audit_logs', 'select') as can_select,
                 has_table_privilege('ventidoc_app', 'audit_logs', 'insert') as can_insert`,
    );
    expect(result[0]).toMatchObject({ can_select: true, can_insert: true });
  });

  it('is not the owner of any table', async () => {
    const result = await getAppDb().execute(sql`
      select count(*)::int as count
      from pg_class c
      join pg_roles r on r.oid = c.relowner
      where r.rolname = 'ventidoc_app' and c.relkind = 'r'
    `);
    expect(result[0]).toMatchObject({ count: 0 });
  });
});
