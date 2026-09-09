-- 기사 모바일에서 같은 배차에 배정된 모든 차량의 운행 진행상황을 공유해서 볼 수 있도록 합니다.
-- 기존 기사 본인 운행 조회/수정 권한은 유지하고, 같은 배차에 배정된 기사끼리 해당 배차의 운행기록 SELECT만 허용합니다.

alter table public.dispatch_trips enable row level security;

drop policy if exists dispatch_trips_driver_read_own on public.dispatch_trips;
drop policy if exists dispatch_trips_driver_read_assigned_order on public.dispatch_trips;

create policy dispatch_trips_driver_read_assigned_order on public.dispatch_trips
for select to authenticated
using (
  dispatch_trips.driver_id = public.current_dispatch_driver_id()
  or exists (
    select 1
    from public.dispatch_order_vehicles assignment
    where assignment.order_id = dispatch_trips.dispatch_order_id
      and assignment.vehicle_id = public.current_dispatch_vehicle_id()
  )
);
