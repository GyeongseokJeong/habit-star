begin;
insert into auth.users(id,email,email_confirmed_at)values('88888888-8888-4888-8888-888888888888','security-review@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
select public.initialize_profile('UTC');
do $$declare p jsonb;begin
 p:='{"id":"99999999-9999-4999-8999-999999999999","changes":[{"key":"habits::aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"habits","id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","day":"","base":null,"data":{"title":"invalid group","icon":"x","timeGroup":null,"scheduledTime":null,"alarmEnabled":false,"position":0},"deleted":false}]}';
 begin perform public.apply_operation(p);raise exception 'TEST FAILED: null time group accepted';exception when others then if sqlerrm='TEST FAILED: null time group accepted'then raise;end if;end;
 begin perform public.apply_operation(jsonb_build_object('id',gen_random_uuid()));raise exception 'TEST FAILED: missing changes accepted';exception when others then if sqlerrm='TEST FAILED: missing changes accepted'then raise;end if;end;
 if exists(select 1 from public.habits)then raise exception 'TEST FAILED: invalid input wrote data';end if;
end $$;
rollback;
