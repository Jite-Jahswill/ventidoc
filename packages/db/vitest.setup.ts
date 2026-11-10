const databaseUrlTest = process.env.DATABASE_URL_TEST;
const migrationUrlTest = process.env.DATABASE_MIGRATION_URL_TEST;

if (!databaseUrlTest || !migrationUrlTest) {
  throw new Error(
    'DATABASE_URL_TEST and DATABASE_MIGRATION_URL_TEST are required to run packages/db tests',
  );
}

// Point the package's own DATABASE_URL/DATABASE_MIGRATION_URL at the test
// database so withTenant()/withSystem() (which read these directly) connect
// to ventidoc_test instead of the dev database.
process.env.DATABASE_URL = databaseUrlTest;
process.env.DATABASE_MIGRATION_URL = migrationUrlTest;
