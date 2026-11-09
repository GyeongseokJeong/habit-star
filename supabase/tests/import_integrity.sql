begin;
insert into auth.users(id,email,email_confirmed_at)values('55555555-5555-4555-8555-555555555555','import-review@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select public.initialize_profile('UTC');
create function pg_temp.assert(ok boolean,message text)returns void language plpgsql as $$begin if not coalesce(ok,false)then raise exception 'TEST FAILED: %',message;end if;end$$;
do $$declare hid text:='66666666-6666-4666-8666-666666666666';row jsonb;p jsonb;items jsonb;content text;hash text;batch uuid;r jsonb;c jsonb;resolution jsonb;begin
 row:=jsonb_build_object('key','habits::'||hid,'kind','habits','id',hid,'day','','data',jsonb_build_object('title','cloud','icon','x','timeGroup','day','scheduledTime',null,'alarmEnabled',false,'position',0),'deleted',false,'version',0);
 p:=jsonb_build_object('id',gen_random_uuid(),'changes',jsonb_build_array((row-'version')||jsonb_build_object('base',null)));
 perform public.apply_operation(p);
 items:=jsonb_build_array(jsonb_set(row,'{data,title}','"source"'));content:=items::text;hash:=encode(sha256(convert_to(content,'UTF8')),'hex');
 batch:=public.begin_import('review-source',hash,1);perform public.stage_import(batch,0,items);r:=public.commit_import(batch,content);
 perform pg_temp.assert(r->>'status'='conflict','same ID with other data conflicts');
 perform pg_temp.assert((select status<>'complete'from public.import_batches where import_batches.id=batch),'conflict must not complete import');
 perform pg_temp.assert((select data->>'title'='cloud'from public.habits where habits.id=hid::uuid),'conflict preserves server row');
 c:=r->'conflict';
 -- A resolver cannot use an unrelated command to falsely mark an import resolved.
 begin
 perform public.apply_operation(jsonb_build_object('id',gen_random_uuid(),'conflictId',c->>'id','changes',jsonb_build_array((c->'operation'->'changes'->0)||jsonb_build_object('key','habits::77777777-7777-4777-8777-777777777777','id','77777777-7777-4777-8777-777777777777','base',null))));
 raise exception 'TEST FAILED: unrelated resolution accepted';
 exception when others then if sqlerrm='TEST FAILED: unrelated resolution accepted'then raise;end if;end;
 perform pg_temp.assert((select not resolved from public.conflicts where conflicts.id=(c->>'id')::uuid),'invalid resolution preserves conflict');
 resolution:=jsonb_build_object('id',gen_random_uuid(),'conflictId',c->>'id','changes',jsonb_build_array((c->'operation'->'changes'->0)||jsonb_build_object('base',c->'remote'->0)));
 r:=public.apply_operation(resolution);perform pg_temp.assert(r->>'status'='applied','explicit resolution applied');
 perform pg_temp.assert(public.apply_operation(resolution)=r,'lost resolution response retries idempotently');
 r:=public.commit_import(batch,content);perform pg_temp.assert(r->>'status'='applied'and(r->>'verified')::boolean,'resolved batch resumes and verifies');
 perform pg_temp.assert((select status='complete'from public.import_batches where import_batches.id=batch),'only verified applied batch complete');
 perform pg_temp.assert(public.commit_import(batch,content)=r,'repeating a verified batch is idempotent');
 begin perform public.commit_import(batch,'[]');raise exception 'TEST FAILED: completed import accepted changed content';exception when others then if sqlerrm='TEST FAILED: completed import accepted changed content'then raise;end if;end;
 begin perform public.stage_import(batch,1,items);raise exception 'TEST FAILED: completed import accepted new chunk';exception when others then if sqlerrm='TEST FAILED: completed import accepted new chunk'then raise;end if;end;
 perform pg_temp.assert(not has_schema_privilege('authenticated','private','usage'),'private schema is not callable');
 begin perform private.apply('{}',auth.uid());raise exception 'TEST FAILED: private apply bypass accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.assert(not has_function_privilege('anon','public.commit_import(uuid,text)','execute'),'anon cannot import');
 perform pg_temp.assert((select count(*)=1 from public.habits),'no duplicate ID created');
 perform pg_temp.assert((select data->>'title'='source'from public.habits),'resolved data matches chosen source');
end $$;
rollback;
