-- Security posture
-- 1. Nothing is readable through PostgREST by default. The app talks to Postgres with the
--    service role from server code only. RLS is enabled everywhere as defence in depth.
-- 2. Sealed commitment fields are exposed only through views that require revealed_at IS NOT NULL.
-- 3. Scores and stats of PRIVATE participants are never exposed publicly.

alter table methodology_versions enable row level security;
alter table universe_versions enable row level security;
alter table assets enable row level security;
alter table trading_days enable row level security;
alter table prices enable row level security;
alter table question_sets enable row level security;
alter table questions enable row level security;
alter table publishers enable row level security;
alter table participants enable row level security;
alter table api_keys enable row level security;
alter table seal_roots enable row level security;
alter table commitments enable row level security;
alter table scores enable row level security;
alter table participant_daily enable row level security;
alter table participant_stats enable row level security;
alter table reference_runs enable row level security;

-- Public reference data.
create policy "public read" on methodology_versions for select to anon, authenticated using (true);
create policy "public read" on universe_versions for select to anon, authenticated using (true);
create policy "public read" on assets for select to anon, authenticated using (true);
create policy "public read" on trading_days for select to anon, authenticated using (true);
create policy "public read" on question_sets for select to anon, authenticated using (true);
create policy "public read" on questions for select to anon, authenticated using (true);
create policy "public read" on seal_roots for select to anon, authenticated using (true);

-- A publisher sees only their own row and their own participants.
create policy "own publisher" on publishers for select to authenticated
  using (auth_user_id = auth.uid()::text);
create policy "own participants" on participants for select to authenticated
  using (publisher_id in (select id from publishers where auth_user_id = auth.uid()::text));
create policy "published participants" on participants for select to anon, authenticated
  using (visibility = 'PUBLISHED');

-- Commitments: never directly readable by anon. Owner may read their own, revealed or not.
create policy "own commitments" on commitments for select to authenticated
  using (participant_id in (
    select p.id from participants p join publishers pu on pu.id = p.publisher_id
    where pu.auth_user_id = auth.uid()::text));

create policy "own scores" on scores for select to authenticated
  using (participant_id in (
    select p.id from participants p join publishers pu on pu.id = p.publisher_id
    where pu.auth_user_id = auth.uid()::text));
create policy "own stats" on participant_stats for select to authenticated
  using (participant_id in (
    select p.id from participants p join publishers pu on pu.id = p.publisher_id
    where pu.auth_user_id = auth.uid()::text));
create policy "published stats" on participant_stats for select to anon, authenticated
  using (participant_id in (select id from participants where visibility = 'PUBLISHED'));

-- Public record view. The only path from the outside to a forecast, and it is structurally
-- impossible to select an unrevealed one through it.
create view public_commitments with (security_invoker = false) as
  select c.id, c.participant_id, c.question_id, c.issue_date, c.p, c.reasoning, c.falsifier,
         c.hash, c.submitted_at, c.seal_root_id, c.inclusion_proof, c.revealed_at
  from commitments c
  join participants p on p.id = c.participant_id
  where c.revealed_at is not null and p.visibility = 'PUBLISHED';
grant select on public_commitments to anon, authenticated;

-- Sealed-proof view: hash and timestamp of ANY commitment, own or not, with no forecast fields.
-- Lets a participant prove existence before reveal without leaking the forecast.
create view commitment_proofs with (security_invoker = false) as
  select c.id, c.participant_id, c.question_id, c.issue_date, c.hash, c.submitted_at,
         c.seal_root_id, c.inclusion_proof
  from commitments c;
grant select on commitment_proofs to anon, authenticated;

-- Board view: one row per eligible published participant for the current methodology.
create view board with (security_invoker = false) as
  select p.id, p.handle, p.display_name, p.kind, s.methodology_version, s.n, s.distinct_issue_dates,
         s.bss, s.bss_lower, s.bss_upper, s.evidence_nats, s.ece, s.resolution, s.adjusted_p_value,
         s.identity_count, s.coverage, s.distinct_assets, s.computed_at
  from participant_stats s
  join participants p on p.id = s.participant_id
  where s.eligible and p.visibility = 'PUBLISHED';
grant select on board to anon, authenticated;

alter table prior_tables enable row level security;
create policy "public read" on prior_tables for select to anon, authenticated using (true);
