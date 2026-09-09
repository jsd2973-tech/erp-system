-- 배차관리 관리자 전용 배차 삭제 RPC
-- 운행기록(dispatch_trips)을 먼저 삭제한 뒤 배차(dispatch_orders)를 삭제합니다.
-- dispatch_order_vehicles는 dispatch_orders FK의 ON DELETE CASCADE로 자동 정리됩니다.

create or replace function public.delete_dispatch_order(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dispatch_admin() then
    raise exception '배차 삭제 권한이 없습니다.';
  end if;

  if not exists (
    select 1
    from public.dispatch_orders
    where id = p_order_id
  ) then
    raise exception '삭제할 배차를 찾을 수 없습니다.';
  end if;

  delete from public.dispatch_trips
  where dispatch_order_id = p_order_id;

  delete from public.dispatch_orders
  where id = p_order_id;
end;
$$;

revoke all on function public.delete_dispatch_order(text) from public;
grant execute on function public.delete_dispatch_order(text) to authenticated;
