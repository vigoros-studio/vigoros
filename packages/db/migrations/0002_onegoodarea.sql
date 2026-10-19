-- 19 October 2026: the company is repurposed as OneGoodArea's distribution team.
-- The character scoping becomes a general "subject" scoping. Renames keep every row.
ALTER TABLE "studio"."characters" RENAME TO "subjects";
--> statement-breakpoint
ALTER INDEX "studio"."characters_company_key" RENAME TO "subjects_company_key";
--> statement-breakpoint
ALTER TABLE "studio"."subjects" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'character';
--> statement-breakpoint
ALTER TABLE "studio"."subjects" ADD COLUMN IF NOT EXISTS "website" text;
--> statement-breakpoint
ALTER TABLE "studio"."subjects" ALTER COLUMN "handle" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "studio"."subjects" RENAME COLUMN "production_root" TO "docs_root";
--> statement-breakpoint
ALTER TABLE "studio"."subjects" ALTER COLUMN "docs_root" DROP NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS "studio"."character_state";
--> statement-breakpoint
ALTER TABLE "studio"."agents" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."workflows" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."tasks" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."approvals" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."artifacts" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."cost_ledger" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."events" RENAME COLUMN "character_id" TO "subject_id";
--> statement-breakpoint
ALTER TABLE "studio"."decisions" RENAME COLUMN "character_id" TO "subject_id";
