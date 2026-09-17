-- 관리자/배차관리자용 운행 오입력 정정.
-- dispatch_trips 행은 삭제하지 않고 상태·완료 시각·해당 GPS 이벤트만 되돌립니다.

create table if not exists public.dispatch_trip_corrections (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.dispatch_trips(id) on delete cascade,
  action text not null check (action in ('운행시작 취소', '상차완료 취소', '하차완료 취소')),
  reason text not null default '',
  before_status text not null,
  after_status text not null,
  corrected_by uuid references auth.users(id) on delete set null,
  corrected_by_email text not null default '',
  corrected_at timestamptz not null default now()
);

create index if not exists dispatch_trip_corrections_trip_at_idx
  on public.dispatch_trip_corrections (trip_id, corrected_at desc);

alter table public.dispatch_trip_corrections enable row level security;

-- 기존 dispatch_status 조회 권한만 가진 직원까지 정정 권한이 넓어지지 않도록
-- 관리자 테이블 또는 명시적인 dispatch_manager 역할만 허용합니다.
create or replace function public.can_correct_dispatch_trip()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and (
      public.is_dispatch_admin()
      or exists (
        select 1
        from public.user_permissions permission
        join auth.users user_account
          on user_account.id = (select auth.uid())
        where lower(permission.email) = lower(coalesce(user_account.email, ''))
          and lower(coalesce(permission.role, '')) = 'dispatch_manager'
      )
    );
$$;

revoke all on function public.can_correct_dispatch_trip() from public, anon, authenticated;
grant execute on function public.can_correct_dispatch_trip() to authenticated;

revoke all on table public.dispatch_trip_corrections from anon, authenticated;
grant select on table public.dispatch_trip_corrections to authenticated;

drop policy if exists dispatch_trip_corrections_staff_select on public.dispatch_trip_corrections;
create policy dispatch_trip_corrections_staff_select
on public.dispatch_trip_corrections
for select
to authenticated
using ((select public.can_correct_dispatch_trip()));

create or replace function public.correct_dispatch_trip_event(
  p_trip_id uuid,
  p_correction_type text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_trip public.dispatch_trips%rowtype;
  v_correction_type text := btrim(coalesce(p_correction_type, ''));
  v_action text;
  v_reason text := left(btrim(coalesce(p_reason, '')), 500);
  v_before_status text;
  v_after_status text;
  v_correction_id uuid;
  v_corrected_by_email text := coalesce((select email from auth.users where id = (select auth.uid())), '');
  v_order public.dispatch_orders%rowtype;
  v_completed_volume numeric;
  v_has_active_trip boolean;
  v_has_non_cancelled_trip boolean;
begin
  if not public.can_correct_dispatch_trip() then
    raise exception '운행 정정 권한이 없습니다.' using errcode = '42501';
  end if;

  v_action := case v_correction_type
    when 'start_cancel' then '운행시작 취소'
    when 'loading_cancel' then '상차완료 취소'
    when 'unloading_cancel' then '하차완료 취소'
    else null
  end;
  if v_action is null then
    raise exception '지원하지 않는 운행 정정 유형입니다.';
  end if;

  select trip.*
  into v_trip
  from public.dispatch_trips trip
  where trip.id = p_trip_id
  for update;

  if not found then
    raise exception '운행기록을 찾을 수 없습니다.';
  end if;

  v_before_status := v_trip.status;

  if v_correction_type = 'start_cancel' then
    -- 현재 구조에는 별도 started_at이 없고 created_at이 운행기록 생성시각입니다.
    -- 생성시각은 기록 이력으로 보존하고, 잘못 생성된 첫 상태만 취소 상태로 분리합니다.
    if v_trip.status <> '상차대기'
      or v_trip.loading_completed_at is not null
      or v_trip.unloading_completed_at is not null
      or exists (
        select 1 from public.dispatch_trip_locations location
        where location.trip_id = v_trip.id
      ) then
      raise exception '운행시작 취소를 적용할 수 없는 상태입니다. 이미 상차·하차 정보가 있으면 먼저 해당 단계를 정정해 주세요.';
    end if;

    v_after_status := '취소';
    update public.dispatch_trips trip
    set status = v_after_status
    where trip.id = v_trip.id;
  elsif v_correction_type = 'loading_cancel' then
    if v_trip.status <> '진행중'
      or v_trip.loading_completed_at is null
      or v_trip.unloading_completed_at is not null
      or exists (
        select 1
        from public.dispatch_trip_locations location
        where location.trip_id = v_trip.id
          and location.event_type = 'unloading'
      ) then
      raise exception '상차완료 취소를 적용할 수 없는 상태입니다.';
    end if;

    v_after_status := '상차대기';
    update public.dispatch_trips trip
    set status = v_after_status,
        loading_completed_at = null
    where trip.id = v_trip.id;

    delete from public.dispatch_trip_locations location
    where location.trip_id = v_trip.id
      and location.event_type = 'loading';
  else
    if v_trip.status <> '완료'
      or v_trip.unloading_completed_at is null
      or v_trip.loading_completed_at is null then
      raise exception '하차완료 취소를 적용할 수 없는 상태입니다.';
    end if;

    v_after_status := '진행중';
    update public.dispatch_trips trip
    set status = v_after_status,
        unloading_completed_at = null
    where trip.id = v_trip.id;

    delete from public.dispatch_trip_locations location
    where location.trip_id = v_trip.id
      and location.event_type = 'unloading';
  end if;

  -- 연결 배차를 잠가 다른 회차 완료와 상태 재계산이 서로 덮어쓰지 않게 합니다.
  select dispatch_order.*
  into v_order
  from public.dispatch_orders dispatch_order
  where dispatch_order.id = v_trip.dispatch_order_id
  for update;

  if not found then
    raise exception '해당 운행의 배차를 찾을 수 없습니다.';
  end if;

  -- 완료 RPC와 같은 기준으로 연결 배차 상태를 다시 계산합니다.
  -- actual_volume은 NOT NULL + 양수 제약이고 재하차 시 모바일 입력 기본값으로도 쓰이므로 보존합니다.
  select
    coalesce(sum(trip.actual_volume) filter (where trip.status = '완료'), 0),
    coalesce(bool_or(trip.status in ('상차대기', '진행중')), false),
    coalesce(bool_or(trip.status <> '취소'), false)
  into v_completed_volume, v_has_active_trip, v_has_non_cancelled_trip
  from public.dispatch_trips trip
  where trip.dispatch_order_id = v_trip.dispatch_order_id;

  update public.dispatch_orders dispatch_order
  set status = case
    when v_completed_volume >= v_order.total_volume then '완료'
    when v_has_active_trip or v_has_non_cancelled_trip then '진행중'
    else '대기'
  end
  where dispatch_order.id = v_trip.dispatch_order_id
    and dispatch_order.status <> '취소';

  insert into public.dispatch_trip_corrections (
    trip_id,
    action,
    reason,
    before_status,
    after_status,
    corrected_by,
    corrected_by_email
  ) values (
    v_trip.id,
    v_action,
    v_reason,
    v_before_status,
    v_after_status,
    (select auth.uid()),
    v_corrected_by_email
  ) returning id into v_correction_id;

  return jsonb_build_object(
    'correction_id', v_correction_id,
    'trip_id', v_trip.id,
    'action', v_action,
    'before_status', v_before_status,
    'after_status', v_after_status,
    'actual_volume', v_trip.actual_volume
  );
end;
$$;

revoke all on function public.correct_dispatch_trip_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.correct_dispatch_trip_event(uuid, text, text) to authenticated;
