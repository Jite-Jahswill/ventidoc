-- Row-Level Security: one isolation policy per tenant-owned table.
--
-- `NULLIF(current_setting('app.tenant_id', true), '')::uuid` returns NULL
-- (never matches, so zero rows) when no tenant context has been set, instead
-- of raising "unrecognized configuration parameter". `withTenant()` sets
-- `app.tenant_id` transaction-locally via `set_config(..., true)` before
-- running a caller's queries — see packages/db/src/with-tenant.ts.
--
-- FORCE (not just ENABLE) ROW LEVEL SECURITY matters here because
-- `ventidoc_owner` owns every table: ENABLE alone exempts the table owner,
-- FORCE applies the policy to it too (it still doesn't apply to roles with
-- the BYPASSRLS attribute, which is exactly how `withSystem()` — seeds,
-- migrations, tests — intentionally sees every tenant's rows).
--
-- `tenants` has no `tenant_id` column — a tenant row's own `id` is what a
-- tenant-scoped session is allowed to see.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenants_isolation" ON "tenants"
	USING ("id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shops" FORCE ROW LEVEL SECURITY;

CREATE POLICY "shops_isolation" ON "shops"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "tenant_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_members" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_isolation" ON "tenant_members"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- audit_logs.tenant_id is nullable for platform-level events (Stage 5+); a
-- NULL tenant_id never equals the session's tenant_id under normal equality,
-- so platform events stay invisible to (and un-writable by) any
-- tenant-scoped session — only a BYPASSRLS role can touch them, same as
-- every other table here.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_isolation" ON "audit_logs"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- Table-level grants for the runtime app role. ventidoc_app is not the owner
-- of any table and is never granted CREATE on the schema, so it structurally
-- cannot ALTER TABLE or disable Row-Level Security. audit_logs is
-- append-only: INSERT and SELECT only, no UPDATE or DELETE.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users" TO ventidoc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenants" TO ventidoc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "shops" TO ventidoc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenant_members" TO ventidoc_app;
GRANT SELECT, INSERT ON TABLE "audit_logs" TO ventidoc_app;
