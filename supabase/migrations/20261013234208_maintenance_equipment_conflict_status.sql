-- Optimistic edit conflicts are HTTP 409, not transient server failures.
create or replace function public.save_maintenance_equipment_item(p_id text, p_expected_updated_at timestamptz, p_values jsonb)
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
    raise exception '다른 사용자가 수정한 항목입니다. 새로고침 후 다시 수정해주세요.' using errcode = 'PT409';
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
notify pgrst, 'reload schema';
