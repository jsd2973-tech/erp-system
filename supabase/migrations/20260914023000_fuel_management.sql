create table if not exists public.fuel_records (
  id uuid primary key default gen_random_uuid(),
  fuel_date date not null,
  site_name text not null default '',
  product_name text not null default '경유',
  vehicle_number text not null,
  usage_count integer not null default 1 check (usage_count > 0),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  line_amount numeric(16,2) not null default 0,
  unit_price numeric(16,3) not null default 0,
  supply_amount numeric(16,2) not null default 0,
  vat_amount numeric(16,2) not null default 0,
  total_amount numeric(16,2) not null default 0,
  station_name text not null default '',
  source_file text,
  source_fingerprint text,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fuel_records_source_fingerprint_uidx
  on public.fuel_records(source_fingerprint)
  where source_fingerprint is not null;

create index if not exists fuel_records_date_idx on public.fuel_records(fuel_date desc);
create index if not exists fuel_records_vehicle_idx on public.fuel_records(vehicle_number);
create index if not exists fuel_records_site_idx on public.fuel_records(site_name);

create or replace function public.can_manage_fuel()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_dispatch_admin()
    or exists (
      select 1
      from public.user_permissions up
      where lower(up.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (
          up.role = 'office'
          or coalesce(up.permissions ->> 'fuel_management', 'false') = 'true'
        )
    );
$$;

revoke all on function public.can_manage_fuel() from public;
grant execute on function public.can_manage_fuel() to authenticated;

alter table public.fuel_records enable row level security;

drop policy if exists fuel_records_select on public.fuel_records;
drop policy if exists fuel_records_insert on public.fuel_records;
drop policy if exists fuel_records_update on public.fuel_records;
drop policy if exists fuel_records_delete on public.fuel_records;

create policy fuel_records_select on public.fuel_records
  for select to authenticated
  using (public.can_manage_fuel());

create policy fuel_records_insert on public.fuel_records
  for insert to authenticated
  with check (public.can_manage_fuel());

create policy fuel_records_update on public.fuel_records
  for update to authenticated
  using (public.can_manage_fuel())
  with check (public.can_manage_fuel());

create policy fuel_records_delete on public.fuel_records
  for delete to authenticated
  using (public.can_manage_fuel());

grant select, insert, update, delete on public.fuel_records to authenticated;
