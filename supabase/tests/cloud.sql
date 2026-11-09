-- Run inside a transaction against an isolated local Supabase DB.
begin;
insert into auth.users(id,email,email_confirmed_at)values('11111111-1111-4111-8111-111111111111','a@example.test',now()),('22222222-2222-4222-8222-222222222222','b@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.initialize_profile('Asia/Seoul');
create function pg_temp.assert(ok boolean,message text)returns void language plpgsql as $$begin if not coalesce(ok,false)then raise exception 'TEST FAILED: %',message;end if;end$$;
select public.apply_operation('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","changes":[{"key":"habits::33333333-3333-4333-8333-333333333333","kind":"habits","id":"33333333-3333-4333-8333-333333333333","day":"","base":null,"data":{"title":"water","icon":"💧","timeGroup":"morning","scheduledTime":null,"alarmEnabled":false,"position":0},"deleted":false},{"key":"days:2026-11-10:2026-11-10","kind":"days","id":"2026-11-10","day":"2026-11-10","base":null,"data":{"timezone":"Asia/Seoul"},"deleted":false},{"key":"habit_entries:2026-11-10:33333333-3333-4333-8333-333333333333","kind":"habit_entries","id":"33333333-3333-4333-8333-333333333333","day":"2026-11-10","base":null,"data":{"title":"water","icon":"💧","timeGroup":"morning","scheduledTime":null,"alarmEnabled":false,"position":0,"completed":true,"rating":0,"memo":"original"},"deleted":false}]}');
select pg_temp.assert((select count(*)=1 from public.habits),'owner can read');
select pg_temp.assert(jsonb_array_length(public.pull_changes(-1)->'entities')=3,'snapshot contains parents and entry');
do $$declare p jsonb;r jsonb;begin
 select request into p from public.sync_operations limit 1;r:=public.apply_operation(p);
 perform pg_temp.assert((select revision=1 from public.sync_state),'retry does not advance revision');
 p:=jsonb_set(p,'{changes,0,data,title}','"different"');
 begin perform public.apply_operation(p);raise exception 'TEST FAILED: reused ID accepted';exception when others then if sqlerrm='TEST FAILED: reused ID accepted'then raise;end if;end;
 begin insert into public.habits select * from public.habits;raise exception 'TEST FAILED: direct write';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.initialize_profile('UTC');
select pg_temp.assert((select count(*)=0 from public.habits),'B cannot read A');
select pg_temp.assert(jsonb_array_length(public.pull_changes(-1)->'entities')=0,'RPC cannot read A');
-- Cross-owner parent IDs cannot be referenced, even through a definer RPC.
do $$begin
 begin
 perform public.apply_operation('{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","changes":[{"key":"days:2026-11-10:2026-11-10","kind":"days","id":"2026-11-10","day":"2026-11-10","base":null,"data":{},"deleted":false},{"key":"habit_entries:2026-11-10:33333333-3333-4333-8333-333333333333","kind":"habit_entries","id":"33333333-3333-4333-8333-333333333333","day":"2026-11-10","base":null,"data":{"title":"water","icon":"💧","timeGroup":"morning","scheduledTime":null,"alarmEnabled":false,"position":0,"completed":true,"rating":0,"memo":"attack"},"deleted":false}]}');
 raise exception 'TEST FAILED: foreign parent accepted';exception when foreign_key_violation then null;end;
 perform pg_temp.assert((select count(*)=0 from public.days),'failed command is atomic');
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare e jsonb;p jsonb;r jsonb;base jsonb;begin
 select public.pull_changes(-1)->'entities'->2 into e;
 select value into e from jsonb_array_elements(public.pull_changes(-1)->'entities')where value->>'kind'='habit_entries';base:=e;
 p:=jsonb_build_object('id',gen_random_uuid(),'changes',jsonb_build_array(jsonb_build_object('key',e->>'key','kind','habit_entries','id',e->>'id','day',e->>'day','base',base,'data',jsonb_set(e->'data','{memo}','"first"'),'deleted',false)));
 r:=public.apply_operation(p);perform pg_temp.assert(r->>'status'='applied','first edit');
 p:=jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text));p:=jsonb_set(p,'{changes,0,data,memo}','"second"');r:=public.apply_operation(p);
 perform pg_temp.assert(r->>'status'='conflict','overlapping memo preserved as conflict');
 perform pg_temp.assert((select data->>'memo'='first'from public.habit_entries),'conflict does not overwrite');
 p:=jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text));p:=jsonb_set(p,'{changes,0,data}',jsonb_set(base->'data','{rating}','5'));r:=public.apply_operation(p);
 perform pg_temp.assert(r->>'status'='applied','disjoint fields auto merge');
 perform pg_temp.assert((select data->>'memo'='first'and data->>'rating'='5'from public.habit_entries),'merge keeps both');
end $$;
-- Import verification, restart safety, timezone CAS, and frozen pagination.
do $$declare items jsonb;content text;hash text;batch uuid;r jsonb;p jsonb;page jsonb;snapshot uuid;begin
 items:=jsonb_build_array(jsonb_build_object('key','habits::44444444-4444-4444-8444-444444444444','kind','habits','id','44444444-4444-4444-8444-444444444444','day','','data',jsonb_build_object('title','imported','icon','x','timeGroup','day','scheduledTime',null,'alarmEnabled',false,'position',1),'deleted',false,'version',0));
 items:=items||jsonb_build_array(jsonb_build_object('key','days:2026-11-10:2026-11-10','kind','days','id','2026-11-10','day','2026-11-10','data',jsonb_build_object('timezone',null),'deleted',false,'version',0));
 content:=items::text;
 -- Authenticated clients cannot access extension helpers, so use the built-in sha256.
 hash:=encode(sha256(convert_to(content,'UTF8')),'hex');
 batch:=public.begin_import('source-test',hash,2);
 perform public.stage_import(batch,0,items);
 begin perform public.commit_import(batch,'[]');raise exception 'TEST FAILED: invalid hash accepted';exception when others then if sqlerrm='TEST FAILED: invalid hash accepted'then raise;end if;end;
 r:=public.commit_import(batch,content);perform pg_temp.assert(r->>'status'='applied','import completes');
 perform public.stage_import(batch,0,items);
 perform pg_temp.assert(public.commit_import(batch,content)=r,'lost import response is retryable');
 perform pg_temp.assert(public.begin_import('source-test',hash,2)=batch,'duplicate import uses same batch');
 perform public.change_timezone('UTC',1);
 begin perform public.change_timezone('Asia/Seoul',1);raise exception 'TEST FAILED: stale profile';exception when others then if sqlerrm='TEST FAILED: stale profile'then raise;end if;end;
 select jsonb_build_object('id',gen_random_uuid(),'changes',jsonb_agg(jsonb_build_object('key','habits::'||id,'kind','habits','id',id,'day','','base',null,'data',jsonb_build_object('title','page','icon','x','timeGroup','day','scheduledTime',null,'alarmEnabled',false,'position',n),'deleted',false)))into p from(select gen_random_uuid()::text id,n from generate_series(1,205)n)a;
 perform public.apply_operation(p);
 page:=public.pull_changes(-1);snapshot:=(page->>'snapshot')::uuid;
 perform pg_temp.assert(jsonb_array_length(page->'entities')=200 and page->>'next_offset'='200','first page bounded');
 -- Snapshot is owner-bound, and the continuation includes all remaining rows.
 page:=public.pull_changes(-1,snapshot,200);
 perform pg_temp.assert(jsonb_array_length(page->'entities')=9 and page->'next_offset'='null'::jsonb,'final page complete');
end $$;
-- All unauthenticated access is denied, not just hidden by the UI.
set local role anon;
do $$begin
 begin perform * from public.habits;raise exception 'TEST FAILED: anon read';exception when insufficient_privilege then null;end;
 begin perform public.pull_changes(-1);raise exception 'TEST FAILED: anon RPC';exception when insufficient_privilege then null;end;
end $$;
rollback;
