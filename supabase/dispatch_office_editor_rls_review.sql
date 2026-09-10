-- 검토용 최종안: tm7030@naver.com 사무실 직원 운행관리 권한
-- IMPORTANT: 아직 운영 DB에 실행하지 마세요.
-- 목적:
--   1) tm7030@naver.com 은 운행관리 전체 조회
--   2) 차량/기사/배차 기초관리(거래처/상하차지/품목)는 등록/수정 가능
--   3) 배차는 save_dispatch_order()를 통해 등록/수정 가능
--   4) DELETE / 휴지통 / 복구 / 영구삭제는 기존 관리자만 가능
--   5) dispatch_admin_users 에 직원을 추가하지 않음
-- 기존 데이터 행을 직접 UPDATE/DELETE하는 문장은 포함하지 않습니다.
-- 아래 CREATE OR REPLACE / POLICY 변경은 '권한 정의'만 변경합니다.

-- ============================================================
-- 0. 지정 사무실 편집자 판정
-- ============================================================
create or replace function public.is_dispatch_office_editor()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'tm7030@naver.com';
$$;

revoke all on function public.is_dispatch_office_editor() from public;
grant execute on function public.is_dispatch_office_editor() to authenticated;

-- ============================================================
-- 1. 전체 조회 권한
-- 기존 관리자/기사 SELECT 정책은 유지하고,
-- tm7030@naver.com 전용 SELECT 정책만 추가합니다.
-- ============================================================

drop policy if exists dispatch_vehicles_office_editor_select on public.dispatch_vehicles;
create policy dispatch_vehicles_office_editor_select
on public.dispatch_vehicles for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_drivers_office_editor_select on public.dispatch_drivers;
create policy dispatch_drivers_office_editor_select
on public.dispatch_drivers for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_orders_office_editor_select on public.dispatch_orders;
create policy dispatch_orders_office_editor_select
on public.dispatch_orders for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_order_vehicles_office_editor_select on public.dispatch_order_vehicles;
create policy dispatch_order_vehicles_office_editor_select
on public.dispatch_order_vehicles for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_customers_office_editor_select on public.dispatch_customers;
create policy dispatch_customers_office_editor_select
on public.dispatch_customers for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_locations_office_editor_select on public.dispatch_locations;
create policy dispatch_locations_office_editor_select
on public.dispatch_locations for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_items_office_editor_select on public.dispatch_items;
create policy dispatch_items_office_editor_select
on public.dispatch_items for select to authenticated
using (public.is_dispatch_office_editor());

drop policy if exists dispatch_trips_office_editor_select on public.dispatch_trips;
create policy dispatch_trips_office_editor_select
on public.dispatch_trips for select to authenticated
using (public.is_dispatch_office_editor());

-- ============================================================
-- 2. 차량관리 / 기사관리 / 배차 기초관리 등록·수정
-- DELETE 정책은 만들지 않습니다.
-- 기존 *_admin FOR ALL 정책은 관리자용으로 그대로 유지됩니다.
-- ============================================================

-- 차량관리
drop policy if exists dispatch_vehicles_office_editor_insert on public.dispatch_vehicles;
create policy dispatch_vehicles_office_editor_insert
on public.dispatch_vehicles for insert to authenticated
with check (public.is_dispatch_office_editor());

drop policy if exists dispatch_vehicles_office_editor_update on public.dispatch_vehicles;
create policy dispatch_vehicles_office_editor_update
on public.dispatch_vehicles for update to authenticated
using (public.is_dispatch_office_editor())
with check (public.is_dispatch_office_editor());

-- 기사관리
drop policy if exists dispatch_drivers_office_editor_insert on public.dispatch_drivers;
create policy dispatch_drivers_office_editor_insert
on public.dispatch_drivers for insert to authenticated
with check (public.is_dispatch_office_editor());

drop policy if exists dispatch_drivers_office_editor_update on public.dispatch_drivers;
create policy dispatch_drivers_office_editor_update
on public.dispatch_drivers for update to authenticated
using (public.is_dispatch_office_editor())
with check (public.is_dispatch_office_editor());

-- 배차 기초관리: 거래처
drop policy if exists dispatch_customers_office_editor_insert on public.dispatch_customers;
create policy dispatch_customers_office_editor_insert
on public.dispatch_customers for insert to authenticated
with check (public.is_dispatch_office_editor());

drop policy if exists dispatch_customers_office_editor_update on public.dispatch_customers;
create policy dispatch_customers_office_editor_update
on public.dispatch_customers for update to authenticated
using (public.is_dispatch_office_editor())
with check (public.is_dispatch_office_editor());

-- 배차 기초관리: 상/하차지
drop policy if exists dispatch_locations_office_editor_insert on public.dispatch_locations;
create policy dispatch_locations_office_editor_insert
on public.dispatch_locations for insert to authenticated
with check (public.is_dispatch_office_editor());

drop policy if exists dispatch_locations_office_editor_update on public.dispatch_locations;
create policy dispatch_locations_office_editor_update
on public.dispatch_locations for update to authenticated
using (public.is_dispatch_office_editor())
with check (public.is_dispatch_office_editor());

-- 배차 기초관리: 품목
drop policy if exists dispatch_items_office_editor_insert on public.dispatch_items;
create policy dispatch_items_office_editor_insert
on public.dispatch_items for insert to authenticated
with check (public.is_dispatch_office_editor());

drop policy if exists dispatch_items_office_editor_update on public.dispatch_items;
create policy dispatch_items_office_editor_update
on public.dispatch_items for update to authenticated
using (public.is_dispatch_office_editor())
with check (public.is_dispatch_office_editor());

-- ============================================================
-- 3. 배차 등록·수정 RPC
-- 운영 DB에서 확인한 현재 함수 본문을 그대로 유지하고,
-- 권한 조건만 '관리자 또는 지정 사무실 편집자'로 확장합니다.
--
-- SECURITY DEFINER로 바꾸는 이유:
-- 함수 내부 59행에서 dispatch_order_vehicles를 DELETE 후 재구성합니다.
-- 직원에게 테이블 DELETE RLS를 직접 열지 않고도 이 함수 안에서만
-- 배차-차량 연결을 안전하게 재구성하기 위함입니다.
-- 직접 DELETE는 여전히 RLS에서 차단됩니다.
-- ============================================================
create or replace function public.save_dispatch_order(
  p_order jsonb,
  p_vehicle_ids text[] default array[]::text[]
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
begin
  if not (public.is_dispatch_admin() or public.is_dispatch_office_editor()) then
    raise exception '배차 저장 권한이 없습니다.';
  end if;

  if v_total is null or v_total <= 0 or v_per_trip is null or v_per_trip <= 0 then
    raise exception '물량은 0보다 커야 합니다.';
  end if;

  if v_status not in ('대기','진행중','완료','취소') then
    raise exception '올바르지 않은 배차 상태입니다.';
  end if;

  if v_id is null then
    v_id := gen_random_uuid()::text;
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

  insert into public.dispatch_order_vehicles (order_id, vehicle_id)
  select v_id, vehicle_id
  from unnest(coalesce(p_vehicle_ids, array[]::text[])) as selected(vehicle_id)
  where exists (
    select 1
    from public.dispatch_vehicles vehicle
    where vehicle.id = selected.vehicle_id
  )
  on conflict (order_id, vehicle_id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.save_dispatch_order(jsonb, text[]) from public;
grant execute on function public.save_dispatch_order(jsonb, text[]) to authenticated;

-- ============================================================
-- 4. 삭제/복구 계열은 변경하지 않음
-- 운영 DB에서 아래 3개 함수 모두 is_dispatch_admin() 검사를 확인함.
--   delete_dispatch_order
--   restore_dispatch_order
--   permanently_delete_dispatch_order
-- 따라서 tm7030@naver.com 은 이 함수들을 통과할 수 없음.
-- office editor용 DELETE RLS 정책도 만들지 않음.
-- ============================================================

-- ============================================================
-- 5. 적용 후 검증용 읽기 전용 SQL
-- 실제 적용 뒤 tm7030 계정 테스트와 함께 아래 정책을 확인합니다.
-- ============================================================
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename like 'dispatch_%'
-- order by tablename, policyname;
--
-- select p.proname, p.prosecdef as security_definer,
--        position('is_dispatch_admin' in pg_get_functiondef(p.oid)) > 0 as checks_admin,
--        position('is_dispatch_office_editor' in pg_get_functiondef(p.oid)) > 0 as checks_office_editor
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'save_dispatch_order',
--     'delete_dispatch_order',
--     'restore_dispatch_order',
--     'permanently_delete_dispatch_order'
--   )
-- order by p.proname;
