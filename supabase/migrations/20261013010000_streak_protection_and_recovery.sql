-- The public wrapper owns protection allocation and recovery state. Old clients
-- continue using the same four arguments; a fifth optional argument is additive.
alter table public.review_days add column protected boolean not null default false;
alter table public.review_days add column recovery boolean not null default false;
alter table public.review_days add column recovery_choice text check (recovery_choice in ('regular', 'recovery'));
alter table public.review_preferences add column protection_started_on date not null default current_date;
update public.review_preferences set protection_started_on = (current_timestamp at time zone timezone)::date - 1;

alter function public.sync_daily_review(jsonb, integer, integer, text) rename to sync_daily_review_base;
revoke all on function public.sync_daily_review_base(jsonb, integer, integer, text) from public, anon, authenticated;
-- Clients may still write their own learning data, but cannot allocate shields.
revoke insert, update on public.review_days from authenticated;
grant insert(user_id, day, words, introduced, checked_in, target),
  update(words, introduced, checked_in, target) on public.review_days to authenticated;
revoke insert, update on public.review_preferences from authenticated;
grant insert(user_id, goal, timezone), update(goal) on public.review_preferences to authenticated;

create function public.sync_daily_review(
  p_days jsonb default '{}', p_goal integer default null,
  p_initial_goal integer default 10, p_timezone text default 'UTC',
  p_recovery_choice text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_pref public.review_preferences%rowtype;
  v_today date;
  v_last date;
  v_missing date;
  v_used integer;
  v_count integer;
  v_history jsonb;
  v_recovery boolean;
  v_choice text;
  v_new boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_recovery_choice is not null and p_recovery_choice not in ('regular', 'recovery') then raise exception 'Invalid recovery choice'; end if;
  v_new := not exists (select 1 from public.review_preferences where user_id = v_user);
  -- A late offline upload can carry the original target for a protected day.
  -- Acquire the same account lock first to keep lock ordering consistent.
  perform 1 from public.review_preferences where user_id = v_user for update;
  update public.review_days d set target = (entry.value->>'target')::integer
    from jsonb_each(p_days) entry where d.user_id = v_user and d.protected
      and d.day::text = entry.key and entry.value->>'target' is not null;
  -- Base explicitly filters every read/write by auth.uid() and locks this user's
  -- preferences row for the remainder of this transaction.
  perform public.sync_daily_review_base(p_days, p_goal, p_initial_goal, p_timezone);
  select * into v_pref from public.review_preferences where user_id = v_user;
  v_today := (current_timestamp at time zone v_pref.timezone)::date;
  if v_new then
    update public.review_preferences set protection_started_on = v_today - 1
      where user_id = v_user returning * into v_pref;
  end if;
  select count(*) into v_count from public.user_library where user_id = v_user;
  select max(day) into v_last from public.review_days where user_id = v_user and checked_in and day < v_today;
  select recovery, recovery_choice into v_recovery, v_choice from public.review_days where user_id = v_user and day = v_today;
  -- Persist the offered mode even across devices; opt-out affects today only.
  v_choice := coalesce(p_recovery_choice, v_choice);
  v_recovery := case when v_choice is not null then v_choice = 'recovery'
    else coalesce(v_recovery, false) or (v_last is not null and v_today - v_last >= 4) end;
  insert into public.review_days(user_id, day, target, recovery, recovery_choice)
    values (v_user, v_today, greatest(1, least(case when v_recovery then 5 else v_pref.goal end, v_count)), v_recovery, v_choice)
  on conflict (user_id, day) do update set recovery = v_recovery, recovery_choice = v_choice,
    target = case when v_recovery then greatest(1, least(5, v_count))
      else greatest(1, least(v_pref.goal, v_count)) end;
  update public.review_days set checked_in = true where user_id = v_user
    and day = v_today and v_count > 0 and cardinality(words) >= target and not checked_in;
  -- A genuine late check-in replaces protection and returns its monthly allowance.
  update public.review_days set protected = false where user_id = v_user and checked_in and protected;
  -- Protect only a missed day immediately after an actual check-in. Consecutive
  -- missed days cannot chain shields. Never backfill before feature activation.
  for v_missing in
    select d.day + 1 from public.review_days d
    where d.user_id = v_user and d.checked_in and d.day + 1 < v_today
      and d.day + 1 >= v_pref.protection_started_on
      and not exists (select 1 from public.review_days n where n.user_id = v_user
        and n.day = d.day + 1 and (n.checked_in or n.protected)) order by d.day
  loop
    select count(*) into v_used from public.review_days where user_id = v_user and protected
      and date_trunc('month', day::timestamp) = date_trunc('month', v_missing::timestamp);
    if v_used < 2 then
      insert into public.review_days(user_id, day, target, protected)
        values (v_user, v_missing, greatest(1, least(v_pref.goal, v_count)), true)
      on conflict (user_id, day) do update set protected = true where not public.review_days.checked_in;
    end if;
  end loop;
  select count(*) into v_used from public.review_days where user_id = v_user and protected
    and date_trunc('month', day::timestamp) = date_trunc('month', v_today::timestamp);
  select coalesce(jsonb_object_agg(day::text, jsonb_build_object('words', words,
    'introduced', introduced, 'checkedIn', checked_in, 'target', target,
    'protected', protected, 'recovery', recovery)), '{}') into v_history
    from public.review_days where user_id = v_user;
  return jsonb_build_object('goal', v_pref.goal, 'timezone', v_pref.timezone,
    'days', v_history, 'protectionRemaining', greatest(0, 2 - v_used));
end $$;
revoke all on function public.sync_daily_review(jsonb, integer, integer, text, text) from public, anon;
grant execute on function public.sync_daily_review(jsonb, integer, integer, text, text) to authenticated;
notify pgrst, 'reload schema';
