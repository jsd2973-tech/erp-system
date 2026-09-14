-- Allow explicitly permitted staff to read transport results without granting admin-only mutations.
create or replace function public.has_dispatch_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case
    when (select auth.uid()) is null then false
    when public.is_dispatch_admin() then true
    when coalesce(p_permission,'') not in (
      'dispatch_register','dispatch_list','dispatch_status','dispatch_results',
      'dispatch_vehicles','dispatch_drivers','dispatch_basics'
    ) then false
    else exists(
      select 1
      from public.user_permissions p
      join auth.users u on u.id=(select auth.uid())
      where lower(p.email)=lower(coalesce(u.email,''))
        and p.permissions->>p_permission='true'
    )
  end
$$;

revoke all on function public.has_dispatch_permission(text) from public, anon;
grant execute on function public.has_dispatch_permission(text) to authenticated;

drop policy if exists dispatch_orders_staff_select on public.dispatch_orders;
create policy dispatch_orders_staff_select on public.dispatch_orders
for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
  or public.has_dispatch_permission('dispatch_results')
);

drop policy if exists dispatch_order_vehicles_staff_select on public.dispatch_order_vehicles;
create policy dispatch_order_vehicles_staff_select on public.dispatch_order_vehicles
for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
  or public.has_dispatch_permission('dispatch_results')
);

drop policy if exists dispatch_trips_staff_select on public.dispatch_trips;
create policy dispatch_trips_staff_select on public.dispatch_trips
for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
  or public.has_dispatch_permission('dispatch_results')
);

drop policy if exists dispatch_vehicles_staff_select on public.dispatch_vehicles;
create policy dispatch_vehicles_staff_select on public.dispatch_vehicles
for select to authenticated
using (
  public.has_dispatch_permission('dispatch_register')
  or public.has_dispatch_permission('dispatch_list')
  or public.has_dispatch_permission('dispatch_status')
  or public.has_dispatch_permission('dispatch_results')
  or public.has_dispatch_permission('dispatch_vehicles')
  or public.has_dispatch_permission('dispatch_drivers')
);