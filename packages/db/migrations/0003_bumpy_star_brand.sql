ALTER TABLE "assets" ADD COLUMN "lastPriceDay" date;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "lastIngestAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "lastIngestError" text;--> statement-breakpoint
CREATE INDEX "assets_ingest_idx" ON "assets" USING btree ("lastIngestAt");