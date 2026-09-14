create table if not exists public.fuel_master_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('vehicle','station','product','site')),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, name)
);

alter table public.fuel_master_options enable row level security;

drop policy if exists fuel_master_options_select on public.fuel_master_options;
drop policy if exists fuel_master_options_insert on public.fuel_master_options;
drop policy if exists fuel_master_options_update on public.fuel_master_options;
drop policy if exists fuel_master_options_delete on public.fuel_master_options;

create policy fuel_master_options_select on public.fuel_master_options
  for select to authenticated using (public.can_manage_fuel());
create policy fuel_master_options_insert on public.fuel_master_options
  for insert to authenticated with check (public.can_manage_fuel());
create policy fuel_master_options_update on public.fuel_master_options
  for update to authenticated using (public.can_manage_fuel()) with check (public.can_manage_fuel());
create policy fuel_master_options_delete on public.fuel_master_options
  for delete to authenticated using (public.can_manage_fuel());

insert into public.fuel_master_options(category, name)
select distinct category, name
from (
  select 'vehicle'::text category, trim(vehicle_number) name from public.fuel_records
  union all select 'station', trim(station_name) from public.fuel_records
  union all select 'product', trim(product_name) from public.fuel_records
  union all select 'site', trim(site_name) from public.fuel_records
  union all select 'station', '남세종농협주유소'
  union all select 'station', '믿음주유소'
  union all select 'product', '경유'
  union all select 'product', '요소수'
  union all select 'site', '공장'
) s
where name <> ''
on conflict(category, name) do nothing;
