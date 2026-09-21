create table if not exists public.maintenance_purchase_links (
  id uuid primary key default gen_random_uuid(),
  maintenance_id text not null references public.maints(id) on delete restrict,
  maintenance_row_id text not null,
  purchase_id text not null references public.purchases(id) on delete restrict,
  purchase_row_id text not null,
  item_name text not null default '',
  spec text not null default '',
  used_qty numeric(14, 3) not null check (used_qty > 0),
  unit_price_snapshot numeric(18, 2) not null default 0 check (unit_price_snapshot >= 0),
  purchase_date_snapshot text not null default '',
  vendor_snapshot text not null default '',
  maintenance_date_snapshot text not null default '',
  maintenance_equipment_snapshot text not null default '',
  maintenance_title_snapshot text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint maintenance_purchase_links_unique_line
    unique (maintenance_id, maintenance_row_id, purchase_id, purchase_row_id)
);

create index if not exists maintenance_purchase_links_purchase_line_idx
  on public.maintenance_purchase_links (purchase_id, purchase_row_id);

create index if not exists maintenance_purchase_links_maintenance_row_idx
  on public.maintenance_purchase_links (maintenance_id, maintenance_row_id);

alter table public.maintenance_purchase_links enable row level security;

revoke all on table public.maintenance_purchase_links from anon, public;
grant select, insert, update, delete on table public.maintenance_purchase_links to authenticated;

create or replace function private.erp_can_write_maintenance_purchase_link()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      (select private.erp_is_approved())
      and exists (
        select 1
        from public.user_permissions permission
        where lower(trim(permission.email)) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          and (
            permission.role in ('admin', 'office')
            or (
              permission.role = 'field'
              and coalesce((permission.permissions ->> 'maint_new')::boolean, false)
            )
          )
      )
    )
    or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'jsd2973@gmail.com';
$$;

revoke all on function private.erp_can_write_maintenance_purchase_link() from public;
grant execute on function private.erp_can_write_maintenance_purchase_link() to authenticated;

drop policy if exists maintenance_purchase_links_select on public.maintenance_purchase_links;
create policy maintenance_purchase_links_select
  on public.maintenance_purchase_links
  for select
  to authenticated
  using ((select private.erp_is_approved()));

drop policy if exists maintenance_purchase_links_insert on public.maintenance_purchase_links;
create policy maintenance_purchase_links_insert
  on public.maintenance_purchase_links
  for insert
  to authenticated
  with check ((select private.erp_can_write_maintenance_purchase_link()));

drop policy if exists maintenance_purchase_links_update on public.maintenance_purchase_links;
create policy maintenance_purchase_links_update
  on public.maintenance_purchase_links
  for update
  to authenticated
  using ((select private.erp_can_write_maintenance_purchase_link()))
  with check ((select private.erp_can_write_maintenance_purchase_link()));

drop policy if exists maintenance_purchase_links_delete on public.maintenance_purchase_links;
create policy maintenance_purchase_links_delete
  on public.maintenance_purchase_links
  for delete
  to authenticated
  using ((select private.erp_can_write_maintenance_purchase_link()));
