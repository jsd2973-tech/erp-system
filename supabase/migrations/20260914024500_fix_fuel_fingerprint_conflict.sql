drop index if exists public.fuel_records_source_fingerprint_uidx;

create unique index fuel_records_source_fingerprint_uidx
  on public.fuel_records(source_fingerprint);
