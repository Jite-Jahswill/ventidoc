import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { schema } from './schema';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

function assertLocal(connectionString: string): void {
  const { hostname } = new URL(connectionString);
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error(
      `db:reset refuses to run against a non-local host ("${hostname}"). This is a dev/test-only tool.`,
    );
  }
}

/**
 * Drops and recreates the public schema (and drizzle-kit's own migration
 * tracking schema), then re-applies every migration from scratch. Dev/test
 * only — refuses to run against anything that isn't localhost.
 */
export async function resetDatabase(migrationUrl: string): Promise<void> {
  assertLocal(migrationUrl);

  const client = postgres(migrationUrl, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(`
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO ventidoc_app;
    `);

    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

// No top-level `await` here: on some esbuild/Vite transform paths (notably
// Vitest's globalSetup loading under Node 24.x on Linux), a module with a
// top-level await gets rejected with "Top-level await is currently not
// supported with the 'cjs' output format" — which Vitest then mis-reports as
// "No test files found" instead of surfacing the real error. A `.then()`
// chain avoids the whole class of problem.
if (isMain) {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) {
    throw new Error('DATABASE_MIGRATION_URL is required to run db:reset');
  }
  resetDatabase(url)
    .then(() => {
      console.log(`Reset and migrated ${new URL(url).pathname.slice(1)}.`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
