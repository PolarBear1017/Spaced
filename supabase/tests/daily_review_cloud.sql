-- Run on a development database with two test auth users whose IDs are supplied
-- as psql variables user_a/user_b; tests roll back every history change.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select set_config('test.user_a', :'user_a', true);
select public.sync_daily_review('{}', 5, 10, 'Asia/Taipei');
select public.sync_daily_review(jsonb_build_object(
  (current_timestamp at time zone 'Asia/Taipei')::date::text,
  jsonb_build_object('words', jsonb_build_array('a','b','c'), 'introduced', jsonb_build_array('a'), 'checkedIn', false)));
select public.sync_daily_review(jsonb_build_object(
  (current_timestamp at time zone 'Asia/Taipei')::date::text,
  jsonb_build_object('words', jsonb_build_array('c','d','e'), 'introduced', jsonb_build_array('d'), 'checkedIn', false)));
do $$
declare v jsonb;
begin
  v := public.sync_daily_review();
  if (v->>'goal')::int <> 5 or v->>'timezone' <> 'Asia/Taipei' then raise exception 'Goal/timezone was overwritten by default'; end if;
  if not exists (select 1 from public.review_days where cardinality(words) = 5 and cardinality(introduced) = 2 and checked_in) then raise exception 'Device progress did not merge/check in'; end if;
  perform public.sync_daily_review('{}', 20);
  if not exists (select 1 from public.review_days where checked_in) then raise exception 'Check-in revoked'; end if;
  begin
    perform public.sync_daily_review('{}', 99);
    raise exception 'Invalid goal accepted';
  exception when raise_exception then
    if sqlerrm = 'Invalid goal accepted' then raise; end if;
  end;
  begin
    perform public.sync_daily_review('{"2999-01-01":{"words":["future"]}}');
    raise exception 'Future check-in accepted';
  exception when raise_exception then
    if sqlerrm = 'Future check-in accepted' then raise; end if;
  end;
end $$;
-- Yesterday's combined work reaches its original goal despite today's larger goal.
select public.sync_daily_review(jsonb_build_object(
  ((current_timestamp at time zone 'Asia/Taipei')::date - 1)::text,
  jsonb_build_object('words', jsonb_build_array('y1','y2','y3'), 'target', 5)));
select public.sync_daily_review(jsonb_build_object(
  ((current_timestamp at time zone 'Asia/Taipei')::date - 1)::text,
  jsonb_build_object('words', jsonb_build_array('y4','y5'), 'target', 5)));
do $$
begin
  if not exists (select 1 from public.review_days
    where day = (current_timestamp at time zone 'Asia/Taipei')::date - 1 and target = 5 and checked_in)
  then raise exception 'Delayed historical check-in lost'; end if;
end $$;
select set_config('request.jwt.claim.sub', :'user_b', true);
do $$
begin
  if exists (select 1 from public.review_days) then raise exception 'Another account history leaked'; end if;
  if exists (select 1 from public.review_preferences) then raise exception 'Another account goal leaked'; end if;
  begin
    insert into public.review_preferences(user_id) values (current_setting('test.user_a')::uuid);
    raise exception 'Another account write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.sync_daily_review();
    raise exception 'Unauthenticated RPC accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
