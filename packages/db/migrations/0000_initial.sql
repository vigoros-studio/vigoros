CREATE TYPE "public"."asset_class" AS ENUM('EQUITY', 'ETF', 'FX', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."participant_kind" AS ENUM('HUMAN', 'AGENT', 'REFERENCE_MODEL', 'BASELINE');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('OPEN', 'PENDING', 'RESOLVED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('LEVEL', 'RELATIVE', 'QUINTILE');--> statement-breakpoint
CREATE TYPE "public"."venue" AS ENUM('US', 'UK', 'FX', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('PRIVATE', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"participant_id" char(26) NOT NULL,
	"key_hash" char(64) NOT NULL,
	"prefix" char(8) NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_keyHash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"venue" "venue" NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"name" text NOT NULL,
	"peer_group" text NOT NULL,
	"vendor_symbol" text NOT NULL,
	"active_from" integer NOT NULL,
	"active_to" integer,
	"last_price_day" date,
	"last_ingest_at" timestamp with time zone,
	"last_ingest_error" text
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"participant_id" char(26) NOT NULL,
	"question_id" char(26) NOT NULL,
	"issue_date" date NOT NULL,
	"p" real NOT NULL,
	"reasoning" text,
	"falsifier" text,
	"hash" char(64) NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"seal_root_id" char(26),
	"inclusion_proof" jsonb,
	"revealed_at" timestamp with time zone,
	CONSTRAINT "commitments_p_chk" CHECK ("commitments"."p" >= 0.01 and "commitments"."p" <= 0.99)
);
--> statement-breakpoint
CREATE TABLE "methodology_versions" (
	"version" text PRIMARY KEY NOT NULL,
	"effective_from" date NOT NULL,
	"announced_at" timestamp with time zone NOT NULL,
	"doc_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_daily" (
	"participant_id" char(26) NOT NULL,
	"issue_date" date NOT NULL,
	"methodology_version" text NOT NULL,
	"horizon" smallint NOT NULL,
	"question_type" "question_type" NOT NULL,
	"n" integer NOT NULL,
	"sum_brier" double precision NOT NULL,
	"sum_prior_brier" double precision NOT NULL,
	"sum_log" double precision NOT NULL,
	"sum_prior_log" double precision NOT NULL,
	"cal_counts" integer[] NOT NULL,
	"cal_sum_forecast" double precision[] NOT NULL,
	"cal_sum_outcome" double precision[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_daily_participant_id_issue_date_methodology_version_horizon_question_type_pk" PRIMARY KEY("participant_id","issue_date","methodology_version","horizon","question_type")
);
--> statement-breakpoint
CREATE TABLE "participant_stats" (
	"participant_id" char(26) NOT NULL,
	"methodology_version" text NOT NULL,
	"n" integer NOT NULL,
	"distinct_issue_dates" integer NOT NULL,
	"first_issue_date" date,
	"last_issue_date" date,
	"eligible" boolean NOT NULL,
	"bss" double precision,
	"bss_lower" double precision,
	"bss_upper" double precision,
	"evidence_nats" double precision,
	"ece" double precision,
	"reliability" double precision,
	"resolution" double precision,
	"uncertainty" double precision,
	"p_value" double precision,
	"identity_count" integer DEFAULT 1 NOT NULL,
	"adjusted_p_value" double precision,
	"coverage" double precision,
	"distinct_assets" integer,
	"bss_by_horizon" jsonb,
	"bss_by_type" jsonb,
	"rolling_series" jsonb,
	"calibration_bins" jsonb,
	"bootstrap_seed" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_stats_participant_id_methodology_version_pk" PRIMARY KEY("participant_id","methodology_version")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"publisher_id" char(26) NOT NULL,
	"kind" "participant_kind" NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"visibility" "visibility" DEFAULT 'PRIVATE' NOT NULL,
	"published_at" timestamp with time zone,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"asset_id" char(26) NOT NULL,
	"day" date NOT NULL,
	"close" double precision NOT NULL,
	"adj_close" double precision NOT NULL,
	"volume" double precision,
	"source" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_asset_id_day_pk" PRIMARY KEY("asset_id","day")
);
--> statement-breakpoint
CREATE TABLE "prior_tables" (
	"month" date PRIMARY KEY NOT NULL,
	"methodology_version" text NOT NULL,
	"table" jsonb NOT NULL,
	"as_of" date NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishers_authUserId_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "publishers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "question_sets" (
	"issue_date" date PRIMARY KEY NOT NULL,
	"seed" text NOT NULL,
	"methodology_version" text NOT NULL,
	"universe_version" integer NOT NULL,
	"question_count" integer NOT NULL,
	"prior_table" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"issue_date" date NOT NULL,
	"venue" "venue" NOT NULL,
	"asset_id" char(26) NOT NULL,
	"type" "question_type" NOT NULL,
	"horizon" smallint NOT NULL,
	"level_k" smallint,
	"threshold" double precision,
	"reference_price" double precision NOT NULL,
	"prior" real NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"resolves_on" date NOT NULL,
	"status" "question_status" DEFAULT 'OPEN' NOT NULL,
	"outcome" smallint,
	"resolved_at" timestamp with time zone,
	"void_reason" text,
	"methodology_version" text NOT NULL,
	CONSTRAINT "questions_horizon_chk" CHECK ("questions"."horizon" in (5, 10, 21)),
	CONSTRAINT "questions_prior_chk" CHECK ("questions"."prior" > 0 and "questions"."prior" < 1),
	CONSTRAINT "questions_outcome_chk" CHECK ("questions"."outcome" is null or "questions"."outcome" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "reference_runs" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"participant_id" char(26) NOT NULL,
	"issue_date" date NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"request_hash" char(64) NOT NULL,
	"response_hash" char(64),
	"questions_answered" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"error" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"commitment_id" char(26) NOT NULL,
	"methodology_version" text NOT NULL,
	"participant_id" char(26) NOT NULL,
	"question_id" char(26) NOT NULL,
	"issue_date" date NOT NULL,
	"horizon" smallint NOT NULL,
	"question_type" "question_type" NOT NULL,
	"outcome" smallint NOT NULL,
	"brier" real NOT NULL,
	"prior_brier" real NOT NULL,
	"log" real NOT NULL,
	"prior_log" real NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_commitment_id_methodology_version_pk" PRIMARY KEY("commitment_id","methodology_version")
);
--> statement-breakpoint
CREATE TABLE "seal_roots" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"seal_date" date NOT NULL,
	"merkle_root" char(64) NOT NULL,
	"leaf_count" integer NOT NULL,
	"ots_proof" "bytea",
	"anchored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seal_roots_sealDate_unique" UNIQUE("seal_date")
);
--> statement-breakpoint
CREATE TABLE "trading_days" (
	"venue" "venue" NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "trading_days_venue_day_pk" PRIMARY KEY("venue","day")
);
--> statement-breakpoint
CREATE TABLE "universe_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "universe_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_active_from_universe_versions_id_fk" FOREIGN KEY ("active_from") REFERENCES "public"."universe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_active_to_universe_versions_id_fk" FOREIGN KEY ("active_to") REFERENCES "public"."universe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_seal_root_id_seal_roots_id_fk" FOREIGN KEY ("seal_root_id") REFERENCES "public"."seal_roots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_daily" ADD CONSTRAINT "participant_daily_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_stats" ADD CONSTRAINT "participant_stats_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_methodology_version_methodology_versions_version_fk" FOREIGN KEY ("methodology_version") REFERENCES "public"."methodology_versions"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_universe_version_universe_versions_id_fk" FOREIGN KEY ("universe_version") REFERENCES "public"."universe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_issue_date_question_sets_issue_date_fk" FOREIGN KEY ("issue_date") REFERENCES "public"."question_sets"("issue_date") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_runs" ADD CONSTRAINT "reference_runs_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_participant_idx" ON "api_keys" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_symbol_venue_idx" ON "assets" USING btree ("symbol","venue");--> statement-breakpoint
CREATE INDEX "assets_venue_active_idx" ON "assets" USING btree ("venue","active_to");--> statement-breakpoint
CREATE INDEX "assets_ingest_idx" ON "assets" USING btree ("last_ingest_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commitments_participant_question_idx" ON "commitments" USING btree ("participant_id","question_id");--> statement-breakpoint
CREATE INDEX "commitments_question_idx" ON "commitments" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "commitments_participant_issue_idx" ON "commitments" USING btree ("participant_id","issue_date");--> statement-breakpoint
CREATE INDEX "commitments_unsealed_idx" ON "commitments" USING btree ("submitted_at") WHERE "commitments"."seal_root_id" is null;--> statement-breakpoint
CREATE INDEX "participant_stats_board_idx" ON "participant_stats" USING btree ("methodology_version","eligible","bss_lower");--> statement-breakpoint
CREATE INDEX "participants_publisher_idx" ON "participants" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "participants_visibility_idx" ON "participants" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "prices_day_idx" ON "prices" USING brin ("day");--> statement-breakpoint
CREATE INDEX "questions_issue_date_idx" ON "questions" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "questions_resolves_status_idx" ON "questions" USING btree ("resolves_on","status");--> statement-breakpoint
CREATE INDEX "questions_asset_issue_idx" ON "questions" USING btree ("asset_id","issue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_runs_participant_issue_idx" ON "reference_runs" USING btree ("participant_id","issue_date");--> statement-breakpoint
CREATE INDEX "scores_participant_issue_idx" ON "scores" USING btree ("participant_id","issue_date");