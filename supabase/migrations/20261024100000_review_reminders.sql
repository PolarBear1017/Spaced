-- One schedule per browser subscription. Delivery state is server-owned.
create table public.review_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 1 and 2048),
  p256dh text not null,
  auth text not null,
  reminder_time time not null default '20:00',
  timezone text not null,
  language text not null default 'zh-TW' check (language in ('zh-TW', 'en')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_sent_day date,
  last_test_at timestamptz,
  lease_until timestamptz,
  lease_token uuid,
  attempts integer not null default 0,
  attempt_day date
);
alter table public.review_reminders enable row level security;
create policy review_reminders_owner_read on public.review_reminders for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.review_reminders from public, anon, authenticated;
grant select on public.review_reminders to authenticated;
grant all on public.review_reminders to service_role;

-- Claim atomically so concurrent cron invocations cannot send the same reminder.
-- Catch up for 60 minutes after the selected time, with at most 3 attempts/day.
create function public.claim_review_reminders(p_limit integer default 50)
returns setof public.review_reminders
language sql security definer set search_path = '' as $$
  with due as (
    select r.id from public.review_reminders r
    left join public.review_preferences p on p.user_id = r.user_id
    where r.enabled
      and (r.lease_until is null or r.lease_until < now())
      and r.last_sent_day is distinct from (now() at time zone r.timezone)::date
      and (r.attempt_day is distinct from (now() at time zone r.timezone)::date or r.attempts < 3)
      and (now() at time zone r.timezone) >= ((now() at time zone r.timezone)::date + r.reminder_time)
      and (now() at time zone r.timezone) < ((now() at time zone r.timezone)::date + r.reminder_time + interval '60 minutes')
      and not exists (
        select 1 from public.review_days d where d.user_id = r.user_id
          and d.day = (now() at time zone coalesce(p.timezone, r.timezone))::date and d.checked_in
      )
    order by r.id limit greatest(1, least(p_limit, 100))
    for update of r skip locked
  )
  update public.review_reminders r set
    lease_until = now() + interval '5 minutes', lease_token = gen_random_uuid(),
    attempts = case when r.attempt_day = (now() at time zone r.timezone)::date then r.attempts + 1 else 1 end,
    attempt_day = (now() at time zone r.timezone)::date
  from due where r.id = due.id returning r.*;
$$;
revoke all on function public.claim_review_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_review_reminders(integer) to service_role;
