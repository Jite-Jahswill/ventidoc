-- email_logs: Row-Level Security split into three policies (not one FOR ALL
-- as Stage 1 used) because INSERT must allow platform rows (tenant_id IS
-- NULL) while SELECT/UPDATE must never return them to a tenant-scoped (or
-- no-context) session — only withSystem() (BYPASSRLS) can read platform
-- rows. See packages/db/src/with-tenant.ts's withPlatform().
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select" ON "email_logs"
	FOR SELECT
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY "email_logs_insert" ON "email_logs"
	FOR INSERT
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR "tenant_id" IS NULL
	);

CREATE POLICY "email_logs_update" ON "email_logs"
	FOR UPDATE
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

-- Table-level grants: SELECT + INSERT for everyone (RLS narrows what SELECT
-- actually returns), but UPDATE only on the columns sendEmail() ever needs
-- to change after the row exists — template/recipient/provider/tenant_id/
-- created_at are immutable from the app role's side once inserted.
GRANT SELECT, INSERT ON TABLE "email_logs" TO ventidoc_app;
GRANT UPDATE (status, attempts, message_id, error_summary, sent_at) ON TABLE "email_logs" TO ventidoc_app;
--> statement-breakpoint

-- Platform rows (tenant_id IS NULL) are, by the policies above, insertable
-- but never selectable/updatable by ventidoc_app — including the row it
-- just inserted. A narrowly-scoped SECURITY DEFINER function is the chosen
-- escape hatch for marking a platform email's delivery status afterwards:
-- chosen over routing the update through withSystem() (which has
-- unrestricted read/write access to every table) because this function can
-- only ever touch these five columns, on platform rows, by id — see
-- docs/PROGRESS.md's Stage 2 entry for the full reasoning.
CREATE FUNCTION update_platform_email_log_status(
	p_id uuid,
	p_status text,
	p_attempts integer,
	p_message_id text,
	p_error_summary text,
	p_sent_at timestamptz
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
	UPDATE email_logs
	SET status = p_status,
		attempts = p_attempts,
		message_id = p_message_id,
		error_summary = p_error_summary,
		sent_at = p_sent_at
	WHERE id = p_id AND tenant_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION update_platform_email_log_status TO ventidoc_app;
--> statement-breakpoint

-- Fix a Stage 1 gap: the single FOR ALL audit_logs_isolation policy required
-- tenant_id to match the session's tenant even for INSERT, so a platform
-- event (tenant_id IS NULL) could never actually be inserted by the app
-- role. Split into the same "insert platform rows, never read them" shape
-- as email_logs above.
DROP POLICY "audit_logs_isolation" ON "audit_logs";

CREATE POLICY "audit_logs_select" ON "audit_logs"
	FOR SELECT
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY "audit_logs_insert" ON "audit_logs"
	FOR INSERT
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR "tenant_id" IS NULL
	);
