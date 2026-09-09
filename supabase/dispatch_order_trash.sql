-- 배차 휴지통: 삭제 대신 복구 가능한 soft delete 적용
-- 기존 delete_dispatch_order RPC를 휴지통 이동으로 재정의합니다.
-- 기존 배차/운행기록은 삭제하지 않습니다.

alter table public.dispatch_orders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_previous_status text;

create index if not exists dispatch_orders_deleted_at_idx
  on public.dispatch_orders (deleted_at desc)
  where deleted_at is not null;

create or replace function public.delete_dispatch_order(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.dispatch_orders%rowtype;
begin
  if not public.is_dispatch_admin() then
    raise exception '배차 삭제 권한이 없습니다.';
  end if;

  select * into v_order
  from public.dispatch_orders
  where id = p_order_id;

  if v_order.id is null then
    raise exception '삭제할 배차를 찾을 수 없습니다.';
  end if;

  if v_order.deleted_at is not null then
    raise exception '이미 휴지통에 있는 배차입니다.';
  end if;

  if exists (
    select 1
    from public.dispatch_trips
    where dispatch_order_id = p_order_id
      and status in ('상차대기','진행중')
  ) then
    raise exception '진행 중인 운행이 있어 휴지통으로 이동할 수 없습니다. 운행을 완료하거나 취소 상태를 확인해 주세요.';
  end if;

  update public.dispatch_orders
  set deleted_previous_status = status,
      status = '취소',
      deleted_at = now(),
      deleted_by = auth.uid()
  where id = p_order_id;
end;
$$;

create or replace function public.restore_dispatch_order(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.dispatch_orders%rowtype;
  v_restore_status text;
begin
  if not public.is_dispatch_admin() then
    raise exception '배차 복구 권한이 없습니다.';
  end if;

  select * into v_order
  from public.dispatch_orders
  where id = p_order_id;

  if v_order.id is null then
    raise exception '복구할 배차를 찾을 수 없습니다.';
  end if;

  if v_order.deleted_at is null then
    raise exception '휴지통에 있는 배차가 아닙니다.';
  end if;

  v_restore_status := coalesce(nullif(v_order.deleted_previous_status, ''), '대기');
  if v_restore_status not in ('대기','진행중','완료','취소') then
    v_restore_status := '대기';
  end if;

  update public.dispatch_orders
  set status = v_restore_status,
      deleted_at = null,
      deleted_by = null,
      deleted_previous_status = null
  where id = p_order_id;
end;
$$;

create or replace function public.permanently_delete_dispatch_order(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
begin
  if not public.is_dispatch_admin() then
    raise exception '배차 영구삭제 권한이 없습니다.';
  end if;

  select deleted_at into v_deleted_at
  from public.dispatch_orders
  where id = p_order_id;

  if not found then
    raise exception '영구삭제할 배차를 찾을 수 없습니다.';
  end if;

  if v_deleted_at is null then
    raise exception '영구삭제는 휴지통에 있는 배차만 가능합니다.';
  end if;

  delete from public.dispatch_trips
  where dispatch_order_id = p_order_id;

  delete from public.dispatch_orders
  where id = p_order_id;
end;
$$;

revoke all on function public.delete_dispatch_order(text) from public;
revoke all on function public.restore_dispatch_order(text) from public;
revoke all on function public.permanently_delete_dispatch_order(text) from public;

grant execute on function public.delete_dispatch_order(text) to authenticated;
grant execute on function public.restore_dispatch_order(text) to authenticated;
grant execute on function public.permanently_delete_dispatch_order(text) to authenticated;
