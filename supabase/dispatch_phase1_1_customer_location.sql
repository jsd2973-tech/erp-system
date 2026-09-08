-- 배차관리 1.1: 덤프 전용 거래처 및 장소 마스터
-- 선행 조건: dispatch_phase1.sql 적용 완료
-- 기존 ERP 및 기존 배차 테이블/데이터는 변경하지 않습니다.

create table if not exists public.dispatch_customers (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dispatch_customers_normalized_name_key
  on public.dispatch_customers ((regexp_replace(lower(btrim(name)), '\s+', ' ', 'g')));

create table if not exists public.dispatch_locations (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  location_type text not null default '공용' check (location_type in ('상차지','하차지','공용')),
  active boolean not null default true,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dispatch_locations_normalized_name_key
  on public.dispatch_locations ((regexp_replace(lower(btrim(name)), '\s+', ' ', 'g')));

drop trigger if exists dispatch_customers_updated_at on public.dispatch_customers;
create trigger dispatch_customers_updated_at before update on public.dispatch_customers
for each row execute function public.set_dispatch_updated_at();

drop trigger if exists dispatch_locations_updated_at on public.dispatch_locations;
create trigger dispatch_locations_updated_at before update on public.dispatch_locations
for each row execute function public.set_dispatch_updated_at();

alter table public.dispatch_customers enable row level security;
alter table public.dispatch_locations enable row level security;

grant select, insert, update, delete on public.dispatch_customers to authenticated;
grant select, insert, update, delete on public.dispatch_locations to authenticated;

drop policy if exists dispatch_customers_admin on public.dispatch_customers;
create policy dispatch_customers_admin on public.dispatch_customers for all to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());

drop policy if exists dispatch_locations_admin on public.dispatch_locations;
create policy dispatch_locations_admin on public.dispatch_locations for all to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());
