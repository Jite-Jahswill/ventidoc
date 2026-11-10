CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"template" text NOT NULL,
	"recipient" text NOT NULL,
	"provider" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"message_id" text,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_logs_tenant_id_idx" ON "email_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_logs_status_idx" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_logs_created_at_idx" ON "email_logs" USING btree ("created_at");