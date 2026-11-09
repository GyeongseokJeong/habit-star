-- Isolated --postgres upgrade fixture. Execute ONLY after 001, before 002/003.
insert into auth.users(id,email,email_confirmed_at)values('44444444-4444-4444-8444-444444444444','legacy-upgrade@example.test',now());
create table public.review_upgrade_fixture(batch uuid,habits jsonb,items jsonb,result jsonb);
grant select,insert on public.review_upgrade_fixture to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
select public.initialize_profile('UTC');
do $$declare e jsonb;content text;batch uuid;r jsonb;begin
 e:='{"key":"habits::33333333-3333-4333-8333-333333333333","kind":"habits","id":"33333333-3333-4333-8333-333333333333","day":"","data":{"title":"legacy cloud","icon":"x","timeGroup":"day","scheduledTime":null,"alarmEnabled":false,"position":0},"version":0,"deleted":false}';
 perform public.apply_operation(jsonb_build_object('id',gen_random_uuid(),'changes',jsonb_build_array((e-'version')||jsonb_build_object('base',null))));
 e:=jsonb_set(e,'{data,title}','"legacy source"');content:=jsonb_build_array(e)::text;
 batch:=public.begin_import('pre-review-source',encode(sha256(convert_to(content,'UTF8')),'hex'),1);
 perform public.stage_import(batch,0,jsonb_build_array(e));r:=public.commit_import(batch,content);
 if r->>'status'<>'conflict' or not exists(select 1 from public.import_batches b where b.id=batch and b.status='complete')then raise exception 'legacy fixture did not reproduce original defect';end if;
 insert into public.review_upgrade_fixture select batch,(select jsonb_agg(to_jsonb(h))from public.habits h),(select jsonb_agg(to_jsonb(i))from public.import_items i),r;
end $$;
reset role;
