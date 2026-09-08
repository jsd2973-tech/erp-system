-- 배차관리 1.2: 덤프 전용 품목
-- 기존 구매 품목 및 기존 배차 데이터는 변경하지 않습니다.

create table if not exists public.dispatch_items (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dispatch_items_normalized_name_uq
  on public.dispatch_items ((lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))));

drop trigger if exists set_dispatch_items_updated_at on public.dispatch_items;
create trigger set_dispatch_items_updated_at
before update on public.dispatch_items
for each row execute function public.set_dispatch_updated_at();

alter table public.dispatch_items enable row level security;

grant select, insert, update, delete on public.dispatch_items to authenticated;

drop policy if exists dispatch_items_admin on public.dispatch_items;
create policy dispatch_items_admin
on public.dispatch_items
for all
to authenticated
using (public.is_dispatch_admin())
with check (public.is_dispatch_admin());
