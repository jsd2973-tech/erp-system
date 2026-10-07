-- 기존 행에는 미확인을 부여한 다음, 이후 INSERT의 기본값만 미수취로 바꿉니다.
-- 지급상태/지급일 및 정비 연결은 변경하지 않습니다.
alter table public.purchases
  add column receipt_status text not null default 'unknown',
  add column received_date date;

alter table public.purchases
  alter column receipt_status set default 'unreceived',
  add constraint purchases_receipt_status_check
    check (receipt_status in ('unknown', 'unreceived', 'received')),
  add constraint purchases_received_date_check
    check ((receipt_status = 'received') = (received_date is not null));
