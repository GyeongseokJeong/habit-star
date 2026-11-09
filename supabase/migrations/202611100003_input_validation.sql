-- Reject JSON null using explicit type checks; SQL NULL is not a false predicate.
create or replace function private.validate(k text,p jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p) is distinct from 'object'then raise exception 'invalid_data';end if;
 if k='days'then return;end if;
 if not (p ?& array['title','icon','timeGroup','scheduledTime','alarmEnabled','position'])
 or jsonb_typeof(p->'title')<>'string' or length(btrim(p->>'title'))not between 1 and 80
 or jsonb_typeof(p->'icon')<>'string' or length(p->>'icon')not between 1 and 100
 or jsonb_typeof(p->'timeGroup') is distinct from 'string' or p->>'timeGroup'not in('morning','day','night')
 or jsonb_typeof(p->'alarmEnabled')<>'boolean'
 or jsonb_typeof(p->'position')<>'number' or (p->>'position')!~'^\d+$'
 or (p->'scheduledTime'<>'null'::jsonb and (jsonb_typeof(p->'scheduledTime')<>'string' or (p->>'scheduledTime')!~'^([01]\d|2[0-3]):[0-5]\d$'))
 then raise exception 'invalid_definition';end if;
 if k='habit_entries'and(not(p ?& array['completed','rating','memo'])or jsonb_typeof(p->'completed')<>'boolean'or jsonb_typeof(p->'memo')<>'string'or length(p->>'memo')>500 or jsonb_typeof(p->'rating')<>'number'or (p->>'rating')!~'^[0-5]$'or ((p->>'rating')::int>0 and not(p->>'completed')::boolean))then raise exception 'invalid_practice';end if;
end $$;

create or replace function public.apply_operation(p_operation jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.owner(); original jsonb; expected jsonb; supplied jsonb;prior record;begin
 if jsonb_typeof(p_operation) is distinct from 'object' or not(p_operation ?& array['id','changes']) or jsonb_typeof(p_operation->'changes') is distinct from 'array' then raise exception 'invalid_operation';end if;
 if jsonb_array_length(p_operation->'changes')=0 then raise exception 'invalid_changes';end if;
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


revoke all on function public.apply_operation(jsonb)from public,anon;
grant execute on function public.apply_operation(jsonb)to authenticated;
revoke all on function private.validate(text,jsonb)from public,anon,authenticated;
