CREATE TABLE "prior_tables" (
	"month" date PRIMARY KEY NOT NULL,
	"methodologyVersion" text NOT NULL,
	"table" jsonb NOT NULL,
	"asOf" date NOT NULL,
	"computedAt" timestamp with time zone DEFAULT now() NOT NULL
);

alter table prior_tables enable row level security;
create policy "public read" on prior_tables for select to anon, authenticated using (true);
