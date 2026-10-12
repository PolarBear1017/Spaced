-- Preserve each day's goal and earn historical check-ins after offline merges.
alter table public.review_days add column target integer check (target between 1 and 20);
update public.review_days d set target = p.goal
  from public.review_preferences p where p.user_id = d.user_id;
alter table public.review_days alter column target set default 10;
alter table public.review_days alter column target set not null;

create or replace function public.sync_daily_review(
  p_days jsonb default '{}'::jsonb,
  p_goal integer default null,
  p_initial_goal integer default 10,
  p_timezone text default 'UTC'
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_pref public.review_preferences%rowtype;
  v_day date;
  v_key text;
  v_value jsonb;
  v_words text[];
  v_introduced text[];
  v_history jsonb;
  v_count integer;
  v_target integer;
  v_day_target integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_goal is not null and p_goal not in (5, 10, 20) then raise exception 'Invalid daily goal'; end if;
  if p_initial_goal not in (5, 10, 20) or p_initial_goal is null then raise exception 'Invalid initial goal'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception 'Invalid timezone'; end if;
  if jsonb_typeof(p_days) is distinct from 'object' then raise exception 'Invalid daily history'; end if;

  insert into public.review_preferences(user_id, goal, timezone)
    values (v_user, coalesce(p_goal, p_initial_goal), p_timezone) on conflict do nothing;
  -- All device writes for an account share this lock, including goal changes.
  select * into v_pref from public.review_preferences where user_id = v_user for update;
  if p_goal is not null then
    update public.review_preferences set goal = p_goal where user_id = v_user returning * into v_pref;
  end if;
  select count(*) into v_count from public.user_library where user_id = v_user;
  v_target := least(v_pref.goal, v_count);

  for v_key, v_value in select * from jsonb_each(p_days) loop
    if v_key !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid history day'; end if;
    v_day := v_key::date;
    if v_day > (current_timestamp at time zone v_pref.timezone)::date then raise exception 'Future check-in day'; end if;
    if jsonb_typeof(v_value->'words') is distinct from 'array'
      or jsonb_typeof(coalesce(v_value->'introduced', '[]'::jsonb)) <> 'array' then raise exception 'Invalid word history'; end if;
    select coalesce(array_agg(distinct value), '{}') into v_words from jsonb_array_elements_text(v_value->'words');
    select coalesce(array_agg(distinct value), '{}') into v_introduced from jsonb_array_elements_text(coalesce(v_value->'introduced', '[]'));
    v_day_target := coalesce((v_value->>'target')::integer, nullif(v_target, 0), v_pref.goal);
    if v_day_target < 1 or v_day_target > 20 then raise exception 'Invalid history target'; end if;
    insert into public.review_days(user_id, day, words, introduced, checked_in, target)
      values (v_user, v_day, v_words, v_introduced, coalesce((v_value->>'checkedIn')::boolean, false), v_day_target)
    on conflict (user_id, day) do update set
      words = array(select distinct unnest(public.review_days.words || excluded.words)),
      introduced = array(select distinct unnest(public.review_days.introduced || excluded.introduced)),
      checked_in = public.review_days.checked_in or excluded.checked_in;
  end loop;
  -- Goal edits affect today's target only. Historical days retain their own
  -- target, so an offline upload tomorrow cannot be judged by tomorrow's goal.
  if p_goal is not null and v_target > 0 then
    update public.review_days set target = v_target
      where user_id = v_user and day = (current_timestamp at time zone v_pref.timezone)::date;
  end if;
  -- Re-evaluate every incomplete day after merging delayed device uploads.
  update public.review_days set checked_in = true
    where user_id = v_user and cardinality(words) >= target and not checked_in;
  select coalesce(jsonb_object_agg(day::text, jsonb_build_object(
    'words', words, 'introduced', introduced, 'checkedIn', checked_in, 'target', target)), '{}')
    into v_history from public.review_days where user_id = v_user;
  return jsonb_build_object('goal', v_pref.goal, 'timezone', v_pref.timezone, 'days', v_history);
end;
$$;
revoke all on function public.sync_daily_review(jsonb, integer, integer, text) from public, anon;
grant execute on function public.sync_daily_review(jsonb, integer, integer, text) to authenticated;
