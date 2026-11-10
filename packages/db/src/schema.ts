import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

/**
 * Global identity — one row per human, shared across every tenant they
 * belong to. No tenant_id, no RLS: access goes only through the auth layer
 * built in Stage 3.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(uuidv7),
  email: text('email').notNull().unique(),
  name: text('name'),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A business account. Tenant-scoped rows match on their own id. */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidv7),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('tenants_owner_user_id_idx').on(table.ownerUserId)],
);

/** A physical location owned by a tenant. */
export const shops = pgTable(
  'shops',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    address: text('address'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('shops_tenant_id_idx').on(table.tenantId)],
);

/** A user's membership in a tenant. */
export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tenant_members_tenant_id_user_id_key').on(table.tenantId, table.userId),
    index('tenant_members_user_id_idx').on(table.userId),
  ],
);

/**
 * Append-only audit trail. tenant_id is nullable for platform-level events
 * (Stage 5+); the app role only ever gets INSERT and SELECT on this table —
 * never UPDATE or DELETE.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidv7),
    tenantId: uuid('tenant_id').references(() => tenants.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_tenant_id_idx').on(table.tenantId),
    index('audit_logs_actor_user_id_idx').on(table.actorUserId),
  ],
);

export const schema = { users, tenants, shops, tenantMembers, auditLogs };
