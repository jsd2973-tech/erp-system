create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('dispatch-push-delivery','* * * * *',$job$
 select net.http_post(
  url:='https://jqdvxmatbmmeubtoogvl.supabase.co/functions/v1/dispatch-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-push-worker',worker_token),
  body:='{"action":"worker"}'::jsonb,timeout_milliseconds:=60000)
 from public.dispatch_push_config where id=true
 and exists(select 1 from public.dispatch_push_deliveries where sent_at is null and attempts<5 and next_attempt_at<=now());
$job$);
