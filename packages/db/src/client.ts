import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

let appDb: Database | undefined;
let ownerDb: Database | undefined;

function requireEnv(name: 'DATABASE_URL' | 'DATABASE_MIGRATION_URL'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to connect to the database`);
  }
  return value;
}

/**
 * The `ventidoc_app` connection: no DDL rights, not a table owner, cannot
 * bypass Row-Level Security. Every request-handling query must go through
 * `withTenant()`, which is the only thing that uses this pool.
 */
export function getAppDb(): Database {
  if (!appDb) {
    const client = postgres(requireEnv('DATABASE_URL'));
    appDb = drizzle(client, { schema });
  }
  return appDb;
}

/**
 * The `ventidoc_owner` connection: owns every table, bypasses Row-Level
 * Security. Only `withSystem()` (seeds/migrations/tests) uses this pool —
 * never request-handling code.
 */
export function getOwnerDb(): Database {
  if (!ownerDb) {
    const client = postgres(requireEnv('DATABASE_MIGRATION_URL'));
    ownerDb = drizzle(client, { schema });
  }
  return ownerDb;
}
