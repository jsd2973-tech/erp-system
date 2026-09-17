-- 배차별 차량·기사 함수는 로그인한 ERP 사용자만 호출할 수 있어야 합니다.
revoke all on function public.can_driver_read_dispatch_order(text) from anon;
revoke all on function public.save_dispatch_order_with_assignments(jsonb, jsonb) from anon;
revoke all on function public.start_dispatch_trip(text) from anon;

grant execute on function public.can_driver_read_dispatch_order(text) to authenticated;
grant execute on function public.save_dispatch_order_with_assignments(jsonb, jsonb) to authenticated;
grant execute on function public.start_dispatch_trip(text) to authenticated;
