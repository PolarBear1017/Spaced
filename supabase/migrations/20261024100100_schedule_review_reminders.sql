create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Generate the scheduler credential inside Vault; it never enters source/env files.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'review_reminder_scheduler') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'review_reminder_scheduler');
  end if;
end $$;

create function public.authorize_review_reminder_dispatch(p_token text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets
    where name = 'review_reminder_scheduler' and decrypted_secret = p_token and length(p_token) = 64);
$$;
revoke all on function public.authorize_review_reminder_dispatch(text) from public, anon, authenticated;
grant execute on function public.authorize_review_reminder_dispatch(text) to service_role;

select cron.schedule('daily-review-reminders', '* * * * *', $cron$
  select net.http_post(
    url := 'https://qucyaothykoxwluaezwh.supabase.co/functions/v1/review-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-review-scheduler',
      (select decrypted_secret from vault.decrypted_secrets where name = 'review_reminder_scheduler')),
    body := '{"action":"dispatch"}'::jsonb,
    timeout_milliseconds := 10000
  ) where exists (select 1 from public.review_reminders where enabled);
$cron$);
