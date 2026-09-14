-- Allow every authenticated ERP account with a registered device to receive the push types it selected.
-- Existing per-account preferences remain authoritative in the worker.

create or replace function dispatch_push_private.capture_order() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text; message text; notice uuid; recipient uuid;
begin
 if tg_op='INSERT' then kind:='새 배차';
 elsif new.status='취소' and old.status is distinct from new.status then kind:='배차 취소';
 elsif new.deleted_at is not null and old.deleted_at is null then kind:='배차 취소';
 elsif new.total_volume is distinct from old.total_volume then kind:='물량 변경';
 else return null;
 end if;
 message:=new.vendor_name||' · '||new.item_name||' · '||new.total_volume::text||'루베';
 if kind='물량 변경' then message:=new.vendor_name||' · '||new.item_name||' '||old.total_volume::text||' → '||new.total_volume::text||'루베'; end if;
 for recipient in
  select distinct d.user_id
  from public.dispatch_push_devices d
 loop
  insert into public.dispatch_push_notices(user_id,order_id,event_key,title,body)
   values(recipient,new.id,txid_current()::text||':'||new.id||':'||kind,kind,message)
   on conflict(user_id,event_key) do nothing returning id into notice;
  if notice is not null then
   insert into public.dispatch_push_deliveries(notice_id,endpoint)
    select notice,endpoint from public.dispatch_push_devices where user_id=recipient;
  end if;
 end loop;
 return null;
exception when others then
 raise warning 'dispatch push capture failed: %',sqlstate;
 return null;
end;
$$;
revoke all on function dispatch_push_private.capture_order() from public,anon,authenticated;

create or replace function dispatch_push_private.capture_trip() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; notice uuid;
begin
 if new.status <> '완료' or new.unloading_completed_at is null then return null; end if;
 if tg_op='UPDATE' and old.status='완료' then return null; end if;
 for recipient in
  select distinct device.user_id
  from public.dispatch_push_devices device
  join public.dispatch_push_preferences prefs
    on prefs.user_id=device.user_id and prefs.trip_progress
 loop
  insert into public.dispatch_push_notices(user_id,order_id,event_key,title,body)
   values(recipient,new.dispatch_order_id,'trip-complete:'||new.id::text,'운송 잔여 물량','하차 완료 · 전송 시점의 누적·잔여 물량을 확인합니다.')
   on conflict(user_id,event_key) do nothing returning id into notice;
  if notice is not null then
   insert into public.dispatch_push_deliveries(notice_id,endpoint)
    select notice,endpoint from public.dispatch_push_devices where user_id=recipient;
  end if;
 end loop;
 return null;
exception when others then
 raise warning 'dispatch push trip capture failed: %',sqlstate;
 return null;
end;
$$;
revoke all on function dispatch_push_private.capture_trip() from public,anon,authenticated;
