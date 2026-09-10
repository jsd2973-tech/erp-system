-- 검토용 초안: 사무실 직원 tm7030@naver.com 에게 운행관리 등록/수정 권한 부여
-- IMPORTANT: 이 파일은 아직 운영 DB에 실행하지 마세요.
-- 목적: dispatch_admin_users 우회 없이, 특정 사무실 직원에게 운행관리 대부분의 조회/등록/수정 권한을 주고
--       DELETE/휴지통/영구삭제는 기존 관리자만 유지합니다.
-- 데이터 행 자체를 수정/삭제하는 SQL은 포함하지 않습니다. 정책/함수 정의만 변경합니다.

-- 1) 특정 사무실 편집자 판정
create or replace function public.is_dispatch_office_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'tm7030@naver.com';
$$;

revoke all on function public.is_dispatch_office_editor() from public;
grant execute on function public.is_dispatch_office_editor() to authenticated;

-- 2) 조회 권한
-- 관리자 또는 지정 사무실 직원은 운행관리 전체 조회 가능
-- 기사 모바일용 기존 제한 SELECT 정책은 그대로 둡니다.

-- 차량
create policy dispatch_vehicles_office_editor_select
on public.dispatch_vehicles
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 기사
create policy dispatch_drivers_office_editor_select
on public.dispatch_drivers
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 배차
create policy dispatch_orders_office_editor_select
on public.dispatch_orders
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 배차-차량 연결
create policy dispatch_order_vehicles_office_editor_select
on public.dispatch_order_vehicles
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 거래처
create policy dispatch_customers_office_editor_select
on public.dispatch_customers
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 상/하차지
create policy dispatch_locations_office_editor_select
on public.dispatch_locations
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 품목
create policy dispatch_items_office_editor_select
on public.dispatch_items
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 운행기록 조회
create policy dispatch_trips_office_editor_select
on public.dispatch_trips
for select
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 3) 등록/수정 권한
-- DELETE는 여기서 허용하지 않습니다.

-- 차량 등록/수정
create policy dispatch_vehicles_office_editor_insert
on public.dispatch_vehicles
for insert
to authenticated
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

create policy dispatch_vehicles_office_editor_update
on public.dispatch_vehicles
for update
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor())
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 기사 등록/수정
create policy dispatch_drivers_office_editor_insert
on public.dispatch_drivers
for insert
to authenticated
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

create policy dispatch_drivers_office_editor_update
on public.dispatch_drivers
for update
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor())
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 거래처 등록/수정
create policy dispatch_customers_office_editor_insert
on public.dispatch_customers
for insert
to authenticated
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

create policy dispatch_customers_office_editor_update
on public.dispatch_customers
for update
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor())
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 상/하차지 등록/수정
create policy dispatch_locations_office_editor_insert
on public.dispatch_locations
for insert
to authenticated
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

create policy dispatch_locations_office_editor_update
on public.dispatch_locations
for update
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor())
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 품목 등록/수정
create policy dispatch_items_office_editor_insert
on public.dispatch_items
for insert
to authenticated
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

create policy dispatch_items_office_editor_update
on public.dispatch_items
for update
to authenticated
using (public.is_dispatch_admin() or public.is_dispatch_office_editor())
with check (public.is_dispatch_admin() or public.is_dispatch_office_editor());

-- 4) 배차 저장 함수 권한 완화
-- 기존 save_dispatch_order()의 관리자 전용 체크를 '관리자 또는 지정 사무실 편집자'로 바꾸는 검토안입니다.
-- 함수 본문 전체를 운영 DB에서 pg_get_functiondef()로 다시 확인한 뒤 동일 본문에 아래 조건만 반영해야 합니다.
-- 기존:
--   if not public.is_dispatch_admin() then
--     raise exception '배차 저장 권한이 없습니다.';
--   end if;
-- 변경:
--   if not (public.is_dispatch_admin() or public.is_dispatch_office_editor()) then
--     raise exception '배차 저장 권한이 없습니다.';
--   end if;
--
-- 주의: 이 초안에서는 함수 전체를 create or replace 하지 않습니다.
-- 운영 함수의 현재 본문을 그대로 보존하기 위해 실제 적용본은 운영 pg_get_functiondef() 결과를 기준으로 작성합니다.

-- 5) 삭제 권한은 기존 관리자 정책 그대로 유지
-- 기존 *_admin FOR ALL 정책이 이미 DELETE를 허용하고 있으므로,
-- office editor용 DELETE 정책은 만들지 않습니다.
-- 또한 삭제 RPC가 있다면 해당 함수 내부 is_dispatch_admin() 체크도 유지해야 합니다.

-- 6) 적용 전 필수 확인용 읽기 전용 SQL
-- 아래는 실행해도 데이터 변경 없음
--
-- select pg_get_functiondef(p.oid)
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'save_dispatch_order';
--
-- select p.proname, pg_get_functiondef(p.oid)
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname ilike '%dispatch%delete%';
