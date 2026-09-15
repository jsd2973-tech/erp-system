alter table public.fuel_records
  add column if not exists receipt_path text,
  add column if not exists receipt_name text,
  add column if not exists receipt_mime_type text,
  add column if not exists receipt_uploaded_at timestamptz;

insert into storage.buckets (id, name, public)
values ('fuel-receipts', 'fuel-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "fuel_receipts_select" on storage.objects;
drop policy if exists "fuel_receipts_insert" on storage.objects;
drop policy if exists "fuel_receipts_update" on storage.objects;
drop policy if exists "fuel_receipts_delete" on storage.objects;

create policy "fuel_receipts_select"
on storage.objects for select
to authenticated
using (bucket_id = 'fuel-receipts' and public.can_manage_fuel());

create policy "fuel_receipts_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fuel-receipts' and public.can_manage_fuel());

create policy "fuel_receipts_update"
on storage.objects for update
to authenticated
using (bucket_id = 'fuel-receipts' and public.can_manage_fuel())
with check (bucket_id = 'fuel-receipts' and public.can_manage_fuel());

create policy "fuel_receipts_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'fuel-receipts' and public.can_manage_fuel());
