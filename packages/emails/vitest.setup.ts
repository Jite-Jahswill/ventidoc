const databaseUrlTest = process.env.DATABASE_URL_TEST;
const migrationUrlTest = process.env.DATABASE_MIGRATION_URL_TEST;

if (!databaseUrlTest || !migrationUrlTest) {
  throw new Error(
    'DATABASE_URL_TEST and DATABASE_MIGRATION_URL_TEST are required to run packages/emails tests',
  );
}

// @ventidoc/db's withTenant()/withSystem()/withPlatform() read DATABASE_URL/
// DATABASE_MIGRATION_URL directly (see packages/db/src/client.ts) — point
// them at the test database instead of dev, exactly like packages/db's own
// vitest.setup.ts. Each package's tests run in a separate process, so this
// has to be set here too; it doesn't carry over from packages/db's suite
// even though turbo.json runs that suite first (see its "dependsOn").
process.env.DATABASE_URL = databaseUrlTest;
process.env.DATABASE_MIGRATION_URL = migrationUrlTest;
