CREATE TABLE "studio"."workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"step" text NOT NULL,
	"started_by" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"cap_usd" double precision NOT NULL,
	"spent_usd" double precision DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "studio"."approvals" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "studio"."artifacts" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "studio"."artifacts" ADD COLUMN "simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "studio"."decisions" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "studio"."events" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "studio"."runs" ADD COLUMN "adapter" text DEFAULT 'fake' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio"."tasks" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "studio"."tasks" ADD COLUMN "step" text;--> statement-breakpoint
ALTER TABLE "studio"."workflows" ADD CONSTRAINT "workflows_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."workflows" ADD CONSTRAINT "workflows_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflows_status" ON "studio"."workflows" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "workflows_character" ON "studio"."workflows" USING btree ("character_id","created_at");--> statement-breakpoint
ALTER TABLE "studio"."tasks" ADD CONSTRAINT "tasks_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "studio"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_workflow" ON "studio"."tasks" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_workflow_step_owner" ON "studio"."tasks" USING btree ("workflow_id","step","owner_agent_id");--> statement-breakpoint
GRANT USAGE ON SCHEMA "studio" TO authenticated;--> statement-breakpoint
GRANT SELECT ON "studio"."events" TO authenticated;--> statement-breakpoint
ALTER TABLE "studio"."events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "events_read_authenticated" ON "studio"."events" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
ALTER TABLE "studio"."events" REPLICA IDENTITY FULL;
