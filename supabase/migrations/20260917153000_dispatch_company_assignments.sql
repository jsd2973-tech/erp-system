-- 업체별 차량·기사 관리와 배차별 기사 선택
-- 기존 assigned_vehicle_id는 기사 모바일의 구버전 호환을 위해 보존합니다.

alter table public.dispatch_vehicles
  add column if not exists company_name text not null default '';

alter table public.dispatch_drivers
  add column if not exists company_name text not null default '';

alter table public.dispatch_order_vehicles
  add column if not exists driver_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dispatch_order_vehicles_driver_id_fkey'
      and conrelid = 'public.dispatch_order_vehicles'::regclass
  ) then
    alter table public.dispatch_order_vehicles
      add constraint dispatch_order_vehicles_driver_id_fkey
      foreign key (driver_id) references public.dispatch_drivers(id) on delete set null;
  end if;
end;
$$;

create index if not exists dispatch_order_vehicles_driver_idx
  on public.dispatch_order_vehicles(driver_id);

-- 기존에 차량에 고정된 활성 기사가 한 명뿐인 배차만 자동 연결합니다.
-- 여러 명이 연결된 예외 데이터는 기존 배차를 보존하고 관리자 확인 대상으로 남깁니다.
update public.dispatch_order_vehicles assignment
set driver_id = driver.id
from public.dispatch_drivers driver
where assignment.driver_id is null
  and driver.active = true
  and driver.assigned_vehicle_id = assignment.vehicle_id
  and (
    select count(*)
    from public.dispatch_drivers candidate
    where candidate.active = true
      and candidate.assigned_vehicle_id = assignment.vehicle_id
  ) = 1;

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
    where assignment.order_id = p_order_id
      and (
        assignment.driver_id = public.current_dispatch_driver_id()
        or (
          assignment.driver_id is null
          and assignment.vehicle_id = public.current_dispatch_vehicle_id()
        )
      )
  ) or exists (
    select 1
    from public.dispatch_trips trip
    where trip.dispatch_order_id = p_order_id
      and trip.driver_id = public.current_dispatch_driver_id()
  );
$$;

revoke all on function public.can_driver_read_dispatch_order(text) from public;
grant execute on function public.can_driver_read_dispatch_order(text) to authenticated;

create or replace function public.save_dispatch_order_with_assignments(
  p_order jsonb,
  p_assignments jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(trim(p_order ->> 'id'), '');
  v_total numeric := nullif(p_order ->> 'total_volume', '')::numeric;
  v_per_trip numeric := nullif(p_order ->> 'volume_per_trip', '')::numeric;
  v_status text := coalesce(nullif(trim(p_order ->> 'status'), ''), '대기');
  v_assignment jsonb;
  v_vehicle public.dispatch_vehicles%rowtype;
  v_driver public.dispatch_drivers%rowtype;
  v_vehicle_id text;
  v_driver_id text;
  v_requested_vehicle_ids text[] := array[]::text[];
  v_requested_driver_ids text[] := array[]::text[];
begin
  if not public.has_dispatch_permission('dispatch_register') then
    raise exception '배차 저장 권한이 없습니다.';
  end if;

  if v_id is not null and exists (
    select 1 from public.dispatch_orders existing_order
    where existing_order.id = v_id and existing_order.deleted_at is not null
  ) then
    raise exception '휴지통에 있는 배차는 수정할 수 없습니다. 먼저 관리자 복구가 필요합니다.';
  end if;

  if v_total is null or v_total <= 0 or v_per_trip is null or v_per_trip <= 0 then
    raise exception '물량은 0보다 커야 합니다.';
  end if;
  if nullif(trim(p_order ->> 'dispatch_date'), '') is null
     or nullif(trim(p_order ->> 'vendor_name'), '') is null
     or nullif(trim(p_order ->> 'loading_location'), '') is null
     or nullif(trim(p_order ->> 'unloading_location'), '') is null
     or nullif(trim(p_order ->> 'item_name'), '') is null then
    raise exception '배차 기본정보를 확인해 주세요.';
  end if;
  if v_status not in ('대기','진행중','완료','취소') then
    raise exception '올바르지 않은 배차 상태입니다.';
  end if;
  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception '차량·기사 배정 형식이 올바르지 않습니다.';
  end if;

  if v_id is not null and exists (
    select 1
    from public.dispatch_trips trip
    where trip.dispatch_order_id = v_id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) item
        where nullif(item ->> 'vehicle_id', '') = trip.vehicle_id
      )
  ) then
    raise exception '운행기록이 있는 차량 배정은 삭제할 수 없습니다.';
  end if;

  for v_assignment in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) value loop
    v_vehicle_id := nullif(trim(v_assignment ->> 'vehicle_id'), '');
    v_driver_id := nullif(trim(v_assignment ->> 'driver_id'), '');
    if v_vehicle_id is null or v_driver_id is null then
      raise exception '모든 배정에 차량과 기사를 선택해야 합니다.';
    end if;
    if v_vehicle_id = any(v_requested_vehicle_ids) then
      raise exception '같은 차량을 한 배차에 중복 배정할 수 없습니다.';
    end if;
    if v_driver_id = any(v_requested_driver_ids) then
      raise exception '같은 기사를 한 배차에 중복 배정할 수 없습니다.';
    end if;

    select vehicle.* into v_vehicle from public.dispatch_vehicles vehicle where vehicle.id = v_vehicle_id;
    if v_vehicle.id is null then
      raise exception '선택한 차량을 찾을 수 없습니다.';
    end if;
    select driver.* into v_driver from public.dispatch_drivers driver where driver.id = v_driver_id;
    if v_driver.id is null then
      raise exception '선택한 기사를 찾을 수 없습니다.';
    end if;
    if nullif(lower(regexp_replace(btrim(v_vehicle.company_name), '\s+', ' ', 'g')), '')
       is distinct from nullif(lower(regexp_replace(btrim(v_driver.company_name), '\s+', ' ', 'g')), '') then
      raise exception '차량과 기사는 같은 업체로만 배정할 수 있습니다.';
    end if;

    v_requested_vehicle_ids := array_append(v_requested_vehicle_ids, v_vehicle_id);
    v_requested_driver_ids := array_append(v_requested_driver_ids, v_driver_id);
  end loop;

  if v_id is null then
    v_id := gen_random_uuid()::text;
  end if;

  if exists (
    select 1
    from public.dispatch_trips trip
    join public.dispatch_order_vehicles old_assignment
      on old_assignment.order_id = trip.dispatch_order_id
     and old_assignment.vehicle_id = trip.vehicle_id
    where trip.dispatch_order_id = v_id
      and old_assignment.driver_id is not null
      and trip.vehicle_id = any(v_requested_vehicle_ids)
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) item
        where nullif(item ->> 'vehicle_id', '') = trip.vehicle_id
          and nullif(item ->> 'driver_id', '') = old_assignment.driver_id
      )
  ) then
    raise exception '운행기록이 있는 차량의 기사는 수정할 수 없습니다.';
  end if;

  insert into public.dispatch_orders (
    id, dispatch_date, vendor_id, vendor_name, loading_location, unloading_location,
    item_id, item_name, total_volume, volume_per_trip, estimated_trip_count,
    status, memo, created_by
  ) values (
    v_id,
    (p_order ->> 'dispatch_date')::date,
    nullif(p_order ->> 'vendor_id', ''),
    trim(p_order ->> 'vendor_name'),
    trim(p_order ->> 'loading_location'),
    trim(p_order ->> 'unloading_location'),
    nullif(p_order ->> 'item_id', ''),
    trim(p_order ->> 'item_name'),
    v_total,
    v_per_trip,
    ceil(v_total / v_per_trip)::integer,
    v_status,
    coalesce(trim(p_order ->> 'memo'), ''),
    auth.uid()
  )
  on conflict (id) do update set
    dispatch_date = excluded.dispatch_date,
    vendor_id = excluded.vendor_id,
    vendor_name = excluded.vendor_name,
    loading_location = excluded.loading_location,
    unloading_location = excluded.unloading_location,
    item_id = excluded.item_id,
    item_name = excluded.item_name,
    total_volume = excluded.total_volume,
    volume_per_trip = excluded.volume_per_trip,
    estimated_trip_count = excluded.estimated_trip_count,
    status = excluded.status,
    memo = excluded.memo;

  delete from public.dispatch_order_vehicles where order_id = v_id;
  for v_assignment in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) value loop
    insert into public.dispatch_order_vehicles (order_id, vehicle_id, driver_id)
    values (v_id, nullif(trim(v_assignment ->> 'vehicle_id'), ''), nullif(trim(v_assignment ->> 'driver_id'), ''));
  end loop;
  return v_id;
end;
$$;

revoke all on function public.save_dispatch_order_with_assignments(jsonb, jsonb) from public;
grant execute on function public.save_dispatch_order_with_assignments(jsonb, jsonb) to authenticated;

-- 구버전 화면이 남아 있어도 기존 차량 기반 배차를 저장할 수 있게 유지합니다.
create or replace function public.save_dispatch_order(p_order jsonb, p_vehicle_ids text[] default array[]::text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(trim(p_order ->> 'id'), '');
  v_total numeric := nullif(p_order ->> 'total_volume', '')::numeric;
  v_per_trip numeric := nullif(p_order ->> 'volume_per_trip', '')::numeric;
  v_status text := coalesce(nullif(trim(p_order ->> 'status'), ''), '대기');
  v_vehicle_id text;
begin
  if not public.has_dispatch_permission('dispatch_register') then
    raise exception '배차 저장 권한이 없습니다.';
  end if;
  if v_total is null or v_total <= 0 or v_per_trip is null or v_per_trip <= 0 then
    raise exception '물량은 0보다 커야 합니다.';
  end if;
  if v_status not in ('대기','진행중','완료','취소') then
    raise exception '올바르지 않은 배차 상태입니다.';
  end if;
  if v_id is null then v_id := gen_random_uuid()::text; end if;

  insert into public.dispatch_orders (
    id, dispatch_date, vendor_id, vendor_name, loading_location, unloading_location,
    item_id, item_name, total_volume, volume_per_trip, estimated_trip_count, status, memo, created_by
  ) values (
    v_id, (p_order ->> 'dispatch_date')::date, nullif(p_order ->> 'vendor_id', ''), trim(p_order ->> 'vendor_name'),
    trim(p_order ->> 'loading_location'), trim(p_order ->> 'unloading_location'), nullif(p_order ->> 'item_id', ''),
    trim(p_order ->> 'item_name'), v_total, v_per_trip, ceil(v_total / v_per_trip)::integer, v_status,
    coalesce(trim(p_order ->> 'memo'), ''), auth.uid()
  )
  on conflict (id) do update set
    dispatch_date = excluded.dispatch_date, vendor_id = excluded.vendor_id, vendor_name = excluded.vendor_name,
    loading_location = excluded.loading_location, unloading_location = excluded.unloading_location,
    item_id = excluded.item_id, item_name = excluded.item_name, total_volume = excluded.total_volume,
    volume_per_trip = excluded.volume_per_trip, estimated_trip_count = excluded.estimated_trip_count,
    status = excluded.status, memo = excluded.memo;

  delete from public.dispatch_order_vehicles where order_id = v_id;
  foreach v_vehicle_id in array coalesce(p_vehicle_ids, array[]::text[]) loop
    insert into public.dispatch_order_vehicles (order_id, vehicle_id, driver_id)
    values (
      v_id,
      v_vehicle_id,
      (select driver.id from public.dispatch_drivers driver where driver.active and driver.assigned_vehicle_id = v_vehicle_id limit 1)
    )
    on conflict (order_id, vehicle_id) do nothing;
  end loop;
  return v_id;
end;
$$;

revoke all on function public.save_dispatch_order(jsonb, text[]) from public;
grant execute on function public.save_dispatch_order(jsonb, text[]) to authenticated;

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
  v_vehicle_id text;
  v_trip_no integer;
  v_assignment_count integer;
begin
  select driver.* into v_driver
  from public.dispatch_drivers driver
  where driver.auth_user_id = auth.uid() and driver.active = true
  limit 1;
  if v_driver.id is null then raise exception '활성 기사 계정 연결을 확인해 주세요.'; end if;

  select dispatch_order.* into v_order from public.dispatch_orders dispatch_order where dispatch_order.id = p_order_id;
  if v_order.id is null then raise exception '배차를 찾을 수 없습니다.'; end if;
  if v_order.dispatch_date <> (now() at time zone 'Asia/Seoul')::date then raise exception '오늘 배차만 운행을 시작할 수 있습니다.'; end if;
  if v_order.status in ('완료', '취소') then raise exception '완료 또는 취소된 배차는 운행을 시작할 수 없습니다.'; end if;

  select count(*), min(assignment.vehicle_id)
  into v_assignment_count, v_vehicle_id
  from public.dispatch_order_vehicles assignment
  where assignment.order_id = p_order_id
    and (
      assignment.driver_id = v_driver.id
      or (assignment.driver_id is null and assignment.vehicle_id = v_driver.assigned_vehicle_id)
    );
  if v_assignment_count = 0 or v_vehicle_id is null then raise exception '본인에게 배정된 차량이 있는 배차가 아닙니다.'; end if;
  if v_assignment_count > 1 then raise exception '한 배차에 같은 기사가 여러 차량으로 배정되어 있습니다. 관리자에게 확인을 요청해 주세요.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_order_id || ':' || v_vehicle_id, 0));
  select trip.* into v_existing
  from public.dispatch_trips trip
  where trip.dispatch_order_id = p_order_id and trip.vehicle_id = v_vehicle_id and trip.driver_id = v_driver.id
    and trip.status in ('상차대기', '진행중')
  order by trip.trip_no desc limit 1;
  if v_existing.id is not null then return v_existing; end if;

  select coalesce(max(trip.trip_no), 0) + 1 into v_trip_no
  from public.dispatch_trips trip where trip.dispatch_order_id = p_order_id and trip.vehicle_id = v_vehicle_id;
  insert into public.dispatch_trips (dispatch_order_id, vehicle_id, driver_id, trip_no, actual_volume, status)
  values (p_order_id, v_vehicle_id, v_driver.id, v_trip_no, v_order.volume_per_trip, '상차대기')
  returning * into v_trip;
  update public.dispatch_orders set status = '진행중' where id = p_order_id and status = '대기';
  return v_trip;
end;
$$;

revoke all on function public.start_dispatch_trip(text) from public;
grant execute on function public.start_dispatch_trip(text) to authenticated;

drop policy if exists dispatch_vehicles_driver_read_assigned on public.dispatch_vehicles;
create policy dispatch_vehicles_driver_read_assigned on public.dispatch_vehicles
for select to authenticated
using (
  id = public.current_dispatch_vehicle_id()
  or exists (
    select 1 from public.dispatch_order_vehicles assignment
    where assignment.vehicle_id = dispatch_vehicles.id
      and assignment.driver_id = public.current_dispatch_driver_id()
  )
  or exists (
    select 1 from public.dispatch_trips trip
    where trip.vehicle_id = dispatch_vehicles.id and trip.driver_id = public.current_dispatch_driver_id()
  )
);

drop policy if exists dispatch_order_vehicles_driver_read_assigned on public.dispatch_order_vehicles;
create policy dispatch_order_vehicles_driver_read_assigned on public.dispatch_order_vehicles
for select to authenticated
using (
  vehicle_id = public.current_dispatch_vehicle_id()
  or driver_id = public.current_dispatch_driver_id()
  or exists (
    select 1 from public.dispatch_trips trip
    where trip.dispatch_order_id = dispatch_order_vehicles.order_id
      and trip.driver_id = public.current_dispatch_driver_id()
  )
);
