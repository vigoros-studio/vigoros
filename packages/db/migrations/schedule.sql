-- Scheduling with Supabase pg_cron + pg_net. Run ONCE in the Supabase SQL editor after the app is
-- deployed. Not part of the drizzle migration chain because it carries deployment-specific values.
--
-- 1. Enable extensions (Database > Extensions in the dashboard, or):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Store the endpoint and secret once. Vault keeps the secret out of the cron definitions.
select vault.create_secret('https://vigoros.studio', 'vigoros_base_url');
select vault.create_secret('REPLACE_WITH_CRON_SECRET', 'vigoros_cron_secret');

-- 3. A helper that calls one job endpoint.
create or replace function public.call_vigoros_job(job text) returns bigint
language plpgsql security definer as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'vigoros_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'vigoros_cron_secret';
  return net.http_post(
    url := base || '/api/jobs/' || job,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
end $$;
revoke all on function public.call_vigoros_job(text) from public;

-- 4. The daily pipeline (all times UTC). Every step is idempotent and chunked, so frequent calls are safe.
select cron.schedule('vigoros-ingest',        '*/10 * * * *', $$select public.call_vigoros_job('ingest')$$);
select cron.schedule('vigoros-generate',      '35 0 * * *',    $$select public.call_vigoros_job('generate')$$);
select cron.schedule('vigoros-baselines',     '45 0 * * *',   $$select public.call_vigoros_job('baselines')$$);
select cron.schedule('vigoros-reference',     '50 0 * * *,*/10 1-5 * * *', $$select public.call_vigoros_job('reference')$$);
select cron.schedule('vigoros-resolve',       '30 * * * *',   $$select public.call_vigoros_job('resolve')$$);
select cron.schedule('vigoros-seal',          '45 23 * * *',  $$select public.call_vigoros_job('seal')$$);
select cron.schedule('vigoros-upgrade-seals', '0 */6 * * *',  $$select public.call_vigoros_job('upgrade-seals')$$);
select cron.schedule('vigoros-stats',         '0 3 * * *',    $$select public.call_vigoros_job('stats')$$);

-- Inspect: select * from cron.job; select * from cron.job_run_details order by start_time desc limit 50;
