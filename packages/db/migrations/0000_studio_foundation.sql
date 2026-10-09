CREATE SCHEMA IF NOT EXISTS "studio";
--> statement-breakpoint
CREATE TABLE "studio"."agents" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"department_id" text NOT NULL,
	"role_key" text NOT NULL,
	"role_version" integer NOT NULL,
	"title" text NOT NULL,
	"name" text NOT NULL,
	"model" text NOT NULL,
	"tier" integer NOT NULL,
	"desk" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"task_id" text,
	"requested_by" text NOT NULL,
	"kind" text NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"recommendation" text,
	"cost_usd" double precision,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"founder_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "studio"."artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"task_id" text,
	"run_id" text,
	"produced_by" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"path" text,
	"sha256" text,
	"bytes" integer,
	"mime" text,
	"thumbnail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"scope" text NOT NULL,
	"period" text DEFAULT 'day' NOT NULL,
	"cap_usd" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."character_state" (
	"character_id" text PRIMARY KEY NOT NULL,
	"storyline" text DEFAULT '' NOT NULL,
	"gags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"episodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"canon_version" text DEFAULT 'bunni-bible-2026-10' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."characters" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"production_root" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"paused_reason" text,
	"daily_cap_usd" double precision DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."cost_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"department_id" text,
	"agent_id" text,
	"task_id" text,
	"run_id" text,
	"source" text NOT NULL,
	"description" text NOT NULL,
	"usd" double precision NOT NULL,
	"credits" double precision,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"task_id" text,
	"run_id" text,
	"chooser_id" text NOT NULL,
	"question" text NOT NULL,
	"chosen" text NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"confidence" real,
	"objections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."departments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"room" jsonb NOT NULL,
	"daily_cap_usd" double precision DEFAULT 2 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"agent_id" text,
	"department_id" text,
	"task_id" text,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"caption" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"task_id" text,
	"chair_agent_id" text NOT NULL,
	"participant_ids" jsonb NOT NULL,
	"question" text NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"outcome" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "studio"."memory_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text,
	"author_id" text NOT NULL,
	"source_decision_id" text,
	"source_artifact_id" text,
	"body" text NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"promoted_to_canon" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."messages" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"meeting_id" text,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio"."runs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"model" text NOT NULL,
	"effort" text NOT NULL,
	"request" jsonb,
	"response" jsonb,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_fingerprint" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"summary" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "studio"."tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"character_id" text,
	"parent_id" text,
	"owner_agent_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"input_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cap_usd" double precision NOT NULL,
	"spent_usd" double precision DEFAULT 0 NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"blocked_reason" text,
	"deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "studio"."agents" ADD CONSTRAINT "agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."agents" ADD CONSTRAINT "agents_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."agents" ADD CONSTRAINT "agents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "studio"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."approvals" ADD CONSTRAINT "approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."approvals" ADD CONSTRAINT "approvals_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."approvals" ADD CONSTRAINT "approvals_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."artifacts" ADD CONSTRAINT "artifacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."artifacts" ADD CONSTRAINT "artifacts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."artifacts" ADD CONSTRAINT "artifacts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."budgets" ADD CONSTRAINT "budgets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."character_state" ADD CONSTRAINT "character_state_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."characters" ADD CONSTRAINT "characters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."cost_ledger" ADD CONSTRAINT "cost_ledger_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."cost_ledger" ADD CONSTRAINT "cost_ledger_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."cost_ledger" ADD CONSTRAINT "cost_ledger_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "studio"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."cost_ledger" ADD CONSTRAINT "cost_ledger_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "studio"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."cost_ledger" ADD CONSTRAINT "cost_ledger_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."decisions" ADD CONSTRAINT "decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."decisions" ADD CONSTRAINT "decisions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."decisions" ADD CONSTRAINT "decisions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."meetings" ADD CONSTRAINT "meetings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."meetings" ADD CONSTRAINT "meetings_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."meetings" ADD CONSTRAINT "meetings_chair_agent_id_agents_id_fk" FOREIGN KEY ("chair_agent_id") REFERENCES "studio"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."memory_notes" ADD CONSTRAINT "memory_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."messages" ADD CONSTRAINT "messages_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."runs" ADD CONSTRAINT "runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "studio"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."runs" ADD CONSTRAINT "runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "studio"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "studio"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."tasks" ADD CONSTRAINT "tasks_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "studio"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio"."tasks" ADD CONSTRAINT "tasks_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "studio"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_department" ON "studio"."agents" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "agents_character" ON "studio"."agents" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_role_character" ON "studio"."agents" USING btree ("role_key","character_id");--> statement-breakpoint
CREATE INDEX "approvals_status_created" ON "studio"."approvals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "artifacts_task" ON "studio"."artifacts" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "artifacts_character_kind" ON "studio"."artifacts" USING btree ("character_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_scope_period" ON "studio"."budgets" USING btree ("company_id","scope","period");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_company_key" ON "studio"."characters" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "cost_day_company" ON "studio"."cost_ledger" USING btree ("company_id","day");--> statement-breakpoint
CREATE INDEX "cost_day_department" ON "studio"."cost_ledger" USING btree ("department_id","day");--> statement-breakpoint
CREATE INDEX "cost_task" ON "studio"."cost_ledger" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "decisions_task" ON "studio"."decisions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "decisions_character_created" ON "studio"."decisions" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_company_key" ON "studio"."departments" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "events_company_seq" ON "studio"."events" USING btree ("company_id","seq");--> statement-breakpoint
CREATE INDEX "events_agent_seq" ON "studio"."events" USING btree ("agent_id","seq");--> statement-breakpoint
CREATE INDEX "events_created" ON "studio"."events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "meetings_status" ON "studio"."meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notes_scope" ON "studio"."memory_notes" USING btree ("scope","scope_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_task" ON "studio"."messages" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "messages_to" ON "studio"."messages" USING btree ("to_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_task" ON "studio"."runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "runs_agent_started" ON "studio"."runs" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_owner_status" ON "studio"."tasks" USING btree ("owner_agent_id","status");--> statement-breakpoint
CREATE INDEX "tasks_parent" ON "studio"."tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "tasks_character_status" ON "studio"."tasks" USING btree ("character_id","status");--> statement-breakpoint
CREATE INDEX "tasks_status_updated" ON "studio"."tasks" USING btree ("status","updated_at");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "studio"."events";
  END IF;
END $$;
