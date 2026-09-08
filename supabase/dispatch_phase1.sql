-- 25.5톤 덤프 배차관리 1차 신규 테이블
-- 기존 ERP 테이블은 변경하지 않습니다. Supabase SQL Editor에서 한 번 실행하세요.

create table if not exists public.dispatch_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 최초 1회 아래 주석을 풀고 Authentication > Users의 관리자 UUID를 넣어 실행하세요.
-- insert into public.dispatch_admin_users (user_id) values ('관리자-USER-UUID') on conflict do nothing;

create table if not exists public.dispatch_vehicles (
  id text primary key,
  vehicle_number text not null check (btrim(vehicle_number) <> ''),
  active boolean not null default true,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dispatch_vehicles_vehicle_number_key
  on public.dispatch_vehicles ((regexp_replace(lower(vehicle_number), '\s', '', 'g')));

create table if not exists public.dispatch_drivers (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  phone text not null default '',
  assigned_vehicle_id text references public.dispatch_vehicles(id) on delete set null,
  active boolean not null default true,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispatch_orders (
  id text primary key,
  dispatch_date date not null,
  vendor_id text,
  vendor_name text not null,
  loading_location text not null,
  unloading_location text not null,
  item_id text,
  item_name text not null,
  total_volume numeric(12,2) not null check (total_volume > 0),
  volume_per_trip numeric(12,2) not null default 17 check (volume_per_trip > 0),
  estimated_trip_count integer not null check (estimated_trip_count > 0),
  status text not null default '대기' check (status in ('대기','진행중','완료','취소')),
  memo text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispatch_order_vehicles (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.dispatch_orders(id) on delete cascade,
  vehicle_id text not null references public.dispatch_vehicles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (order_id, vehicle_id)
);

create index if not exists dispatch_orders_date_idx on public.dispatch_orders(dispatch_date desc);
create index if not exists dispatch_orders_status_idx on public.dispatch_orders(status);
create index if not exists dispatch_order_vehicles_order_idx on public.dispatch_order_vehicles(order_id);
create index if not exists dispatch_order_vehicles_vehicle_idx on public.dispatch_order_vehicles(vehicle_id);

create or replace function public.set_dispatch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dispatch_vehicles_updated_at on public.dispatch_vehicles;
create trigger dispatch_vehicles_updated_at before update on public.dispatch_vehicles
for each row execute function public.set_dispatch_updated_at();

drop trigger if exists dispatch_drivers_updated_at on public.dispatch_drivers;
create trigger dispatch_drivers_updated_at before update on public.dispatch_drivers
for each row execute function public.set_dispatch_updated_at();

drop trigger if exists dispatch_orders_updated_at on public.dispatch_orders;
create trigger dispatch_orders_updated_at before update on public.dispatch_orders
for each row execute function public.set_dispatch_updated_at();

alter table public.dispatch_vehicles enable row level security;
alter table public.dispatch_drivers enable row level security;
alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_vehicles enable row level security;
alter table public.dispatch_admin_users enable row level security;

grant select, insert, update, delete on public.dispatch_vehicles to authenticated;
grant select, insert, update, delete on public.dispatch_drivers to authenticated;
grant select, insert, update, delete on public.dispatch_orders to authenticated;
grant select, insert, update, delete on public.dispatch_order_vehicles to authenticated;
grant select on public.dispatch_admin_users to authenticated;

create or replace function public.is_dispatch_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dispatch_admin_users admin_user
    where admin_user.user_id = auth.uid()
  );
$$;

revoke all on function public.is_dispatch_admin() from public;
grant execute on function public.is_dispatch_admin() to authenticated;

drop policy if exists dispatch_admin_users_read_own on public.dispatch_admin_users;
create policy dispatch_admin_users_read_own on public.dispatch_admin_users for select to authenticated
using (user_id = auth.uid());

drop policy if exists dispatch_vehicles_admin on public.dispatch_vehicles;
create policy dispatch_vehicles_admin on public.dispatch_vehicles for all to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());

drop policy if exists dispatch_drivers_admin on public.dispatch_drivers;
create policy dispatch_drivers_admin on public.dispatch_drivers for all to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());

drop policy if exists dispatch_orders_admin on public.dispatch_orders;
create policy dispatch_orders_admin on public.dispatch_orders for all to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());

drop policy if exists dispatch_order_vehicles_admin on public.dispatch_order_vehicles;
create policy dispatch_order_vehicles_admin on public.dispatch_order_vehicles for all to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());

create or replace function public.save_dispatch_order(p_order jsonb, p_vehicle_ids text[] default array[]::text[])
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := nullif(trim(p_order ->> 'id'), '');
  v_total numeric := nullif(p_order ->> 'total_volume', '')::numeric;
  v_per_trip numeric := nullif(p_order ->> 'volume_per_trip', '')::numeric;
  v_status text := coalesce(nullif(trim(p_order ->> 'status'), ''), '대기');
begin
  if not public.is_dispatch_admin() then
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
  where exists (select 1 from public.dispatch_vehicles vehicle where vehicle.id = selected.vehicle_id)
  on conflict (order_id, vehicle_id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.save_dispatch_order(jsonb, text[]) from public;
grant execute on function public.save_dispatch_order(jsonb, text[]) to authenticated;
