-- 구매 건별 지급상태를 저장한다.
-- 기존 구매는 모두 미지급으로 해석하고, 지급일은 지급완료 건에만 기록한다.
alter table public.purchases
  add column if not exists payment_status text,
  add column if not exists paid_date date;

update public.purchases
set payment_status = case
  when lower(trim(coalesce(payment_status, ''))) = 'paid' then 'paid'
  else 'unpaid'
end;

update public.purchases
set paid_date = null
where payment_status <> 'paid';

alter table public.purchases
  alter column payment_status set default 'unpaid',
  alter column payment_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchases'::regclass
      and conname = 'purchases_payment_status_check'
  ) then
    alter table public.purchases
      add constraint purchases_payment_status_check
      check (payment_status in ('unpaid', 'paid'));
  end if;
end $$;

create index if not exists purchases_payment_status_date_idx
  on public.purchases (payment_status, date);
