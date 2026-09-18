CREATE TYPE "public"."asset_class" AS ENUM('EQUITY', 'ETF', 'FX', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."participant_kind" AS ENUM('HUMAN', 'AGENT', 'REFERENCE_MODEL', 'BASELINE');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('OPEN', 'PENDING', 'RESOLVED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('LEVEL', 'RELATIVE', 'QUINTILE');--> statement-breakpoint
CREATE TYPE "public"."venue" AS ENUM('US', 'UK', 'FX', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('PRIVATE', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"participantId" char(26) NOT NULL,
	"keyHash" char(64) NOT NULL,
	"prefix" char(8) NOT NULL,
	"label" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	CONSTRAINT "api_keys_keyHash_unique" UNIQUE("keyHash")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"venue" "venue" NOT NULL,
	"assetClass" "asset_class" NOT NULL,
	"name" text NOT NULL,
	"peerGroup" text NOT NULL,
	"vendorSymbol" text NOT NULL,
	"activeFrom" integer NOT NULL,
	"activeTo" integer
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"participantId" char(26) NOT NULL,
	"questionId" char(26) NOT NULL,
	"issueDate" date NOT NULL,
	"p" real NOT NULL,
	"reasoning" text,
	"falsifier" text,
	"hash" char(64) NOT NULL,
	"submittedAt" timestamp with time zone NOT NULL,
	"sealRootId" char(26),
	"inclusionProof" jsonb,
	"revealedAt" timestamp with time zone,
	CONSTRAINT "commitments_p_chk" CHECK ("commitments"."p" >= 0.01 and "commitments"."p" <= 0.99)
);
--> statement-breakpoint
CREATE TABLE "methodology_versions" (
	"version" text PRIMARY KEY NOT NULL,
	"effectiveFrom" date NOT NULL,
	"announcedAt" timestamp with time zone NOT NULL,
	"docUrl" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_daily" (
	"participantId" char(26) NOT NULL,
	"issueDate" date NOT NULL,
	"methodologyVersion" text NOT NULL,
	"horizon" smallint NOT NULL,
	"questionType" "question_type" NOT NULL,
	"n" integer NOT NULL,
	"sumBrier" double precision NOT NULL,
	"sumPriorBrier" double precision NOT NULL,
	"sumLog" double precision NOT NULL,
	"sumPriorLog" double precision NOT NULL,
	"calCounts" integer[] NOT NULL,
	"calSumForecast" double precision[] NOT NULL,
	"calSumOutcome" double precision[] NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_daily_participantId_issueDate_methodologyVersion_horizon_questionType_pk" PRIMARY KEY("participantId","issueDate","methodologyVersion","horizon","questionType")
);
--> statement-breakpoint
CREATE TABLE "participant_stats" (
	"participantId" char(26) NOT NULL,
	"methodologyVersion" text NOT NULL,
	"n" integer NOT NULL,
	"distinctIssueDates" integer NOT NULL,
	"firstIssueDate" date,
	"lastIssueDate" date,
	"eligible" boolean NOT NULL,
	"bss" double precision,
	"bssLower" double precision,
	"bssUpper" double precision,
	"evidenceNats" double precision,
	"ece" double precision,
	"reliability" double precision,
	"resolution" double precision,
	"uncertainty" double precision,
	"pValue" double precision,
	"identityCount" integer DEFAULT 1 NOT NULL,
	"adjustedPValue" double precision,
	"coverage" double precision,
	"distinctAssets" integer,
	"bssByHorizon" jsonb,
	"bssByType" jsonb,
	"rollingSeries" jsonb,
	"calibrationBins" jsonb,
	"bootstrapSeed" integer NOT NULL,
	"computedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_stats_participantId_methodologyVersion_pk" PRIMARY KEY("participantId","methodologyVersion")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"publisherId" char(26) NOT NULL,
	"kind" "participant_kind" NOT NULL,
	"handle" text NOT NULL,
	"displayName" text NOT NULL,
	"visibility" "visibility" DEFAULT 'PRIVATE' NOT NULL,
	"publishedAt" timestamp with time zone,
	"config" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"assetId" char(26) NOT NULL,
	"day" date NOT NULL,
	"close" double precision NOT NULL,
	"adjClose" double precision NOT NULL,
	"volume" double precision,
	"source" text NOT NULL,
	"ingestedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_assetId_day_pk" PRIMARY KEY("assetId","day")
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"authUserId" text NOT NULL,
	"email" text NOT NULL,
	"displayName" text NOT NULL,
	"verifiedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishers_authUserId_unique" UNIQUE("authUserId"),
	CONSTRAINT "publishers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "question_sets" (
	"issueDate" date PRIMARY KEY NOT NULL,
	"seed" text NOT NULL,
	"methodologyVersion" text NOT NULL,
	"universeVersion" integer NOT NULL,
	"questionCount" integer NOT NULL,
	"priorTable" jsonb NOT NULL,
	"generatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"issueDate" date NOT NULL,
	"venue" "venue" NOT NULL,
	"assetId" char(26) NOT NULL,
	"type" "question_type" NOT NULL,
	"horizon" smallint NOT NULL,
	"levelK" smallint,
	"threshold" double precision,
	"referencePrice" double precision NOT NULL,
	"prior" real NOT NULL,
	"deadlineAt" timestamp with time zone NOT NULL,
	"resolvesOn" date NOT NULL,
	"status" "question_status" DEFAULT 'OPEN' NOT NULL,
	"outcome" smallint,
	"resolvedAt" timestamp with time zone,
	"voidReason" text,
	"methodologyVersion" text NOT NULL,
	CONSTRAINT "questions_horizon_chk" CHECK ("questions"."horizon" in (5, 10, 21)),
	CONSTRAINT "questions_prior_chk" CHECK ("questions"."prior" > 0 and "questions"."prior" < 1),
	CONSTRAINT "questions_outcome_chk" CHECK ("questions"."outcome" is null or "questions"."outcome" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "reference_runs" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"participantId" char(26) NOT NULL,
	"issueDate" date NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"promptVersion" text NOT NULL,
	"requestHash" char(64) NOT NULL,
	"responseHash" char(64),
	"questionsAnswered" integer DEFAULT 0 NOT NULL,
	"inputTokens" integer,
	"outputTokens" integer,
	"latencyMs" integer,
	"error" text,
	"startedAt" timestamp with time zone NOT NULL,
	"finishedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"commitmentId" char(26) NOT NULL,
	"methodologyVersion" text NOT NULL,
	"participantId" char(26) NOT NULL,
	"questionId" char(26) NOT NULL,
	"issueDate" date NOT NULL,
	"horizon" smallint NOT NULL,
	"questionType" "question_type" NOT NULL,
	"outcome" smallint NOT NULL,
	"brier" real NOT NULL,
	"priorBrier" real NOT NULL,
	"log" real NOT NULL,
	"priorLog" real NOT NULL,
	"scoredAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_commitmentId_methodologyVersion_pk" PRIMARY KEY("commitmentId","methodologyVersion")
);
--> statement-breakpoint
CREATE TABLE "seal_roots" (
	"id" char(26) PRIMARY KEY NOT NULL,
	"sealDate" date NOT NULL,
	"merkleRoot" char(64) NOT NULL,
	"leafCount" integer NOT NULL,
	"otsProof" "bytea",
	"anchoredAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seal_roots_sealDate_unique" UNIQUE("sealDate")
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
	"effectiveFrom" date NOT NULL,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_participantId_participants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_activeFrom_universe_versions_id_fk" FOREIGN KEY ("activeFrom") REFERENCES "public"."universe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_activeTo_universe_versions_id_fk" FOREIGN KEY ("activeTo") REFERENCES "public"."universe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_participantId_participants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_sealRootId_seal_roots_id_fk" FOREIGN KEY ("sealRootId") REFERENCES "public"."seal_roots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_daily" ADD CONSTRAINT "participant_daily_participantId_participants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_stats" ADD CONSTRAINT "participant_stats_participantId_participants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_publisherId_publishers_id_fk" FOREIGN KEY ("publisherId") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_assetId_assets_id_fk" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_methodologyVersion_methodology_versions_version_fk" FOREIGN KEY ("methodologyVersion") REFERENCES "public"."methodology_versions"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_universeVersion_universe_versions_id_fk" FOREIGN KEY ("universeVersion") REFERENCES "public"."universe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_issueDate_question_sets_issueDate_fk" FOREIGN KEY ("issueDate") REFERENCES "public"."question_sets"("issueDate") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_assetId_assets_id_fk" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_runs" ADD CONSTRAINT "reference_runs_participantId_participants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_commitmentId_commitments_id_fk" FOREIGN KEY ("commitmentId") REFERENCES "public"."commitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_participant_idx" ON "api_keys" USING btree ("participantId");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_symbol_venue_idx" ON "assets" USING btree ("symbol","venue");--> statement-breakpoint
CREATE INDEX "assets_venue_active_idx" ON "assets" USING btree ("venue","activeTo");--> statement-breakpoint
CREATE UNIQUE INDEX "commitments_participant_question_idx" ON "commitments" USING btree ("participantId","questionId");--> statement-breakpoint
CREATE INDEX "commitments_question_idx" ON "commitments" USING btree ("questionId");--> statement-breakpoint
CREATE INDEX "commitments_participant_issue_idx" ON "commitments" USING btree ("participantId","issueDate");--> statement-breakpoint
CREATE INDEX "commitments_unsealed_idx" ON "commitments" USING btree ("submittedAt") WHERE "commitments"."sealRootId" is null;--> statement-breakpoint
CREATE INDEX "participant_stats_board_idx" ON "participant_stats" USING btree ("methodologyVersion","eligible","bssLower");--> statement-breakpoint
CREATE INDEX "participants_publisher_idx" ON "participants" USING btree ("publisherId");--> statement-breakpoint
CREATE INDEX "participants_visibility_idx" ON "participants" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "prices_day_idx" ON "prices" USING brin ("day");--> statement-breakpoint
CREATE INDEX "questions_issue_date_idx" ON "questions" USING btree ("issueDate");--> statement-breakpoint
CREATE INDEX "questions_resolves_status_idx" ON "questions" USING btree ("resolvesOn","status");--> statement-breakpoint
CREATE INDEX "questions_asset_issue_idx" ON "questions" USING btree ("assetId","issueDate");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_runs_participant_issue_idx" ON "reference_runs" USING btree ("participantId","issueDate");--> statement-breakpoint
CREATE INDEX "scores_participant_issue_idx" ON "scores" USING btree ("participantId","issueDate");