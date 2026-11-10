CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "shops_tenant_id_idx" ON "shops" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_members_user_id_idx" ON "tenant_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenants_owner_user_id_idx" ON "tenants" USING btree ("owner_user_id");