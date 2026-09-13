-- All fixtures and notifications roll back; no outgoing network calls.
begin;
do $$
declare recipient uuid; result text; first_trip uuid:=gen_random_uuid(); second_trip uuid:=gen_random_uuid();
begin
 select user_id into recipient from public.dispatch_admin_users limit 1;
 if recipient is null then raise exception 'Administrator fixture is required'; end if;
 insert into public.dispatch_push_devices(endpoint,user_id,subscription,session_id) values('https://fcm.googleapis.com/progress-rollback-only',recipient,'{}',gen_random_uuid());
 insert into public.dispatch_push_preferences(user_id,trip_progress) values(recipient,true) on conflict(user_id) do update set trip_progress=true;
 insert into public.dispatch_vehicles(id,vehicle_number) values('push-test-v1','PUSH-TEST-1'),('push-test-v2','PUSH-TEST-2');
 insert into public.dispatch_drivers(id,name,assigned_vehicle_id) values('push-test-d1','알림 검증 1','push-test-v1'),('push-test-d2','알림 검증 2','push-test-v2');
 insert into public.dispatch_orders(id,dispatch_date,vendor_name,loading_location,unloading_location,item_name,total_volume,volume_per_trip,estimated_trip_count)
 values('push-progress-rollback',current_date,'검증 거래처','상차','하차','모래',170,17,10);
 insert into public.dispatch_trips(id,dispatch_order_id,vehicle_id,driver_id,trip_no,actual_volume,status,loading_completed_at,unloading_completed_at)
 values(first_trip,'push-progress-rollback','push-test-v1','push-test-d1',1,17,'완료',now(),now());
 result:=public.dispatch_push_progress('push-progress-rollback');
 if result not like '%잔여 153루베%' or result not like '%약 9탕%' then raise exception 'First trip incorrect: %',result; end if;
 insert into public.dispatch_trips(id,dispatch_order_id,vehicle_id,driver_id,trip_no,actual_volume,status,loading_completed_at,unloading_completed_at)
 values(second_trip,'push-progress-rollback','push-test-v2','push-test-d2',1,17,'완료',now(),now());
 update public.dispatch_trips set status='완료' where id=first_trip;
 result:=public.dispatch_push_progress('push-progress-rollback');
 if result not like '%누적 34 / 170루베%' or result not like '%잔여 136루베%' or result not like '%약 8탕%' then raise exception 'Shared aggregate incorrect: %',result; end if;
 if (select count(*) from public.dispatch_push_notices where order_id='push-progress-rollback' and user_id=recipient and title='운송 잔여 물량')<>2 then raise exception 'Duplicate completion notice'; end if;
 update public.dispatch_orders set total_volume=20 where id='push-progress-rollback';
 result:=public.dispatch_push_progress('push-progress-rollback');
 if result not like '%초과 14루베%' or result not like '%약 0탕%' then raise exception 'Overage incorrect: %',result; end if;
 update public.dispatch_push_preferences set trip_progress=false where user_id=recipient;
 insert into public.dispatch_trips(id,dispatch_order_id,vehicle_id,driver_id,trip_no,actual_volume,status,loading_completed_at,unloading_completed_at)
 values(gen_random_uuid(),'push-progress-rollback','push-test-v1','push-test-d1',2,17,'완료',now(),now());
 if (select count(*) from public.dispatch_push_notices where order_id='push-progress-rollback' and user_id=recipient and title='운송 잔여 물량')<>2 then raise exception 'Opt-out ignored'; end if;
 if has_table_privilege('authenticated','public.dispatch_push_preferences','select') or has_function_privilege('authenticated','public.dispatch_push_progress(text)','execute') then raise exception 'Private settings or aggregate exposed'; end if;
end $$;
rollback;
