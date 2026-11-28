-- Synthetic account deletion regression; transaction rolled back on either
-- the lightweight PostgreSQL or full local Supabase test database.
begin;

create function pg_temp.assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'TEST FAILED: %', message;
  end if;
end $$;

insert into auth.users(id, email, email_confirmed_at) values
  ('a1000000-0000-4000-8000-000000000001', 'delete-owner-a@example.test', now()),
  ('a1000000-0000-4000-8000-000000000002', 'delete-owner-b@example.test', now());

-- Populate every member-data relation, including historical and staging rows,
-- for both accounts using deliberately identical entity/batch IDs.
do $$
declare
  u uuid;
  habit uuid := 'a2000000-0000-4000-8000-000000000001';
  batch uuid := 'a2000000-0000-4000-8000-000000000002';
  payload jsonb;
begin
  for u in select id from auth.users where id in (
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002'
  ) loop
    payload := jsonb_build_object('synthetic', u::text);
    insert into public.profiles values (u, 'UTC', 1);
    insert into public.habits(user_id,id,data,version) values (u,habit,payload,1);
    insert into public.days(user_id,local_date,data,version) values (u,date '2026-11-28',payload,1);
    insert into public.habit_entries(user_id,local_date,habit_id,data,version)
      values (u,date '2026-11-28',habit,payload,1);
    insert into public.sync_state(user_id,revision) values (u,1);
    insert into public.sync_operations(user_id,operation_id,request,result) values (u,habit,payload,payload);
    insert into public.sync_changes(user_id,revision,entities) values (u,1,jsonb_build_array(payload));
    insert into public.conflicts(user_id,id,operation,remote,resolved) values (u,habit,payload,payload,false);
    insert into public.import_batches(user_id,id,source_id,hash,total) values (u,batch,'synthetic','hash',1);
    insert into public.import_items(user_id,batch_id,chunk,items) values (u,batch,0,jsonb_build_array(payload));
    insert into public.sync_snapshots(user_id,id,entities,cursor,conflicts)
      values (u,habit,jsonb_build_array(payload),1,'[]');
  end loop;
end $$;

-- Capture the complete B row content, not merely counts.
create temporary table deletion_fixture_before(table_name text, user_id uuid, rows jsonb);
do $$
declare
  t text;
  u uuid;
  rows jsonb;
begin
  for t in select c.relname from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped
    where n.nspname='public' and c.relkind='r'
  loop
    for u in select id from auth.users where id in (
      'a1000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002'
    ) loop
      execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r where user_id=$1',t)
        into rows using u;
      perform pg_temp.assert(jsonb_array_length(rows) > 0, 'fixture covers ' || t);
      insert into deletion_fixture_before values(t,u,rows);
    end loop;
  end loop;
  perform pg_temp.assert((select count(distinct table_name)=11 from deletion_fixture_before), 'all current account relations covered');
end $$;

-- A member cannot physically delete accounts or use direct table writes.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$
begin
  begin
    delete from auth.users where id='a1000000-0000-4000-8000-000000000002';
    raise exception 'TEST FAILED: authenticated account deletion';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.habits;
    raise exception 'TEST FAILED: authenticated direct row deletion';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Ordinary physical parent deletion remains restricted; this migration is
-- not a change to habit cleanup policy.
do $$
begin
  begin
    delete from public.habits where user_id='a1000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: non-account parent deletion';
  exception when foreign_key_violation then null;
  end;
  begin
    delete from public.import_batches where user_id='a1000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: non-account batch deletion';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Rollback of an account deletion must leave all original rows intact.
savepoint deletion_test;
delete from auth.users where id='a1000000-0000-4000-8000-000000000001';
rollback to deletion_test;
do $$
declare r record; actual jsonb;
begin
  for r in select * from deletion_fixture_before loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]''::jsonb) from public.%I x where user_id=$1',r.table_name)
      into actual using r.user_id;
    perform pg_temp.assert(actual = r.rows, 'rollback preserved ' || r.table_name);
  end loop;
end $$;

-- The administrator hard-deletes precisely the verified account. This
-- fixture is sandbox-only; production uses the Auth admin deletion workflow.
delete from auth.users where id='a1000000-0000-4000-8000-000000000001';
select pg_temp.assert(not exists(select 1 from auth.users where id='a1000000-0000-4000-8000-000000000001'),'account removed');

do $$
declare r record; actual jsonb;
begin
  for r in select * from deletion_fixture_before loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]''::jsonb) from public.%I x where user_id=$1',r.table_name)
      into actual using r.user_id;
    if r.user_id='a1000000-0000-4000-8000-000000000001' then
      perform pg_temp.assert(actual='[]'::jsonb,'target removed: ' || r.table_name);
    else
      perform pg_temp.assert(actual=r.rows,'other account unchanged: ' || r.table_name);
    end if;
  end loop;
end $$;

-- Replay the removed account's JWT claim through each public RPC; the
-- authenticated role must not resurrect data or read an old snapshot.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$
declare
  sql text;
  t text;
  n bigint;
begin
  foreach sql in array array[
    'select public.initialize_profile(''UTC'')',
    'select public.change_timezone(''UTC'',1)',
    'select public.apply_operation(''{}''::jsonb)',
    'select public.pull_changes(-1)',
    'select public.begin_import(''source'',''hash'',1)',
    'select public.stage_import(''a2000000-0000-4000-8000-000000000002'',0,''[]''::jsonb)',
    'select public.commit_import(''a2000000-0000-4000-8000-000000000002'',''[]'')'
  ] loop
    begin
      execute sql;
      raise exception 'TEST FAILED: removed account RPC';
    exception when insufficient_privilege then
      perform pg_temp.assert(sqlerrm='auth_required','deleted principal guard');
    end;
  end loop;
  foreach t in array array['profiles','habits','days','habit_entries','sync_state','sync_operations','sync_changes','conflicts','import_batches','import_items','sync_snapshots'] loop
    execute format('select count(*) from public.%I',t) into n;
    perform pg_temp.assert(n=0,'deleted principal cannot read ' || t);
  end loop;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select pg_temp.assert(public.initialize_profile('UTC')='UTC','other account remains active');
select pg_temp.assert(jsonb_array_length(public.pull_changes(-1)->'entities')=3,'other account records remain visible');
reset role;
rollback;
