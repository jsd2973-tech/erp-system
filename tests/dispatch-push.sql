-- Transactional verification: no business records or subscriptions persist.
begin;
create temporary table push_order_fixture (like public.dispatch_orders including defaults);
create trigger capture_fixture after insert or update on push_order_fixture for each row execute function dispatch_push_private.capture_order();
do $$
declare recipient uuid; notice_count integer;
begin
 select user_id into recipient from public.dispatch_admin_users limit 1;
 if recipient is null then raise exception 'An existing administrator is required for this test'; end if;
 insert into public.dispatch_push_devices(endpoint,user_id,subscription,session_id)
 values('https://fcm.googleapis.com/test-rollback-only',recipient,'{}','00000000-0000-0000-0000-000000000000');
 insert into push_order_fixture(id,dispatch_date,vendor_name,loading_location,unloading_location,item_name,total_volume,volume_per_trip,estimated_trip_count,status)
 values('push-rollback-fixture',current_date,'테스트','상차','하차','모래',340,17,20,'대기');
 update push_order_fixture set total_volume=170 where id='push-rollback-fixture';
 update push_order_fixture set status='취소' where id='push-rollback-fixture';
 select count(*) into notice_count from public.dispatch_push_notices where order_id='push-rollback-fixture' and user_id=recipient;
 if notice_count<>3 then raise exception 'Expected 3 notices, got %',notice_count; end if;
 if not exists(select 1 from public.dispatch_push_notices where order_id='push-rollback-fixture' and body like '%340%→%170%') then raise exception 'Missing volume change'; end if;
 if has_table_privilege('authenticated','public.dispatch_push_devices','select') then raise exception 'Device data exposed'; end if;
 if has_table_privilege('anon','public.dispatch_push_notices','select') then raise exception 'Notice data exposed'; end if;
 if has_function_privilege('authenticated','public.dispatch_push_claim()','execute') then raise exception 'Queue claim exposed'; end if;
 if public.dispatch_push_session_valid(recipient,'00000000-0000-0000-0000-000000000000') then raise exception 'Invalid session accepted'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
do $$ begin
 if exists(select 1 from public.dispatch_push_notices where order_id='push-rollback-fixture') then raise exception 'Cross-account notice exposed'; end if;
end $$;
reset role;
rollback;
