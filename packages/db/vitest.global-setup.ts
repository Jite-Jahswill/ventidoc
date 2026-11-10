import { resetDatabase } from './src/reset';

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_MIGRATION_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_MIGRATION_URL_TEST is required to run packages/db tests');
  }
  await resetDatabase(url);
}
