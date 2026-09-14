-- Kick the existing push worker immediately whenever a delivery is queued.
-- The existing once-per-minute cron remains as a fallback/retry path.
create or replace function dispatch_push_private.kick_delivery_worker()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_token text;
begin
  select worker_token into v_token
  from public.dispatch_push_config
  where id=true;

  if v_token is null then
    return new;
  end if;

  perform net.http_post(
    url:='https://jqdvxmatbmmeubtoogvl.supabase.co/functions/v1/dispatch-push',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-push-worker',v_token
    ),
    body:='{"action":"worker"}'::jsonb,
    timeout_milliseconds:=10000
  );

  return new;
exception when others then
  -- Push wake-up failure must never roll back dispatch/trip writes.
  raise warning 'dispatch push immediate kick failed: %', sqlstate;
  return new;
end;
$$;

revoke all on function dispatch_push_private.kick_delivery_worker() from public,anon,authenticated;

drop trigger if exists dispatch_push_kick_worker on public.dispatch_push_deliveries;
create trigger dispatch_push_kick_worker
after insert on public.dispatch_push_deliveries
for each row execute function dispatch_push_private.kick_delivery_worker();
