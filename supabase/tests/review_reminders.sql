-- Rollback-only test. Run in a development DB as postgres with two disposable
-- auth.users IDs supplied via psql: -v user_a=... -v user_b=...
begin;
set local timezone = 'UTC';
select set_config('test.user_a', :'user_a', true);
select set_config('test.user_b', :'user_b', true);

do $$
declare
  a uuid := current_setting('test.user_a')::uuid;
  b uuid := current_setting('test.user_b')::uuid;
  claimed public.review_reminders%rowtype;
  n integer;
  zone text;
  local_now timestamp;
begin
  -- Disposable accounts must have no reminders/history to avoid fixture collisions.
  if exists (select 1 from public.review_reminders where user_id in (a,b))
    or exists (select 1 from public.review_days where user_id in (a,b)) then
    raise exception 'Use disposable accounts without reminder/review history';
  end if;
  -- Pick a timezone whose current clock is well away from midnight, on any host.
  select name into zone from pg_catalog.pg_timezone_names
    where (now() at time zone name)::time between '06:00' and '18:00' limit 1;
  local_now := now() at time zone zone;
  insert into public.review_preferences(user_id, goal, timezone) values (a,10,zone), (b,10,zone)
    on conflict(user_id) do update set timezone = excluded.timezone;
  insert into public.review_reminders(user_id, endpoint, p256dh, auth, timezone, reminder_time)
    values (a,'https://fcm.googleapis.com/test-a','test-key','test-auth',zone,(local_now - interval '5 minutes')::time),
           (b,'https://fcm.googleapis.com/test-b','test-key','test-auth',zone,(local_now - interval '5 minutes')::time);
  insert into public.review_days(user_id, day, checked_in) values (b,local_now::date,true);

  select * into claimed from public.claim_review_reminders(50);
  if claimed.user_id is distinct from a or claimed.attempts <> 1 or claimed.lease_token is null then
    raise exception 'Due reminders must be claimed; completed accounts must be skipped';
  end if;
  select count(*) into n from public.claim_review_reminders(50);
  if n <> 0 then raise exception 'Active lease allowed duplicate claims'; end if;

  update public.review_reminders set lease_until = now() - interval '1 second' where user_id = a;
  select * into claimed from public.claim_review_reminders(50);
  if claimed.attempts <> 2 then raise exception 'Transient failures must retry'; end if;
  update public.review_reminders set lease_until = null, last_sent_day = local_now::date where user_id = a;
  select count(*) into n from public.claim_review_reminders(50);
  if n <> 0 then raise exception 'Successful delivery allowed a same-day duplicate'; end if;

  update public.review_reminders set last_sent_day = null, lease_until = null, attempts = 3 where user_id = a;
  select count(*) into n from public.claim_review_reminders(50);
  if n <> 0 then raise exception 'Retry cap must stop repeated failures'; end if;
  update public.review_reminders set attempt_day = local_now::date - 1 where user_id = a;
  select * into claimed from public.claim_review_reminders(50);
  if claimed.attempts <> 1 then raise exception 'Attempt budget must reset the next day'; end if;

  update public.review_reminders set lease_until = null, enabled = false where user_id = a;
  select count(*) into n from public.claim_review_reminders(50);
  if n <> 0 then raise exception 'Disabled reminders must not send'; end if;
  update public.review_reminders set enabled = true, reminder_time = (local_now + interval '1 hour')::time where user_id = a;
  select count(*) into n from public.claim_review_reminders(50);
  if n <> 0 then raise exception 'Future reminders must not send'; end if;
  update public.review_reminders set reminder_time = (local_now - interval '2 hours')::time where user_id = a;
  select count(*) into n from public.claim_review_reminders(50);
  if n <> 0 then raise exception 'Expired reminders must not catch up all day'; end if;
end $$;

-- Only the service can modify delivery state, and users can only read their rows.
select set_config('request.jwt.claim.sub', :'user_a', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.review_reminders) <> 1 then raise exception 'Reminder RLS leaked another account'; end if;
  begin
    update public.review_reminders set last_sent_day = null;
    raise exception 'Client modified delivery state';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_review_reminders(50);
    raise exception 'Client invoked scheduler';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
