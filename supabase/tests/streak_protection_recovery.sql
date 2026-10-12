-- Disposable development users only; all data changes roll back.
begin;
select set_config('request.jwt.claim.sub', :'user_a', true);
insert into public.review_preferences(user_id, goal, timezone, protection_started_on)
  values (:'user_a', 20, 'Asia/Taipei', (date_trunc('month', current_timestamp at time zone 'Asia/Taipei') - interval '1 month')::date)
  on conflict (user_id) do update set goal = 20, timezone = 'Asia/Taipei', protection_started_on = excluded.protection_started_on;
set local role authenticated;
do $$
declare
  v_today date := (current_timestamp at time zone 'Asia/Taipei')::date;
  v jsonb;
begin
  v := public.sync_daily_review(jsonb_build_object((v_today - 2)::text,
    jsonb_build_object('words', jsonb_build_array('a','b','c','d','e'), 'target', 5)));
  if not (v->'days'->(v_today - 1)::text->>'protected')::boolean then raise exception 'Missed day not protected'; end if;
  if (v->'days'->(v_today - 1)::text->>'checkedIn')::boolean then raise exception 'Protection counted as study'; end if;
  perform public.sync_daily_review();
  if (select count(*) from public.review_days where protected) <> 1 then raise exception 'Repeated sync consumed protection twice'; end if;
  -- A delayed genuine completion supersedes the shield.
  v := public.sync_daily_review(jsonb_build_object((v_today - 1)::text,
    jsonb_build_object('words', jsonb_build_array('a','b','c','d','e'), 'target', 5)));
  if (v->'days'->(v_today - 1)::text->>'protected')::boolean then raise exception 'Late check-in did not refund protection'; end if;
  begin
    update public.review_days set protected = true where day = v_today;
    raise exception 'Client could allocate a shield';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.review_days where protected;
    raise exception 'Client could erase protection accounting';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.sync_daily_review_base();
    raise exception 'Client could bypass public wrapper';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.review_days where user_id = :'user_a';
-- Test the monthly cap in a full previous month, including near month boundaries.
set local role authenticated;
do $$
declare
  v_today date := (current_timestamp at time zone 'Asia/Taipei')::date;
  v_month date := (date_trunc('month', current_timestamp at time zone 'Asia/Taipei') - interval '1 month')::date;
  v jsonb;
  i integer;
begin
  for i in 0..2 loop
    perform public.sync_daily_review(jsonb_build_object((v_month + i * 2)::text,
      jsonb_build_object('words', jsonb_build_array('a','b','c','d','e'), 'target', 5)));
  end loop;
  v := public.sync_daily_review();
  if (select count(*) from public.review_days where protected) <> 2 then raise exception 'Monthly cap not enforced'; end if;
  if exists (select 1 from public.review_days where day = v_month + 5 and protected) then raise exception 'Third shield allocated'; end if;
  if exists (select 1 from public.review_days where day = v_month + 6 and protected) then raise exception 'Consecutive misses chained protection'; end if;
  if (v->>'protectionRemaining')::int <> 2 then raise exception 'Monthly allowance not renewed'; end if;
  if not (v->'days'->v_today::text->>'recovery')::boolean or (v->'days'->v_today::text->>'target')::int <> 5 then raise exception 'Recovery goal not offered'; end if;
  if (v->>'goal')::int <> 20 then raise exception 'Regular goal overwritten'; end if;
  v := public.sync_daily_review(p_recovery_choice => 'regular');
  v := public.sync_daily_review();
  if (v->'days'->v_today::text->>'recovery')::boolean then raise exception 'Opt-out not shared with other device'; end if;
  v := public.sync_daily_review(p_recovery_choice => 'recovery');
  v := public.sync_daily_review(jsonb_build_object(v_today::text,
    jsonb_build_object('words', jsonb_build_array('r1','r2','r3','r4','r5'), 'target', 5)));
  if not (v->'days'->v_today::text->>'checkedIn')::boolean then raise exception 'Recovery could not earn check-in'; end if;
  if (v->>'goal')::int <> 20 then raise exception 'Recovery changed permanent goal'; end if;
end $$;
rollback;
