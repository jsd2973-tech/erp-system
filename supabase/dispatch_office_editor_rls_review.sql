-- 검토용 수정안: 직원별 운행관리 권한과 Supabase RLS 정합성
-- IMPORTANT: 아직 운영 DB에 실행하지 마세요.
-- main/운영 DB에는 반영하지 않고 검토용으로만 유지합니다.
--
-- 목표
--   1) 특정 이메일 하드코딩 없이 public.user_permissions.permissions의 운행관리 체크값을 DB 권한과 연결
--   2) save_dispatch_order()는 dispatch_register 권한 보유자만 실행
--   3) 휴지통(deleted_at is not null) 배차는 save_dispatch_order()로 수정 불가
--   4) 기사 일반정보 등록/수정과 auth_user_id(로그인 연결) 변경 권한을 분리
--   5) DELETE / 휴지통 / 복구 / 영구삭제는 기존 is_dispatch_admin() 관리자만 유지
--   6) dispatch_admin_users에 일반 직원을 추가하지 않음
--
-- 데이터 행을 일괄 변경/삭제하는 문장은 포함하지 않습니다.

-- ============================================================
-- 0. 직원별 운행관리 권한 판정
-- ============================================================
-- user_permissions 자체 RLS에 의존하지 않고 로그인 사용자의 자기 권한만 boolean으로 판정합니다.
-- 임의의 다른 권한 키 조회를 막기 위해 운행관리 6개 키만 허용합니다.
create or replace function public.has_dispatch_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_dispatch_admin()
    or (
      p_permission = any (array[
        'dispatch_register',
        'dispatch_list',
        'dispatch_status',
        'dispatch_vehicles',
        'dispatch_drivers',
        'dispatch_basics'
      ]::text[])
      and exists (
        select 1
        from public.user_permissions up
        where lower(up.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and coalesce((up.permissions ->> p_permission)::boolean, false)
      )
    );
$$;

revoke all on function public.has_dispatch_permission(text) from public;
grant execute on function public.has_dispatch_permission(text) to authenticated;

-- 이전 검토안의 이메일 단독 판정 함수는 실제 적용 대상에서 제거합니다.
-- (아직 운영 미적용이므로 운영에는 존재하지 않아야 함)
drop function if exists public.is_dispatch_office_editor();

-- ============================================================
-- 1. 조회 권한: 화면 메뉴에 필요한 테이블만 연결
-- ============================================================
-- 기존 *_admin 및 기사 모바일 SELECT 정책은 그대로 유지합니다.
-- 아래 정책은 직원별 메뉴 권한이 true인 경우에만 추가 SELECT를 허용합니다.

-- 차량: 배차등록/목록/현황/차량관리/기사관리에서 필요
drop policy if exists dispatch_vehicles_staff_select on public.dispatch_vehicles;
create policy dispatch_vehicles_staff_select
on public.dispatch_vehicles for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
  or public.has_dispatch_permission('dispatch_vehicles')
  or public.has_dispatch_permission('dispatch_drivers')
);

-- 기사: 배차등록/목록/현황/기사관리에서 필요
drop policy if exists dispatch_drivers_staff_select on public.dispatch_drivers;
create policy dispatch_drivers_staff_select
on public.dispatch_drivers for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
  or public.has_dispatch_permission('dispatch_drivers')
);

-- 배차/차량연결: 배차등록/목록/현황에서 필요
drop policy if exists dispatch_orders_staff_select on public.dispatch_orders;
create policy dispatch_orders_staff_select
on public.dispatch_orders for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
);

drop policy if exists dispatch_order_vehicles_staff_select on public.dispatch_order_vehicles;
create policy dispatch_order_vehicles_staff_select
on public.dispatch_order_vehicles for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
);

-- 거래처/상하차지/품목: 배차등록과 배차 기초관리에서 필요
drop policy if exists dispatch_customers_staff_select on public.dispatch_customers;
create policy dispatch_customers_staff_select
on public.dispatch_customers for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_basics')
);

drop policy if exists dispatch_locations_staff_select on public.dispatch_locations;
create policy dispatch_locations_staff_select
on public.dispatch_locations for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_basics')
);

drop policy if exists dispatch_items_staff_select on public.dispatch_items;
create policy dispatch_items_staff_select
on public.dispatch_items for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_basics')
);

-- 운행기록: 배차등록 화면의 요약목록/배차목록/운행현황에서 필요
drop policy if exists dispatch_trips_staff_select on public.dispatch_trips;
create policy dispatch_trips_staff_select
on public.dispatch_trips for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
);

-- ============================================================
-- 2. 등록/수정: 메뉴별 write 권한
-- ============================================================
-- DELETE 정책은 직원용으로 만들지 않습니다.

-- 차량관리
drop policy if exists dispatch_vehicles_staff_insert on public.dispatch_vehicles;
create policy dispatch_vehicles_staff_insert
on public.dispatch_vehicles for insert to authenticated
with check (public.has_dispatch_permission('dispatch_vehicles'));

drop policy if exists dispatch_vehicles_staff_update on public.dispatch_vehicles;
create policy dispatch_vehicles_staff_update
on public.dispatch_vehicles for update to authenticated
using (public.has_dispatch_permission('dispatch_vehicles'))
with check (public.has_dispatch_permission('dispatch_vehicles'));

-- 기사관리: 일반 기사정보 등록/수정 허용
-- auth_user_id는 아래 3번의 DB trigger에서 관리자만 변경 가능하도록 별도 차단합니다.
drop policy if exists dispatch_drivers_staff_insert on public.dispatch_drivers;
create policy dispatch_drivers_staff_insert
on public.dispatch_drivers for insert to authenticated
with check (public.has_dispatch_permission('dispatch_drivers'));

drop policy if exists dispatch_drivers_staff_update on public.dispatch_drivers;
create policy dispatch_drivers_staff_update
on public.dispatch_drivers for update to authenticated
using (public.has_dispatch_permission('dispatch_drivers'))
with check (public.has_dispatch_permission('dispatch_drivers'));

-- 배차등록 중 신규 마스터 INSERT 또는 배차 기초관리
-- 기존 마스터 UPDATE는 아래처럼 dispatch_basics만 허용
-- 배차 기초관리
drop policy if exists dispatch_customers_staff_insert on public.dispatch_customers;
create policy dispatch_customers_staff_insert
on public.dispatch_customers for insert to authenticated
with check (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_basics')
);

drop policy if exists dispatch_customers_staff_update on public.dispatch_customers;
create policy dispatch_customers_staff_update
on public.dispatch_customers for update to authenticated
using (public.has_dispatch_permission('dispatch_basics'))
with check (public.has_dispatch_permission('dispatch_basics'));

drop policy if exists dispatch_locations_staff_insert on public.dispatch_locations;
create policy dispatch_locations_staff_insert
on public.dispatch_locations for insert to authenticated
with check (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_basics')
);

drop policy if exists dispatch_locations_staff_update on public.dispatch_locations;
create policy dispatch_locations_staff_update
on public.dispatch_locations for update to authenticated
using (public.has_dispatch_permission('dispatch_basics'))
with check (public.has_dispatch_permission('dispatch_basics'));

drop policy if exists dispatch_items_staff_insert on public.dispatch_items;
create policy dispatch_items_staff_insert
on public.dispatch_items for insert to authenticated
with check (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_basics')
);

drop policy if exists dispatch_items_staff_update on public.dispatch_items;
create policy dispatch_items_staff_update
on public.dispatch_items for update to authenticated
using (public.has_dispatch_permission('dispatch_basics'))
with check (public.has_dispatch_permission('dispatch_basics'));

-- ============================================================
-- 3. 기사 auth_user_id 변경 권한 분리
-- ============================================================
-- dispatch_drivers 권한 직원은 기사명/연락처/담당차량/상태/메모는 등록·수정 가능하지만,
-- 로그인 연결(auth_user_id)은 관리자만 설정/변경/해제할 수 있습니다.
create or replace function public.guard_dispatch_driver_auth_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_dispatch_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.auth_user_id is not null then
      raise exception '기사 로그인 연결(auth_user_id)은 관리자만 설정할 수 있습니다.';
    end if;
  elsif new.auth_user_id is distinct from old.auth_user_id then
    raise exception '기사 로그인 연결(auth_user_id)은 관리자만 변경할 수 있습니다.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_dispatch_driver_auth_user_id() from public;

drop trigger if exists guard_dispatch_driver_auth_user_id on public.dispatch_drivers;
create trigger guard_dispatch_driver_auth_user_id
before insert or update on public.dispatch_drivers
for each row execute function public.guard_dispatch_driver_auth_user_id();

-- ============================================================
-- 4. 배차 등록·수정 RPC + 휴지통 배차 수정 차단
-- ============================================================
-- 운영 DB에서 2026-09-11 확인한 현재 save_dispatch_order() 본문을 기준으로 작성.
-- 직접 dispatch_orders/order_vehicles write 정책은 직원에게 열지 않고,
-- 이 RPC 내부에서만 배차 저장/차량연결 재구성이 가능하도록 SECURITY DEFINER를 사용합니다.
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
  if not public.has_dispatch_permission('dispatch_register') then
    raise exception '배차 저장 권한이 없습니다.';
  end if;

  -- 기존 배차 수정 시 휴지통 자료는 어떤 직원/관리자도 일반 저장 RPC로 수정하지 못하게 차단.
  -- 복구가 필요하면 기존 관리자 전용 restore_dispatch_order()를 먼저 사용해야 합니다.
  if v_id is not null and exists (
    select 1
    from public.dispatch_orders existing_order
    where existing_order.id = v_id
      and existing_order.deleted_at is not null
  ) then
    raise exception '휴지통에 있는 배차는 수정할 수 없습니다. 먼저 관리자 복구가 필요합니다.';
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
-- 5. 삭제/복구/영구삭제: 운영 함수 본문 확인 결과
-- ============================================================
-- 2026-09-11 운영 DB pg_get_functiondef() 결과로 아래 관리자 차단을 확인함.
--
-- delete_dispatch_order:
--   if not public.is_dispatch_admin() then
--     raise exception '배차 삭제 권한이 없습니다.';
--   end if;
--
-- restore_dispatch_order:
--   if not public.is_dispatch_admin() then
--     raise exception '배차 복구 권한이 없습니다.';
--   end if;
--
-- permanently_delete_dispatch_order:
--   if not public.is_dispatch_admin() then
--     raise exception '배차 영구삭제 권한이 없습니다.';
--   end if;
--
-- 세 함수는 변경하지 않습니다. 직원용 DELETE 정책도 생성하지 않습니다.

-- ============================================================
-- 6. 운영 적용 전/후 확인용 읽기 전용 SQL
-- ============================================================
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename like 'dispatch_%'
-- order by tablename, policyname;
--
-- select p.proname,
--        p.prosecdef as security_definer,
--        position('is_dispatch_admin' in pg_get_functiondef(p.oid)) > 0 as checks_admin,
--        position('has_dispatch_permission' in pg_get_functiondef(p.oid)) > 0 as checks_staff_permission
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
