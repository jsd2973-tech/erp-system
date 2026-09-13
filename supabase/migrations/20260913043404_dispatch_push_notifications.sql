-- Additive push infrastructure. Existing business tables, policies and RPCs are preserved.
create table public.dispatch_push_config (
 id boolean primary key default true check(id),
 public_key text not null, private_key text not null,
 worker_token text not null default gen_random_uuid()::text
);
create table public.dispatch_push_devices (
 endpoint text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 subscription jsonb not null, session_id uuid not null,
 created_at timestamptz not null default now()
);
create index dispatch_push_devices_user_idx on public.dispatch_push_devices(user_id);
create table public.dispatch_push_notices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 order_id text, event_key text not null, title text not null, body text not null,
 created_at timestamptz not null default now(), unique(user_id,event_key)
);
create index dispatch_push_notices_user_date_idx on public.dispatch_push_notices(user_id,created_at desc);
create table public.dispatch_push_deliveries (
 id uuid primary key default gen_random_uuid(), notice_id uuid not null references public.dispatch_push_notices(id) on delete cascade,
 endpoint text not null references public.dispatch_push_devices(endpoint) on delete cascade,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 sent_at timestamptz, last_status integer, unique(notice_id,endpoint)
);
create index dispatch_push_pending_idx on public.dispatch_push_deliveries(next_attempt_at) where sent_at is null and attempts<5;
alter table public.dispatch_push_config enable row level security;
alter table public.dispatch_push_devices enable row level security;
alter table public.dispatch_push_notices enable row level security;
alter table public.dispatch_push_deliveries enable row level security;
revoke all on public.dispatch_push_config, public.dispatch_push_devices,public.dispatch_push_notices,public.dispatch_push_deliveries from public,anon,authenticated;
grant all on public.dispatch_push_config,public.dispatch_push_devices,public.dispatch_push_notices,public.dispatch_push_deliveries to service_role;
grant select on public.dispatch_push_notices to authenticated;
create policy dispatch_push_read_own on public.dispatch_push_notices for select to authenticated using(user_id=(select auth.uid()));

create schema if not exists dispatch_push_private;
revoke all on schema dispatch_push_private from public,anon,authenticated;
create function dispatch_push_private.capture_order() returns trigger
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
  select distinct d.user_id from public.dispatch_push_devices d
  where exists(select 1 from public.dispatch_admin_users a where a.user_id=d.user_id)
  or exists(select 1 from public.dispatch_drivers driver join public.dispatch_order_vehicles assignment on assignment.vehicle_id=driver.assigned_vehicle_id
    where driver.active and driver.auth_user_id=d.user_id and assignment.order_id=new.id)
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
 -- Notification failure must not roll back a dispatch save.
 raise warning 'dispatch push capture failed: %',sqlstate;
 return null;
end;
$$;
revoke all on function dispatch_push_private.capture_order() from public,anon,authenticated;
-- Deferred so vehicle assignments created by the existing RPC are visible.
create constraint trigger dispatch_push_capture_order after insert or update on public.dispatch_orders
 deferrable initially deferred for each row execute function dispatch_push_private.capture_order();

create function public.dispatch_push_session_valid(p_user uuid,p_session uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now()));
$$;
revoke all on function public.dispatch_push_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dispatch_push_session_valid(uuid,uuid) to service_role;

create function public.dispatch_push_claim() returns setof public.dispatch_push_deliveries
language sql security invoker set search_path='' as $$
 update public.dispatch_push_deliveries set attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
 where id in (select id from public.dispatch_push_deliveries where sent_at is null and attempts<5 and next_attempt_at<=now()
 order by next_attempt_at for update skip locked limit 30) returning *;
$$;
revoke all on function public.dispatch_push_claim() from public,anon,authenticated;
grant execute on function public.dispatch_push_claim() to service_role;
