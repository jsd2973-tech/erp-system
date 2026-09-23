-- TEST ONLY. Apply only to nazyeklqgcygfuvzzgql (erp-dispatch-test).
-- This is an E2E fixture schema, not a production migration.

create schema if not exists private;

create or replace function private.erp_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_permissions permission
      where lower(trim(permission.email)) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    );
$$;

revoke all on function private.erp_is_approved() from public;
grant usage on schema private to authenticated;
grant execute on function private.erp_is_approved() to authenticated;

create table if not exists public.e2e_environment (
  environment text primary key check (environment = 'test'),
  project_ref text not null,
  created_at timestamptz not null default now()
);
alter table public.e2e_environment enable row level security;
grant select on public.e2e_environment to authenticated;
drop policy if exists e2e_environment_approved_read on public.e2e_environment;
create policy e2e_environment_approved_read on public.e2e_environment
  for select to authenticated using ((select private.erp_is_approved()));
insert into public.e2e_environment(environment, project_ref)
values ('test', 'nazyeklqgcygfuvzzgql')
on conflict (environment) do update set project_ref = excluded.project_ref;

create table if not exists public.vendors (
  id text primary key,
  code text,
  name text,
  owner text,
  phone text,
  mobile text,
  address text,
  address_detail text
);

create table if not exists public.warehouse_groups (
  id text primary key,
  code text,
  name text
);

create table if not exists public.warehouses (
  id text primary key,
  code text,
  "group" text,
  name text
);

create table if not exists public.items (
  id text primary key,
  code text,
  name text,
  spec text,
  unit text,
  price numeric
);

create table if not exists public.purchases (
  id text primary key,
  date text,
  vendor text,
  warehouse text,
  rows jsonb not null default '[]'::jsonb,
  supplytotal numeric not null default 0,
  vattotal numeric not null default 0,
  total numeric not null default 0,
  itemsummary text not null default '',
  image_url text not null default '',
  image_urls text[] not null default '{}',
  tax_invoice_received boolean not null default false
);

create table if not exists public.maints (
  id text primary key,
  date text,
  warehouse text,
  manager text,
  title text,
  detail text,
  cost numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  "supplyTotal" numeric not null default 0,
  "vatTotal" numeric not null default 0,
  total numeric not null default 0,
  image_url text not null default '',
  image_urls text[] not null default '{}'
);

create table if not exists public.activity_logs (
  id text primary key,
  module text not null default '',
  action text not null default '',
  target_id text not null default '',
  target_title text not null default '',
  detail text not null default '',
  user_email text not null default '',
  user_role text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.deleted_records (
  id text primary key,
  source_table text not null,
  module text not null,
  record_id text not null,
  title text not null default '',
  detail text not null default '',
  data jsonb not null default '{}'::jsonb,
  deleted_by text not null default '',
  deleted_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vendors', 'warehouse_groups', 'warehouses', 'items',
    'purchases', 'maints', 'activity_logs', 'deleted_records'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists e2e_approved_all on public.%I', table_name);
    execute format(
      'create policy e2e_approved_all on public.%I for all to authenticated using ((select private.erp_is_approved())) with check ((select private.erp_is_approved()))',
      table_name
    );
  end loop;
end $$;

create index if not exists e2e_purchases_vendor_date_idx on public.purchases (vendor, date);
create index if not exists e2e_maints_title_date_idx on public.maints (title, date);
notify pgrst, 'reload schema';
