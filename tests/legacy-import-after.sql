begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$declare fixture record;r jsonb;c jsonb;content text;op jsonb;begin
 select * into fixture from public.review_upgrade_fixture;
 if not exists(select 1 from public.import_batches where id=fixture.batch and status='conflict')then raise exception 'upgrade failed to repair false completion';end if;
 if fixture.habits is distinct from(select jsonb_agg(to_jsonb(h))from public.habits h)or fixture.items is distinct from(select jsonb_agg(to_jsonb(i))from public.import_items i)then raise exception 'upgrade modified original data';end if;
 if fixture.result is distinct from(select result from public.sync_operations where operation_id=fixture.batch)then raise exception 'upgrade rewrote immutable outcome';end if;
 c:=fixture.result->'conflict';op:=jsonb_build_object('id',gen_random_uuid(),'conflictId',c->>'id','changes',jsonb_build_array((c->'operation'->'changes'->0)||jsonb_build_object('base',c->'remote'->0)));
 r:=public.apply_operation(op);
 if r->>'status'<>'applied' or public.apply_operation(op)<>r then raise exception 'upgrade resolution is not idempotent';end if;
 select items::text into content from public.import_items where batch_id=fixture.batch;
 r:=public.commit_import(fixture.batch,content);
 if r->>'status'<>'applied'or not(r->>'verified')::boolean then raise exception 'upgraded import did not verify';end if;
end $$;
rollback;
