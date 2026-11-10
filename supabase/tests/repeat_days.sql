begin;
do $$
declare payload jsonb := '{"title":"읽기","icon":"📚","timeGroup":"night","scheduledTime":null,"alarmEnabled":false,"position":0}'; days jsonb;
begin
 perform private.validate('habits',payload);
 perform private.validate('habit_entries',payload || '{"completed":false,"rating":0,"memo":""}'::jsonb);
 perform private.validate('habits',payload || '{"repeatDays":[1,3,5]}'::jsonb);
 foreach days in array array['[]','[1,1]','[7]','[-1]','[1.5]','null','"월"','[0,true]']::jsonb[] loop
  begin
   perform private.validate('habits',payload || jsonb_build_object('repeatDays',days));
   raise exception 'TEST FAILED: invalid repeatDays accepted: %',days;
  exception when others then
   if sqlerrm like 'TEST FAILED:%' then raise; end if;
  end;
 end loop;
end $$;
rollback;
