create table if not exists public.dispatch_trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.dispatch_trips(id) on delete cascade,
  event_type text not null check (event_type in ('loading','unloading')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  address text,
  captured_at timestamptz not null default now(),
  unique (trip_id, event_type)
);

alter table public.dispatch_trip_locations enable row level security;

create or replace function public.can_view_dispatch_trip_locations()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then false
    when public.is_dispatch_admin() then true
    else exists (
      select 1
      from public.user_permissions p
      join auth.users u on u.id = auth.uid()
      where lower(p.email) = lower(coalesce(u.email,''))
        and p.permissions ->> 'dispatch_location' = 'true'
    )
  end;
$$;

revoke all on function public.can_view_dispatch_trip_locations() from public;
revoke execute on function public.can_view_dispatch_trip_locations() from anon;
grant execute on function public.can_view_dispatch_trip_locations() to authenticated;

drop policy if exists dispatch_trip_locations_read_authorized on public.dispatch_trip_locations;
create policy dispatch_trip_locations_read_authorized
on public.dispatch_trip_locations
for select
to authenticated
using (public.can_view_dispatch_trip_locations());

revoke all on table public.dispatch_trip_locations from anon;
revoke insert, update, delete on table public.dispatch_trip_locations from authenticated;
grant select on table public.dispatch_trip_locations to authenticated;

create or replace function public.complete_dispatch_loading_with_location(
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_address text default null
)
returns public.dispatch_trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip public.dispatch_trips%rowtype;
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception '올바르지 않은 위치 좌표입니다.';
  end if;

  v_trip := public.complete_dispatch_loading(p_trip_id);

  insert into public.dispatch_trip_locations (trip_id, event_type, latitude, longitude, accuracy_m, address, captured_at)
  values (p_trip_id, 'loading', p_latitude, p_longitude, p_accuracy_m, nullif(trim(p_address), ''), now())
  on conflict (trip_id, event_type) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    address = excluded.address,
    captured_at = excluded.captured_at;

  return v_trip;
end;
$$;

create or replace function public.complete_dispatch_unloading_with_location(
  p_trip_id uuid,
  p_actual_volume numeric default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null,
  p_address text default null
)
returns public.dispatch_trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip public.dispatch_trips%rowtype;
begin
  if p_latitude is null or p_longitude is null then
    raise exception '하차 완료 위치를 확인할 수 없습니다.';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception '올바르지 않은 위치 좌표입니다.';
  end if;

  v_trip := public.complete_dispatch_unloading(p_trip_id, p_actual_volume);

  insert into public.dispatch_trip_locations (trip_id, event_type, latitude, longitude, accuracy_m, address, captured_at)
  values (p_trip_id, 'unloading', p_latitude, p_longitude, p_accuracy_m, nullif(trim(p_address), ''), now())
  on conflict (trip_id, event_type) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    address = excluded.address,
    captured_at = excluded.captured_at;

  return v_trip;
end;
$$;

revoke all on function public.complete_dispatch_loading_with_location(uuid,double precision,double precision,double precision,text) from public;
revoke execute on function public.complete_dispatch_loading_with_location(uuid,double precision,double precision,double precision,text) from anon;
grant execute on function public.complete_dispatch_loading_with_location(uuid,double precision,double precision,double precision,text) to authenticated;

revoke all on function public.complete_dispatch_unloading_with_location(uuid,numeric,double precision,double precision,double precision,text) from public;
revoke execute on function public.complete_dispatch_unloading_with_location(uuid,numeric,double precision,double precision,double precision,text) from anon;
grant execute on function public.complete_dispatch_unloading_with_location(uuid,numeric,double precision,double precision,double precision,text) to authenticated;
