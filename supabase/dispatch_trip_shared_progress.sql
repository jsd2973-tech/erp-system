-- 기사 모바일에서 같은 배차에 배정된 모든 차량의 운행 진행상황을 공유해서 볼 수 있도록 합니다.
-- 기존 기사 본인 운행 조회/수정 권한은 유지하고, 같은 배차에 배정된 기사끼리 해당 배차의 운행기록 SELECT만 허용합니다.
-- 중요: dispatch_order_vehicles의 기존 RLS가 dispatch_trips를 참조하므로,
-- dispatch_trips 정책에서 dispatch_order_vehicles를 직접 조회하면 RLS 재귀가 발생할 수 있습니다.
-- 따라서 기존 SECURITY DEFINER 함수 can_driver_read_dispatch_order()를 사용해 재귀 없이 판정합니다.

alter table public.dispatch_trips enable row level security;

drop policy if exists dispatch_trips_driver_read_own on public.dispatch_trips;
drop policy if exists dispatch_trips_driver_read_assigned_order on public.dispatch_trips;

create policy dispatch_trips_driver_read_assigned_order on public.dispatch_trips
for select to authenticated
using (
  public.can_driver_read_dispatch_order(dispatch_trips.dispatch_order_id)
);
