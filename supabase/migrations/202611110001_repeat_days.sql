-- Keep the existing JSON payload and ownership rules; missing repeatDays means every day.
create or replace function private.validate(k text,p jsonb) returns void language plpgsql set search_path='' as $$
declare day_count integer; unique_count integer;
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
 if p ? 'repeatDays' then
  if jsonb_typeof(p->'repeatDays') is distinct from 'array' then raise exception 'invalid_repeat_days';end if;
  select count(*),count(distinct value) into day_count,unique_count
  from jsonb_array_elements(p->'repeatDays') as d(value)
  where jsonb_typeof(value)='number' and value::text ~ '^[0-6]$';
  if day_count not between 1 and 7 or day_count<>unique_count or day_count<>jsonb_array_length(p->'repeatDays')
  then raise exception 'invalid_repeat_days';end if;
 end if;
 if k='habit_entries'and(not(p ?& array['completed','rating','memo'])or jsonb_typeof(p->'completed')<>'boolean'or jsonb_typeof(p->'memo')<>'string'or length(p->>'memo')>500 or jsonb_typeof(p->'rating')<>'number'or (p->>'rating')!~'^[0-5]$'or ((p->>'rating')::int>0 and not(p->>'completed')::boolean))then raise exception 'invalid_practice';end if;
end $$;
