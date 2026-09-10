-- TEST ONLY: 별도 Supabase 테스트 프로젝트용 최소 지원 스키마
-- 운영 DB에는 실행하지 마세요.
-- 선행: dispatch_phase1.sql 적용 완료 (is_dispatch_admin 필요)

create table if not exists public.user_permissions (
  id text primary key,
  email text not null unique,
  role text not null default 'field' check (role in ('admin','office','field')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_permissions enable row level security;

grant select, insert, update, delete on public.user_permissions to authenticated;

drop policy if exists user_permissions_admin_all on public.user_permissions;
create policy user_permissions_admin_all
on public.user_permissions
for all
to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());

drop policy if exists user_permissions_read_own on public.user_permissions;
create policy user_permissions_read_own
on public.user_permissions
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 실제 QA 계정 생성은 Authentication > Users에서 수행합니다.
-- 운영 이메일/전화번호/개인정보를 복사하지 말고 아래와 같은 가상 계정만 사용하세요.
-- qa.admin@example.com
-- qa.vehicle@example.com
-- qa.driveradmin@example.com
-- qa.basics@example.com
-- qa.register@example.com
-- qa.mobile.driver@example.com
--
-- 계정 생성 후 관리자 UUID만 dispatch_admin_users에 등록하고,
-- 직원 권한은 앱 권한관리 화면 또는 아래 형식으로 TEST DB에만 넣으세요.
-- 예시(직접 실행 전 id/email을 확인):
-- insert into public.user_permissions(id,email,role,permissions) values
-- ('qa-vehicle','qa.vehicle@example.com','office','{"dispatch_vehicles":true}'::jsonb),
-- ('qa-driveradmin','qa.driveradmin@example.com','office','{"dispatch_drivers":true}'::jsonb),
-- ('qa-basics','qa.basics@example.com','office','{"dispatch_basics":true}'::jsonb),
-- ('qa-register','qa.register@example.com','office','{"dispatch_register":true}'::jsonb)
-- on conflict (email) do update set role = excluded.role, permissions = excluded.permissions;
