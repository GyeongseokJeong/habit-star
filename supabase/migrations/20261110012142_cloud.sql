-- All writes are commands. No client can bypass the outbox/CAS protocol.
create schema if not exists private;
revoke all on schema private from public;
create table private.sync_controls(singleton boolean primary key default true check(singleton),writes_enabled boolean not null default true,imports_enabled boolean not null default true);
insert into private.sync_controls default values;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 timezone text not null, version bigint not null default 1
);
create table public.habits (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null, data jsonb not null, version bigint not null,
 deleted boolean not null default false, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
create table public.days (
 user_id uuid not null references auth.users(id) on delete cascade,
 local_date date not null, data jsonb not null, version bigint not null,
 deleted boolean not null default false, updated_at timestamptz not null default now(),
 primary key(user_id,local_date)
);
create table public.habit_entries (
 user_id uuid not null, local_date date not null, habit_id uuid not null,
 data jsonb not null, version bigint not null, deleted boolean not null default false,
 updated_at timestamptz not null default now(), primary key(user_id,local_date,habit_id),
 foreign key(user_id,habit_id) references public.habits(user_id,id),
 foreign key(user_id,local_date) references public.days(user_id,local_date)
);
create table public.sync_state(user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0);
create table public.sync_operations(user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null, request jsonb not null, result jsonb not null, primary key(user_id,operation_id));
create table public.sync_changes(user_id uuid not null references auth.users(id) on delete cascade, revision bigint not null, entities jsonb not null, primary key(user_id,revision));
create table public.conflicts(user_id uuid not null references auth.users(id) on delete cascade,id uuid not null,operation jsonb not null,remote jsonb not null,resolved boolean not null default false,primary key(user_id,id));
create table public.import_batches(user_id uuid not null references auth.users(id) on delete cascade,id uuid not null,source_id text not null,hash text not null,total integer not null check(total>=0),status text not null default 'staging',revision bigint,primary key(user_id,id),unique(user_id,source_id,hash));
create table public.import_items(user_id uuid not null,batch_id uuid not null,chunk integer not null,items jsonb not null,primary key(user_id,batch_id,chunk),foreign key(user_id,batch_id) references public.import_batches(user_id,id));
create table public.sync_snapshots(user_id uuid not null references auth.users(id) on delete cascade,id uuid not null,entities jsonb not null,cursor bigint not null,conflicts jsonb not null,created_at timestamptz not null default now(),primary key(user_id,id));
create index on public.conflicts(user_id,resolved);

-- RLS protects reads; only explicitly granted definer functions write.
do $$ declare t text; begin
 foreach t in array array['profiles','habits','days','habit_entries','sync_state','sync_operations','sync_changes','conflicts','import_batches','import_items','sync_snapshots'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create function private.owner() returns uuid language plpgsql stable set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'auth_required' using errcode='42501';end if;return u;
end $$;
create function public.initialize_profile(p_timezone text) returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();z text;begin
 if not exists(select 1 from pg_timezone_names where name=p_timezone)then raise exception 'invalid_timezone';end if;
 insert into public.profiles values(u,p_timezone,1) on conflict do nothing;
 insert into public.sync_state(user_id)values(u)on conflict do nothing;
 select timezone into z from public.profiles where user_id=u;return z;
end $$;
create function public.change_timezone(p_timezone text,p_version bigint)returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();begin
 if not exists(select 1 from pg_timezone_names where name=p_timezone)then raise exception 'invalid_timezone';end if;
 update public.profiles set timezone=p_timezone,version=version+1 where user_id=u and version=p_version;
 if not found then raise exception 'profile_conflict';end if;
end $$;
create function private.entity(k text,i text,d text,u uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare r record;begin
 if k='habits'then select data,version,deleted into r from public.habits where user_id=u and id=i::uuid;
 elsif k='habit_entries'then select data,version,deleted into r from public.habit_entries where user_id=u and habit_id=i::uuid and local_date=d::date;
 elsif k='days'then select data,version,deleted into r from public.days where user_id=u and local_date=d::date;
 else raise exception 'invalid_kind';end if;
 if not found then return null;end if;
 return jsonb_build_object('key',k||':'||d||':'||i,'kind',k,'id',i,'day',d,'data',r.data,'version',r.version,'deleted',r.deleted);
end $$;
create function private.validate(k text,p jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p)<>'object'then raise exception 'invalid_data';end if;
 if k='days'then return;end if;
 if not (p ?& array['title','icon','timeGroup','scheduledTime','alarmEnabled','position'])
 or jsonb_typeof(p->'title')<>'string' or length(btrim(p->>'title'))not between 1 and 80
 or jsonb_typeof(p->'icon')<>'string' or length(p->>'icon')not between 1 and 100
 or p->>'timeGroup'not in('morning','day','night')
 or jsonb_typeof(p->'alarmEnabled')<>'boolean'
 or jsonb_typeof(p->'position')<>'number' or (p->>'position')!~'^\d+$'
 or (p->'scheduledTime'<>'null'::jsonb and (jsonb_typeof(p->'scheduledTime')<>'string' or (p->>'scheduledTime')!~'^([01]\d|2[0-3]):[0-5]\d$'))
 then raise exception 'invalid_definition';end if;
 if k='habit_entries'and(not(p ?& array['completed','rating','memo'])or jsonb_typeof(p->'completed')<>'boolean'or jsonb_typeof(p->'memo')<>'string'or length(p->>'memo')>500 or jsonb_typeof(p->'rating')<>'number'or (p->>'rating')!~'^[0-5]$'or ((p->>'rating')::int>0 and not(p->>'completed')::boolean))then raise exception 'invalid_practice';end if;
end $$;
create function private.merge(b jsonb,l jsonb,r jsonb)returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;v jsonb:=r;begin
 for k in select jsonb_object_keys(b||l)loop
 if (b->k)is distinct from(l->k)then
 if k in('completed','rating')then
 if ((b->'completed')is distinct from(r->'completed')or(b->'rating')is distinct from(r->'rating'))and ((l->'completed')is distinct from(r->'completed')or(l->'rating')is distinct from(r->'rating'))then return null;end if;
 elsif(b->k)is distinct from(r->k)and(l->k)is distinct from(r->k)then return null;end if;
 v:=jsonb_set(v,array[k],coalesce(l->k,'null'::jsonb));end if;
 end loop;return v;
end $$;
create function private.write_entity(e jsonb,u uuid,v bigint)returns void language plpgsql set search_path='' as $$
begin
 perform private.validate(e->>'kind',e->'data');
 if e->>'kind'='habits'then
 insert into public.habits values(u,(e->>'id')::uuid,e->'data',v,(e->>'deleted')::boolean,now()) on conflict(user_id,id)do update set data=excluded.data,version=v,deleted=excluded.deleted,updated_at=now();
 elsif e->>'kind'='days'then
 insert into public.days values(u,(e->>'day')::date,e->'data',v,(e->>'deleted')::boolean,now())on conflict(user_id,local_date)do nothing;
 else
 insert into public.habit_entries values(u,(e->>'day')::date,(e->>'id')::uuid,e->'data',v,(e->>'deleted')::boolean,now())on conflict(user_id,local_date,habit_id)do update set data=excluded.data,version=v,deleted=excluded.deleted,updated_at=now();
 end if;
end $$;
create function private.apply(p jsonb,u uuid)returns jsonb language plpgsql set search_path='' as $$
declare prior record;c jsonb;r jsonb;m jsonb;outrows jsonb:='[]';writes jsonb:='[]';bad boolean:=false;v bigint;result jsonb;oid uuid:=(p->>'id')::uuid;cid uuid;keys text[]:='{}';
begin
 if not(select writes_enabled from private.sync_controls where singleton)then raise exception 'sync_paused';end if;
 insert into public.sync_state(user_id)values(u)on conflict do nothing;
 perform 1 from public.sync_state where user_id=u for update;
 select request,sync_operations.result into prior from public.sync_operations where user_id=u and operation_id=oid;
 if found then if prior.request<>p then raise exception 'operation_id_reused';end if;return prior.result;end if;
 if jsonb_typeof(p->'changes')<>'array'or jsonb_array_length(p->'changes')=0 then raise exception 'invalid_changes';end if;
 if p ? 'conflictId'then
 perform 1 from public.conflicts where user_id=u and id=(p->>'conflictId')::uuid and not resolved;
 if not found then raise exception 'conflict_already_resolved';end if;
 end if;
 for c in select value from jsonb_array_elements(p->'changes')loop
 if c->>'kind'='days' and c->>'id'<>c->>'day'then raise exception 'invalid_day_key';end if;
 if c->>'key'<> (c->>'kind')||':'||(c->>'day')||':'||(c->>'id')or (c->>'key')=any(keys)then raise exception 'invalid_key';end if;keys:=array_append(keys,c->>'key');
 perform private.validate(c->>'kind',c->'data');
 r:=private.entity(c->>'kind',c->>'id',c->>'day',u);
 if r is not null then outrows:=outrows||jsonb_build_array(r);end if;
 if coalesce((c->>'seed')::boolean,false)and r is not null then continue;end if;
 if coalesce((r->>'version')::bigint,0)<>coalesce((c->'base'->>'version')::bigint,0)then
 if r is not null and c->'base'<>'null'::jsonb and r->'deleted'=c->'deleted'and not(r->>'deleted')::boolean then
 m:=private.merge(c->'base'->'data',c->'data',r->'data');if m is null then bad:=true;else c:=jsonb_set(c,'{data}',m);end if;
 elsif r is not null and r->'data'=c->'data'and r->'deleted'=c->'deleted'then continue;
 else bad:=true;end if;
 end if;
 writes:=writes||jsonb_build_array(c);
 end loop;
 if bad then
 if p ? 'conflictId'then update public.conflicts set resolved=true where user_id=u and id=(p->>'conflictId')::uuid;end if;
 cid:=gen_random_uuid();insert into public.conflicts values(u,cid,p,outrows,false);
 result:=jsonb_build_object('status','conflict','conflict',jsonb_build_object('id',cid,'operation',p,'remote',outrows,'resolved',false));
 else
 update public.sync_state set revision=revision+1 where user_id=u returning revision into v;
 -- Parents before children, regardless of client order.
 for c in select value from jsonb_array_elements(writes)order by case value->>'kind'when 'habits'then 0 when 'days'then 1 else 2 end loop perform private.write_entity(c,u,v);end loop;
 outrows:='[]';for c in select value from jsonb_array_elements(p->'changes')loop r:=private.entity(c->>'kind',c->>'id',c->>'day',u);if r is not null then outrows:=outrows||jsonb_build_array(r);end if;end loop;
 insert into public.sync_changes values(u,v,outrows);
 if p ? 'conflictId'then update public.conflicts set resolved=true where user_id=u and id=(p->>'conflictId')::uuid;end if;
 result:=jsonb_build_object('status','applied','entities',outrows,'revision',v);
 end if;
 insert into public.sync_operations values(u,oid,p,result);return result;
end $$;
create function public.apply_operation(p_operation jsonb)returns jsonb language plpgsql security definer set search_path='' as $$begin return private.apply(p_operation,private.owner());end $$;
create function public.pull_changes(p_cursor bigint,p_snapshot uuid default null,p_offset integer default 0)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();v bigint;rows jsonb;cs jsonb;sid uuid:=p_snapshot;page jsonb;n integer;begin
 if p_offset<0 then raise exception 'invalid_offset';end if;
 if sid is not null then
 select entities,cursor,conflicts into rows,v,cs from public.sync_snapshots where user_id=u and id=sid and created_at>now()-interval '1 day';
 if not found then raise exception 'snapshot_expired';end if;
 else
 perform 1 from public.sync_state where user_id=u for update;
 select coalesce(revision,0)into v from public.sync_state where user_id=u;
 if p_cursor<0 then
 select coalesce(jsonb_agg(e),'[]')into rows from(
 select private.entity('habits',id::text,'',u)e from public.habits where user_id=u
 union all select private.entity('days',local_date::text,local_date::text,u)from public.days where user_id=u
 union all select private.entity('habit_entries',habit_id::text,local_date::text,u)from public.habit_entries where user_id=u)s;
 else
 select coalesce(jsonb_agg(e order by s.revision,ord),'[]')into rows from public.sync_changes s cross join lateral jsonb_array_elements(s.entities)with ordinality as a(e,ord) where s.user_id=u and revision>p_cursor;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'operation',operation,'remote',remote,'resolved',resolved)),'[]')into cs from public.conflicts where user_id=u;
 if jsonb_array_length(rows)>200 then
 sid:=gen_random_uuid();delete from public.sync_snapshots where user_id=u and created_at<now()-interval '1 day';
 insert into public.sync_snapshots(user_id,id,entities,cursor,conflicts)values(u,sid,rows,coalesce(v,0),cs);
 end if;
 end if;
 n:=jsonb_array_length(rows);
 select coalesce(jsonb_agg(e order by ord),'[]')into page from jsonb_array_elements(rows)with ordinality as a(e,ord)where ord>p_offset and ord<=p_offset+200;
 return jsonb_build_object('entities',page,'cursor',coalesce(v,0),'conflicts',cs,'snapshot',sid,'next_offset',case when p_offset+200<n then p_offset+200 else null end);

end $$;
create function public.begin_import(p_source text,p_hash text,p_total integer)returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();i uuid;begin
 if not(select imports_enabled from private.sync_controls where singleton)then raise exception 'import_paused';end if;
 insert into public.import_batches(user_id,id,source_id,hash,total)values(u,gen_random_uuid(),p_source,p_hash,p_total)on conflict(user_id,source_id,hash)do nothing;
 select id into i from public.import_batches where user_id=u and source_id=p_source and hash=p_hash and total=p_total;if i is null then raise exception 'import_mismatch';end if;return i;
end $$;
create function public.stage_import(p_batch uuid,p_chunk integer,p_items jsonb)returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();prior jsonb;begin
 perform 1 from public.import_batches where user_id=u and id=p_batch for update;if not found then raise exception 'invalid_batch';end if;
 if p_chunk<0 or jsonb_typeof(p_items)<>'array'or jsonb_array_length(p_items)>200 then raise exception 'invalid_chunk';end if;
 select items into prior from public.import_items where user_id=u and batch_id=p_batch and chunk=p_chunk;
 if found and prior<>p_items then raise exception 'chunk_mismatch';end if;
 insert into public.import_items values(u,p_batch,p_chunk,p_items)on conflict do nothing;
end $$;
create function public.commit_import(p_batch uuid,p_content text)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();b record;items jsonb;p jsonb;result jsonb;begin
 if not(select imports_enabled from private.sync_controls where singleton)then raise exception 'import_paused';end if;
 select * into b from public.import_batches where user_id=u and id=p_batch for update;if not found then raise exception 'invalid_batch';end if;
 if b.status='complete'then select sync_operations.result into result from public.sync_operations where user_id=u and operation_id=p_batch;return result;end if;
 select coalesce(jsonb_agg(e order by i.chunk,ord),'[]')into items from public.import_items i cross join lateral jsonb_array_elements(i.items)with ordinality as a(e,ord)where i.user_id=u and i.batch_id=p_batch;
 if jsonb_array_length(items)<>b.total then raise exception 'incomplete_import';end if;
 if p_content::jsonb<>items or encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex')<>b.hash then raise exception 'import_hash_mismatch';end if;
 select jsonb_build_object('id',p_batch,'changes',coalesce(jsonb_agg(jsonb_build_object('key',e->>'key','kind',e->>'kind','id',e->>'id','day',e->>'day','data',e->'data','deleted',e->'deleted','base',null,'seed',e->>'kind'='days')),'[]'))into p from jsonb_array_elements(items)e;
 result:=private.apply(p,u);
 update public.import_batches set status='complete',revision=(result->>'revision')::bigint where user_id=u and id=p_batch;return result;
end $$;
-- No implicit EXECUTE grants: private helpers cannot be invoked through PostgREST.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.initialize_profile(text),public.change_timezone(text,bigint),public.apply_operation(jsonb),public.pull_changes(bigint,uuid,integer),public.begin_import(text,text,integer),public.stage_import(uuid,integer,jsonb),public.commit_import(uuid,text)from public,anon;
grant execute on function public.initialize_profile(text),public.change_timezone(text,bigint),public.apply_operation(jsonb),public.pull_changes(bigint,uuid,integer),public.begin_import(text,text,integer),public.stage_import(uuid,integer,jsonb),public.commit_import(uuid,text)to authenticated;
