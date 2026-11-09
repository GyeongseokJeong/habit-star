-- Repair lifecycle metadata only; never modify source rows or immutable operation results.
update public.import_batches b set status='conflict',revision=null
from public.sync_operations o where b.user_id=o.user_id and b.id=o.operation_id
and b.status='complete' and o.result->>'status'='conflict';

-- Resolving a conflict must address that conflict's exact entity set.
create or replace function public.apply_operation(p_operation jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner(); original jsonb; expected jsonb; supplied jsonb;prior record;begin
 select request,result into prior from public.sync_operations where user_id=u and operation_id=(p_operation->>'id')::uuid;
 if found then if prior.request<>p_operation then raise exception 'operation_id_reused';end if;return prior.result;end if;
 if p_operation ? 'conflictId' then
 select operation into original from public.conflicts where user_id=u and id=(p_operation->>'conflictId')::uuid and not resolved;
 if not found then raise exception 'conflict_already_resolved';end if;
 select jsonb_agg(c->>'key'order by c->>'key')into expected from jsonb_array_elements(original->'changes')c;
 select jsonb_agg(c->>'key'order by c->>'key')into supplied from jsonb_array_elements(p_operation->'changes')c;
 if expected is distinct from supplied then raise exception 'invalid_resolution_targets';end if;
 end if;
 return private.apply(p_operation,u);
end $$;

create or replace function public.stage_import(p_batch uuid,p_chunk integer,p_items jsonb)returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();b record;prior jsonb;expected integer;begin
 select * into b from public.import_batches where user_id=u and id=p_batch for update;
 if not found then raise exception 'invalid_batch';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or p_chunk<0 then raise exception 'invalid_chunk';end if;
 select items into prior from public.import_items where user_id=u and batch_id=p_batch and chunk=p_chunk;
 if found then if prior<>p_items then raise exception 'chunk_mismatch';end if;return;end if;
 if b.status<>'staging' then raise exception 'import_not_staging';end if;
 expected:=least(200,b.total-p_chunk*200);
 if expected<=0 or jsonb_array_length(p_items)<>expected then raise exception 'invalid_chunk';end if;
 insert into public.import_items values(u,p_batch,p_chunk,p_items);
end $$;

create or replace function public.commit_import(p_batch uuid,p_content text)returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner();b record;items jsonb;p jsonb;r jsonb;next_result jsonb;
 current_rows jsonb:='[]';proof jsonb;actual jsonb;v bigint;steps integer:=0;begin
 if not(select imports_enabled from private.sync_controls where singleton)then raise exception 'import_paused';end if;
 select * into b from public.import_batches where user_id=u and id=p_batch for update;
 if not found then raise exception 'invalid_batch';end if;
 insert into public.sync_state(user_id)values(u)on conflict do nothing;
 perform 1 from public.sync_state where user_id=u for update;
 select coalesce(jsonb_agg(e order by i.chunk,ord),'[]')into items from public.import_items i
 cross join lateral jsonb_array_elements(i.items)with ordinality as a(e,ord)where i.user_id=u and i.batch_id=p_batch;
 if jsonb_array_length(items)<>b.total then raise exception 'incomplete_import';end if;
 -- Validate the frozen content on EVERY retry, including an already completed batch.
 if p_content::jsonb<>items or encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex')<>b.hash then raise exception 'import_hash_mismatch';end if;
 select result into r from public.sync_operations where user_id=u and operation_id=p_batch;
 if not found then
 select jsonb_build_object('id',p_batch,'changes',coalesce(jsonb_agg(jsonb_build_object('key',e->>'key','kind',e->>'kind','id',e->>'id','day',e->>'day','data',e->'data','deleted',e->'deleted','base',null,'seed',e->>'kind'='days')),'[]'))into p from jsonb_array_elements(items)e;
 if b.total=0 then
 select revision into v from public.sync_state where user_id=u;
 r:=jsonb_build_object('status','applied','entities','[]'::jsonb,'revision',v);
 insert into public.sync_operations values(u,p_batch,p,r);
 else r:=private.apply(p,u);end if;
 end if;
 -- Conflicts are immutable outcomes. Follow explicit, owner-scoped resolution operations
 -- instead of replaying the same cached conflict forever or inventing new import IDs.
 while r->>'status'='conflict' loop
 select o.result into next_result from public.sync_operations o
 where o.user_id=u and o.request->>'conflictId'=r->'conflict'->>'id';
 if not found then
 update public.import_batches set status='conflict',revision=null where user_id=u and id=p_batch;
 return r;
 end if;
 r:=next_result;steps:=steps+1;
 if steps>100 then raise exception 'import_resolution_chain_too_long';end if;
 end loop;
 if r->>'status' is distinct from 'applied' then raise exception 'import_not_applied';end if;
 if jsonb_array_length(r->'entities')<>b.total then raise exception 'import_verification_failed';end if;
 if b.total>0 and not exists(select 1 from public.sync_changes where user_id=u and revision=(r->>'revision')::bigint and entities=r->'entities')then raise exception 'import_verification_failed';end if;
 for proof in select value from jsonb_array_elements(r->'entities')loop
 if not exists(select 1 from jsonb_array_elements(items)e where e->>'key'=proof->>'key')then raise exception 'import_verification_failed';end if;
 actual:=private.entity(proof->>'kind',proof->>'id',proof->>'day',u);
 if actual is null or (actual->>'version')::bigint<(proof->>'version')::bigint then raise exception 'import_verification_failed';end if;
 if actual->>'version'=proof->>'version' and actual<>proof then raise exception 'import_verification_failed';end if;
 -- Newer legitimate edits are accepted only with their own immutable server change proof.
 if (actual->>'version')::bigint>(proof->>'version')::bigint and not exists(select 1 from public.sync_changes where user_id=u and revision=(actual->>'version')::bigint and entities@>jsonb_build_array(actual))then raise exception 'import_verification_failed';end if;
 current_rows:=current_rows||jsonb_build_array(actual);
 end loop;
 update public.import_batches set status='complete',revision=(r->>'revision')::bigint where user_id=u and id=p_batch;
 return r||jsonb_build_object('entities',current_rows,'verified',true,'batchId',p_batch);
end $$;
revoke all on function public.apply_operation(jsonb),public.stage_import(uuid,integer,jsonb),public.commit_import(uuid,text)from public,anon;
grant execute on function public.apply_operation(jsonb),public.stage_import(uuid,integer,jsonb),public.commit_import(uuid,text)to authenticated;
