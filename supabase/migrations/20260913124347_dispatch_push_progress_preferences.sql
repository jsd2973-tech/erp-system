create table public.dispatch_push_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 new_order boolean not null default true,
 volume_change boolean not null default true,
 cancellation boolean not null default true,
 trip_progress boolean not null default false
);
alter table public.dispatch_push_preferences enable row level security;
revoke all on public.dispatch_push_preferences from public,anon,authenticated;
grant all on public.dispatch_push_preferences to service_role;
-- Access is exclusively through the token-verified Edge Function, bound to user.id.

create function dispatch_push_private.capture_trip() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; notice uuid;
begin
 if new.status <> '완료' or new.unloading_completed_at is null then return null; end if;
 if tg_op='UPDATE' and old.status='완료' then return null; end if;
 for recipient in
  select distinct device.user_id from public.dispatch_push_devices device
  join public.dispatch_push_preferences prefs on prefs.user_id=device.user_id and prefs.trip_progress
  where exists(select 1 from public.dispatch_admin_users a where a.user_id=device.user_id)
   or exists(select 1 from public.dispatch_drivers d join public.dispatch_order_vehicles a on a.vehicle_id=d.assigned_vehicle_id
    where d.active and d.auth_user_id=device.user_id and a.order_id=new.dispatch_order_id)
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
create trigger dispatch_push_capture_trip after insert or update on public.dispatch_trips
 for each row execute function dispatch_push_private.capture_trip();

-- A fresh aggregate at delivery time includes concurrently committed completions.
-- Never change orders or trips, or maintain a separate decrementing counter.
create function public.dispatch_push_progress(p_order_id text) returns text
language sql stable security invoker set search_path='' as $$
 select o.vendor_name||' · '||o.item_name||E'\n누적 '||trim_scale(coalesce(t.volume,0))::text||' / '||trim_scale(o.total_volume)::text||'루베 · '||
 case when coalesce(t.volume,0)>o.total_volume then '초과 '||trim_scale(t.volume-o.total_volume)::text||'루베'
 else '잔여 '||trim_scale(o.total_volume-coalesce(t.volume,0))::text||'루베' end||
 case when o.volume_per_trip>0 then E'\n'||trim_scale(o.volume_per_trip)::text||'루베 기준 약 '||ceil(greatest(o.total_volume-coalesce(t.volume,0),0)/o.volume_per_trip)::text||'탕 남음' else '' end
 from public.dispatch_orders o
 left join lateral (select sum(actual_volume) as volume from public.dispatch_trips
  where dispatch_order_id=o.id and status='완료' and unloading_completed_at is not null and actual_volume>=0) t on true
 where o.id=p_order_id;
$$;
revoke all on function public.dispatch_push_progress(text) from public,anon,authenticated;
grant execute on function public.dispatch_push_progress(text) to service_role;
