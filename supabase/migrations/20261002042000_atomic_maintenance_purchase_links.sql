create or replace function public.replace_maintenance_purchase_links(
  p_maintenance_id text,
  p_links jsonb default '[]'::jsonb
)
returns setof public.maintenance_purchase_links
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_maintenance_id is null or btrim(p_maintenance_id) = '' then
    raise exception 'maintenance id is required';
  end if;

  if p_links is null then
    p_links := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_links) <> 'array' then
    raise exception 'p_links must be a json array';
  end if;

  delete from public.maintenance_purchase_links
  where maintenance_id = p_maintenance_id;

  if jsonb_array_length(p_links) = 0 then
    return;
  end if;

  return query
  insert into public.maintenance_purchase_links (
    id,
    maintenance_id,
    maintenance_row_id,
    purchase_id,
    purchase_row_id,
    item_name,
    spec,
    used_qty,
    unit_price_snapshot,
    purchase_date_snapshot,
    vendor_snapshot,
    maintenance_date_snapshot,
    maintenance_equipment_snapshot,
    maintenance_title_snapshot,
    created_by,
    created_at
  )
  select
    coalesce(nullif(link ->> 'id', '')::uuid, gen_random_uuid()),
    p_maintenance_id,
    coalesce(link ->> 'maintenance_row_id', ''),
    coalesce(link ->> 'purchase_id', ''),
    coalesce(link ->> 'purchase_row_id', ''),
    coalesce(link ->> 'item_name', ''),
    coalesce(link ->> 'spec', ''),
    coalesce(nullif(link ->> 'used_qty', '')::numeric, 0),
    coalesce(nullif(link ->> 'unit_price_snapshot', '')::numeric, 0),
    coalesce(link ->> 'purchase_date_snapshot', ''),
    coalesce(link ->> 'vendor_snapshot', ''),
    coalesce(link ->> 'maintenance_date_snapshot', ''),
    coalesce(link ->> 'maintenance_equipment_snapshot', ''),
    coalesce(link ->> 'maintenance_title_snapshot', ''),
    coalesce(nullif(link ->> 'created_by', '')::uuid, auth.uid()),
    coalesce(nullif(link ->> 'created_at', '')::timestamptz, now())
  from pg_catalog.jsonb_array_elements(p_links) as link
  returning public.maintenance_purchase_links.*;
end;
$$;

revoke all on function public.replace_maintenance_purchase_links(text, jsonb) from public, anon;
grant execute on function public.replace_maintenance_purchase_links(text, jsonb) to authenticated;
