import { uuidv7 } from 'uuidv7';

/** Generates a UUIDv7 primary key. IDs are always generated in the app, never by the database. */
export function generateId(): string {
  return uuidv7();
}
