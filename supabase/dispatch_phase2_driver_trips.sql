-- 덤프 배차관리 Phase 2: 기사 Auth 연결, 모바일 운행기록, 안전한 회차 발급
-- 기존 테이블/데이터를 삭제하거나 초기화하지 않습니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요. 재실행해도 안전하게 작성했습니다.

alter table public.dispatch_drivers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists dispatch_drivers_auth_user_id_key
  on public.dispatch_drivers (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.dispatch_trips (
  id uuid primary key default gen_random_uuid(),
  dispatch_order_id text not null references public.dispatch_orders(id) on delete restrict,
  vehicle_id text not null references public.dispatch_vehicles(id) on delete restrict,
  driver_id text not null references public.dispatch_drivers(id) on delete restrict,
  trip_no integer not null check (trip_no > 0),
  actual_volume numeric(12,2) not null check (actual_volume > 0),
  status text not null default '상차대기' check (status in ('상차대기','진행중','완료','취소')),
  loading_completed_at timestamptz,
  unloading_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispatch_trips_order_vehicle_trip_key unique (dispatch_order_id, vehicle_id, trip_no),
  constraint dispatch_trips_time_order_check check (
    unloading_completed_at is null
    or (loading_completed_at is not null and unloading_completed_at >= loading_completed_at)
  )
);

create index if not exists dispatch_trips_driver_created_idx
  on public.dispatch_trips (driver_id, created_at desc);
create index if not exists dispatch_trips_order_idx
  on public.dispatch_trips (dispatch_order_id, trip_no);
create index if not exists dispatch_trips_vehicle_idx
  on public.dispatch_trips (vehicle_id, created_at desc);

drop trigger if exists dispatch_trips_updated_at on public.dispatch_trips;
create trigger dispatch_trips_updated_at before update on public.dispatch_trips
for each row execute function public.set_dispatch_updated_at();

create or replace function public.current_dispatch_driver_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select driver.id
  from public.dispatch_drivers driver
  where driver.auth_user_id = auth.uid()
    and driver.active = true
  limit 1;
$$;

create or replace function public.current_dispatch_vehicle_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select driver.assigned_vehicle_id
  from public.dispatch_drivers driver
  where driver.auth_user_id = auth.uid()
    and driver.active = true
  limit 1;
$$;

create or replace function public.can_driver_read_dispatch_order(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dispatch_order_vehicles assignment
    join public.dispatch_drivers driver
      on driver.assigned_vehicle_id = assignment.vehicle_id
    where assignment.order_id = p_order_id
      and driver.auth_user_id = auth.uid()
      and driver.active = true
  ) or exists (
    select 1
    from public.dispatch_trips trip
    join public.dispatch_drivers driver on driver.id = trip.driver_id
    where trip.dispatch_order_id = p_order_id
      and driver.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.current_dispatch_driver_id() from public;
revoke all on function public.current_dispatch_vehicle_id() from public;
revoke all on function public.can_driver_read_dispatch_order(text) from public;
grant execute on function public.current_dispatch_driver_id() to authenticated;
grant execute on function public.current_dispatch_vehicle_id() to authenticated;
grant execute on function public.can_driver_read_dispatch_order(text) to authenticated;

alter table public.dispatch_trips enable row level security;

grant select on public.dispatch_trips to authenticated;
revoke insert, update, delete on public.dispatch_trips from authenticated;

drop policy if exists dispatch_drivers_read_own on public.dispatch_drivers;
create policy dispatch_drivers_read_own on public.dispatch_drivers
for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists dispatch_vehicles_driver_read_assigned on public.dispatch_vehicles;
create policy dispatch_vehicles_driver_read_assigned on public.dispatch_vehicles
for select to authenticated
using (
  id = public.current_dispatch_vehicle_id()
  or exists (
    select 1 from public.dispatch_trips trip
    where trip.vehicle_id = id
      and trip.driver_id = public.current_dispatch_driver_id()
  )
);

drop policy if exists dispatch_orders_driver_read_assigned on public.dispatch_orders;
create policy dispatch_orders_driver_read_assigned on public.dispatch_orders
for select to authenticated
using (public.can_driver_read_dispatch_order(id));

drop policy if exists dispatch_order_vehicles_driver_read_assigned on public.dispatch_order_vehicles;
create policy dispatch_order_vehicles_driver_read_assigned on public.dispatch_order_vehicles
for select to authenticated
using (
  vehicle_id = public.current_dispatch_vehicle_id()
  or exists (
    select 1
    from public.dispatch_trips trip
    where trip.dispatch_order_id = order_id
      and trip.driver_id = public.current_dispatch_driver_id()
  )
);

drop policy if exists dispatch_trips_admin_read on public.dispatch_trips;
create policy dispatch_trips_admin_read on public.dispatch_trips
for select to authenticated
using (public.is_dispatch_admin());

drop policy if exists dispatch_trips_driver_read_own on public.dispatch_trips;
create policy dispatch_trips_driver_read_own on public.dispatch_trips
for select to authenticated
using (driver_id = public.current_dispatch_driver_id());

create or replace function public.start_dispatch_trip(p_order_id text)
returns public.dispatch_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.dispatch_drivers%rowtype;
  v_order public.dispatch_orders%rowtype;
  v_existing public.dispatch_trips%rowtype;
  v_trip public.dispatch_trips%rowtype;
  v_trip_no integer;
begin
  select * into v_driver
  from public.dispatch_drivers
  where auth_user_id = auth.uid() and active = true;

  if v_driver.id is null then
    raise exception '활성 기사 계정 연결을 확인해 주세요.';
  end if;
  if v_driver.assigned_vehicle_id is null then
    raise exception '담당 차량이 지정되지 않았습니다.';
  end if;

  select * into v_order from public.dispatch_orders where id = p_order_id;
  if v_order.id is null then
    raise exception '배차를 찾을 수 없습니다.';
  end if;
  if v_order.dispatch_date <> (now() at time zone 'Asia/Seoul')::date then
    raise exception '오늘 배차만 운행을 시작할 수 있습니다.';
  end if;
  if v_order.status in ('완료', '취소') then
    raise exception '완료 또는 취소된 배차는 운행을 시작할 수 없습니다.';
  end if;
  if not exists (
    select 1 from public.dispatch_order_vehicles assignment
    where assignment.order_id = p_order_id
      and assignment.vehicle_id = v_driver.assigned_vehicle_id
  ) then
    raise exception '본인 차량에 배정된 배차가 아닙니다.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_order_id || ':' || v_driver.assigned_vehicle_id, 0));

  select * into v_existing
  from public.dispatch_trips
  where dispatch_order_id = p_order_id
    and vehicle_id = v_driver.assigned_vehicle_id
    and driver_id = v_driver.id
    and status in ('상차대기', '진행중')
  order by trip_no desc
  limit 1;

  if v_existing.id is not null then
    return v_existing;
  end if;

  select coalesce(max(trip_no), 0) + 1 into v_trip_no
  from public.dispatch_trips
  where dispatch_order_id = p_order_id
    and vehicle_id = v_driver.assigned_vehicle_id;

  insert into public.dispatch_trips (
    dispatch_order_id, vehicle_id, driver_id, trip_no, actual_volume, status
  ) values (
    p_order_id, v_driver.assigned_vehicle_id, v_driver.id, v_trip_no, v_order.volume_per_trip, '상차대기'
  ) returning * into v_trip;

  update public.dispatch_orders
  set status = '진행중'
  where id = p_order_id and status = '대기';

  return v_trip;
end;
$$;

create or replace function public.complete_dispatch_loading(p_trip_id uuid)
returns public.dispatch_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id text := public.current_dispatch_driver_id();
  v_trip public.dispatch_trips%rowtype;
begin
  select * into v_trip from public.dispatch_trips where id = p_trip_id for update;
  if v_driver_id is null or v_trip.id is null or v_trip.driver_id <> v_driver_id then
    raise exception '본인의 운행기록만 변경할 수 있습니다.';
  end if;
  if v_trip.status = '진행중' then
    return v_trip;
  end if;
  if v_trip.status <> '상차대기' then
    raise exception '상차 완료 처리할 수 없는 상태입니다.';
  end if;

  update public.dispatch_trips
  set status = '진행중', loading_completed_at = now()
  where id = p_trip_id
  returning * into v_trip;
  return v_trip;
end;
$$;

create or replace function public.complete_dispatch_unloading(p_trip_id uuid, p_actual_volume numeric default null)
returns public.dispatch_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id text := public.current_dispatch_driver_id();
  v_trip public.dispatch_trips%rowtype;
  v_volume numeric;
  v_completed_volume numeric;
  v_total_volume numeric;
begin
  select * into v_trip from public.dispatch_trips where id = p_trip_id for update;
  if v_driver_id is null or v_trip.id is null or v_trip.driver_id <> v_driver_id then
    raise exception '본인의 운행기록만 변경할 수 있습니다.';
  end if;
  if v_trip.status = '완료' then
    return v_trip;
  end if;
  if v_trip.status <> '진행중' or v_trip.loading_completed_at is null then
    raise exception '상차 완료 후 하차 완료를 처리해 주세요.';
  end if;

  v_volume := coalesce(p_actual_volume, v_trip.actual_volume);
  if v_volume is null or v_volume <= 0 then
    raise exception '실제 운송량은 0보다 커야 합니다.';
  end if;

  update public.dispatch_trips
  set status = '완료', actual_volume = v_volume, unloading_completed_at = now()
  where id = p_trip_id
  returning * into v_trip;

  select coalesce(sum(actual_volume), 0) into v_completed_volume
  from public.dispatch_trips
  where dispatch_order_id = v_trip.dispatch_order_id and status = '완료';
  select total_volume into v_total_volume
  from public.dispatch_orders where id = v_trip.dispatch_order_id;

  update public.dispatch_orders
  set status = case when v_completed_volume >= v_total_volume then '완료' else '진행중' end
  where id = v_trip.dispatch_order_id and status <> '취소';

  return v_trip;
end;
$$;

revoke all on function public.start_dispatch_trip(text) from public;
revoke all on function public.complete_dispatch_loading(uuid) from public;
revoke all on function public.complete_dispatch_unloading(uuid, numeric) from public;
grant execute on function public.start_dispatch_trip(text) to authenticated;
grant execute on function public.complete_dispatch_loading(uuid) to authenticated;
grant execute on function public.complete_dispatch_unloading(uuid, numeric) to authenticated;
