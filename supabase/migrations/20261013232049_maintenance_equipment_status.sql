-- Equipment overview reads live maintenance rows; it never copies/deletes them.
-- Workbook business data is imported separately and is not stored in this repo.
create or replace function private.erp_can_read_maintenance_equipment()
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select private.erp_is_approved()) and (
    not exists (select 1 from public.user_permissions p where lower(trim(p.email)) = lower(coalesce((select auth.jwt()->>'email'), '')))
    or exists (
      select 1 from public.user_permissions p
      where lower(trim(p.email)) = lower(coalesce((select auth.jwt()->>'email'), ''))
        and (p.role in ('admin','office') or (p.role = 'field' and (
          coalesce(p.permissions->>'maint_new', 'false') = 'true'
          or coalesce(p.permissions->>'maint_equipment', 'false') = 'true'
          or (not (coalesce(p.permissions, '{}'::jsonb) ? 'maint_equipment') and coalesce(p.permissions->>'maint_list','false') = 'true')
        )))
    )
  );
$$;

create or replace function private.erp_can_manage_maintenance_equipment(p_edit boolean default true)
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select private.erp_is_approved()) and (
    not exists (select 1 from public.user_permissions p where lower(trim(p.email)) = lower(coalesce((select auth.jwt()->>'email'), '')))
    or exists (select 1 from public.user_permissions p
      where lower(trim(p.email)) = lower(coalesce((select auth.jwt()->>'email'), ''))
      and (p.role = 'admin' or (not p_edit and p.role = 'office')))
  );
$$;
revoke all on function private.erp_can_read_maintenance_equipment() from public, anon;
revoke all on function private.erp_can_manage_maintenance_equipment(boolean) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.erp_can_read_maintenance_equipment() to authenticated;
grant execute on function private.erp_can_manage_maintenance_equipment(boolean) to authenticated;

create table public.maintenance_equipment_items (
  id text primary key default gen_random_uuid()::text,
  category text not null check (length(trim(category)) > 0),
  name text not null check (length(trim(name)) > 0),
  spec text not null default '',
  dimensions text not null default '',
  bearing text not null default '',
  rollers text not null default '',
  notes text not null default '',
  shared_note_key text,
  warehouse_id text references public.warehouses(id) on delete set null,
  sort_order integer not null default 0,
  cycle_method text not null default 'none' check (cycle_method in ('none','average','fixed')),
  cycle_intervals integer not null default 3 check (cycle_intervals between 1 and 10),
  fixed_cycle_days numeric(12,4) check (fixed_cycle_days > 0),
  baseline_cycle_days numeric(12,4) check (baseline_cycle_days > 0),
  expected_override date,
  source_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint maintenance_equipment_fixed_cycle check (cycle_method <> 'fixed' or fixed_cycle_days is not null)
);

create table public.maintenance_equipment_history (
  id text primary key default gen_random_uuid()::text,
  equipment_item_id text not null references public.maintenance_equipment_items(id) on delete restrict,
  work_date date,
  date_text text not null default '',
  vendor_label text not null default '',
  work_detail text not null default '',
  work_type text not null default 'legacy' check (work_type in ('legacy','replacement','repair','inspection','installation','improvement')),
  cost numeric(18,2) check (cost >= 0),
  cycle_included boolean not null default false,
  source_rank integer not null default 0,
  source_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint maintenance_equipment_cycle_date check (not cycle_included or work_date is not null),
  constraint maintenance_equipment_inspection_cycle check (work_type <> 'inspection' or not cycle_included)
);

create table public.maintenance_equipment_settings (
  id text primary key check (id = 'crusher'),
  title text not null default '크라샤 설비현황' check (length(trim(title)) > 0),
  common_note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
insert into public.maintenance_equipment_settings(id) values ('crusher');

alter table public.maints
  add column equipment_item_id text references public.maintenance_equipment_items(id) on delete restrict,
  add column equipment_work_type text check (equipment_work_type in ('replacement','repair','inspection','installation','improvement')),
  add column equipment_vendor text not null default '',
  add column equipment_cycle_included boolean not null default false,
  add constraint maints_equipment_cycle check (
    not equipment_cycle_included or (equipment_item_id is not null and equipment_work_type is not null and equipment_work_type <> 'inspection')
  );

create index maints_equipment_history_idx on public.maints (equipment_item_id, date desc, id desc) where equipment_item_id is not null;
create index maintenance_equipment_history_item_idx on public.maintenance_equipment_history (equipment_item_id, work_date desc, source_rank, id);
create index maintenance_equipment_items_sort_idx on public.maintenance_equipment_items (sort_order, id);
create index maintenance_equipment_items_warehouse_idx on public.maintenance_equipment_items (warehouse_id) where warehouse_id is not null;
create index maintenance_equipment_items_shared_note_idx on public.maintenance_equipment_items (shared_note_key) where shared_note_key is not null;

create or replace function private.maintenance_equipment_stamp()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  new.updated_by = auth.uid();
  return new;
end;
$$;
revoke all on function private.maintenance_equipment_stamp() from public, anon;
grant execute on function private.maintenance_equipment_stamp() to authenticated;

create trigger maintenance_equipment_items_stamp before update on public.maintenance_equipment_items for each row execute function private.maintenance_equipment_stamp();
create trigger maintenance_equipment_history_stamp before update on public.maintenance_equipment_history for each row execute function private.maintenance_equipment_stamp();
create trigger maintenance_equipment_settings_stamp before update on public.maintenance_equipment_settings for each row execute function private.maintenance_equipment_stamp();

alter table public.maintenance_equipment_items enable row level security;
alter table public.maintenance_equipment_history enable row level security;
alter table public.maintenance_equipment_settings enable row level security;
revoke all on public.maintenance_equipment_items, public.maintenance_equipment_history, public.maintenance_equipment_settings from anon, public;
grant select, insert, update, delete on public.maintenance_equipment_items, public.maintenance_equipment_history to authenticated;
grant select, update on public.maintenance_equipment_settings to authenticated;

create policy maintenance_equipment_items_read on public.maintenance_equipment_items for select to authenticated using ((select private.erp_can_read_maintenance_equipment()));
create policy maintenance_equipment_items_insert on public.maintenance_equipment_items for insert to authenticated with check ((select private.erp_can_manage_maintenance_equipment(false)));
create policy maintenance_equipment_items_update on public.maintenance_equipment_items for update to authenticated using ((select private.erp_can_manage_maintenance_equipment(true))) with check ((select private.erp_can_manage_maintenance_equipment(true)));
create policy maintenance_equipment_items_delete on public.maintenance_equipment_items for delete to authenticated using ((select private.erp_can_manage_maintenance_equipment(true)));
create policy maintenance_equipment_history_read on public.maintenance_equipment_history for select to authenticated using ((select private.erp_can_read_maintenance_equipment()));
create policy maintenance_equipment_history_insert on public.maintenance_equipment_history for insert to authenticated with check ((select private.erp_can_manage_maintenance_equipment(true)));
create policy maintenance_equipment_history_update on public.maintenance_equipment_history for update to authenticated using ((select private.erp_can_manage_maintenance_equipment(true))) with check ((select private.erp_can_manage_maintenance_equipment(true)));
create policy maintenance_equipment_history_delete on public.maintenance_equipment_history for delete to authenticated using ((select private.erp_can_manage_maintenance_equipment(true)));
create policy maintenance_equipment_settings_read on public.maintenance_equipment_settings for select to authenticated using ((select private.erp_can_read_maintenance_equipment()));
create policy maintenance_equipment_settings_update on public.maintenance_equipment_settings for update to authenticated using ((select private.erp_can_manage_maintenance_equipment(true))) with check ((select private.erp_can_manage_maintenance_equipment(true)));

-- Atomically update the selected item and the workbook's shared-note block.
-- Optimistic concurrency prevents silently overwriting another operator's edit.
create function public.save_maintenance_equipment_item(p_id text, p_expected_updated_at timestamptz, p_values jsonb)
returns setof public.maintenance_equipment_items
language plpgsql security invoker set search_path = '' as $$
declare old_item public.maintenance_equipment_items%rowtype; note_key text;
begin
  if not (select private.erp_can_manage_maintenance_equipment(true)) then
    raise exception '관리자만 설비 기본정보를 수정할 수 있습니다.' using errcode = '42501';
  end if;
  select shared_note_key into note_key from public.maintenance_equipment_items where id = p_id;
  perform id from public.maintenance_equipment_items where id = p_id or (note_key is not null and shared_note_key = note_key) order by id for update;
  select * into old_item from public.maintenance_equipment_items where id = p_id;
  if not found or old_item.updated_at is distinct from p_expected_updated_at then
    raise exception '다른 사용자가 수정한 항목입니다. 새로고침 후 다시 수정해주세요.' using errcode = '40001';
  end if;
  update public.maintenance_equipment_items set
    category = p_values->>'category', name = p_values->>'name',
    spec = coalesce(p_values->>'spec',''), dimensions = coalesce(p_values->>'dimensions',''),
    bearing = coalesce(p_values->>'bearing',''), rollers = coalesce(p_values->>'rollers',''),
    notes = coalesce(p_values->>'notes',''),
    warehouse_id = nullif(p_values->>'warehouse_id',''),
    cycle_method = coalesce(p_values->>'cycle_method','none'),
    cycle_intervals = coalesce((p_values->>'cycle_intervals')::integer,3),
    fixed_cycle_days = nullif(p_values->>'fixed_cycle_days','')::numeric,
    expected_override = nullif(p_values->>'expected_override','')::date
  where id = p_id;
  if old_item.shared_note_key is not null and old_item.notes is distinct from coalesce(p_values->>'notes','') then
    update public.maintenance_equipment_items set notes = coalesce(p_values->>'notes','')
      where shared_note_key = old_item.shared_note_key and id <> p_id;
  end if;
  return query select * from public.maintenance_equipment_items
    where id = p_id or (old_item.shared_note_key is not null and shared_note_key = old_item.shared_note_key);
end;
$$;
revoke all on function public.save_maintenance_equipment_item(text,timestamptz,jsonb) from public, anon;
grant execute on function public.save_maintenance_equipment_item(text,timestamptz,jsonb) to authenticated;
notify pgrst, 'reload schema';
