-- Restore sync_late_shipment_notifications() and schedule it via pg_cron.
-- The function was accidentally dropped in the storefront removal migration.

-- 1. Recreate the function (SECURITY DEFINER so pg_cron can run it)
create or replace function public.sync_late_shipment_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.shipment_notifications (
    user_id, shipment_id, kind, status, title, body,
    tracking_identifier, expected_delivery_date, dedupe_key
  )
  select
    sh.user_id,
    sh.id,
    'late',
    sh.status,
    'شحنة متأخرة عن موعد التسليم',
    concat('الشحنة ', sh.tracking_number, left(sh.id::text, 8), ' تجاوزت موعد التسليم المتوقع ', sh.expected_delivery_date::text),
    sh.tracking_number,
    sh.expected_delivery_date,
    concat('late:', sh.id::text, ':', sh.expected_delivery_date::text)
  from public.shipments sh
  where sh.status in ('pending', 'processing', 'shipped')
    and sh.expected_delivery_date is not null
    and sh.expected_delivery_date < current_date
  on conflict (user_id, dedupe_key) do update
    set status = excluded.status,
        title = excluded.title,
        body = excluded.body,
        tracking_identifier = excluded.tracking_identifier,
        resolved_at = null;

  get diagnostics v_count = row_count;

  -- Resolve notifications for shipments that are no longer late
  update public.shipment_notifications n
  set resolved_at = coalesce(n.resolved_at, now())
  where n.kind = 'late'
    and n.resolved_at is null
    and not exists (
      select 1 from public.shipments sh
      where sh.id = n.shipment_id
        and sh.status in ('pending', 'processing', 'shipped')
        and sh.expected_delivery_date is not null
        and sh.expected_delivery_date < current_date
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.sync_late_shipment_notifications() from public;
grant execute on function public.sync_late_shipment_notifications() to authenticated;
grant execute on function public.sync_late_shipment_notifications() to service_role;

-- 2. Schedule pg_cron job: run every 15 minutes
create extension if not exists pg_cron;

-- Remove old job if it exists
if to_regnamespace('cron') is not null then
  perform cron.unschedule(jobid) from cron.job where jobname = 'sync-late-shipment-notifications';
end if;

-- Schedule new job (runs as postgres superuser, SECURITY DEFINER handles auth)
perform cron.schedule(
  'sync-late-shipment-notifications',
  '*/15 * * * *',
  $cron$select public.sync_late_shipment_notifications();$cron$
);
