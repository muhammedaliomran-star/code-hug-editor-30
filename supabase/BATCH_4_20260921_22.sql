-- BATCH_4_20260921_22: paste after BATCH_3 succeeds --

-- ===== FILE: 20260921000000_paymob_payment_gateway.sql =====}
-- Paymob Payment Gateway: online payments for storefronts.
-- Extends store_order_type enum, adds payment tracking table, and payment RPCs.

-- ──────────────────────────────────────────────────────────────
-- 1. Extend store_order_type enum with 'online_payment'
-- ──────────────────────────────────────────────────────────────
do $$ begin
  alter type public.store_order_type add value if not exists 'online_payment';
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- 2. Add payment-related columns to store_orders
-- ──────────────────────────────────────────────────────────────
alter table public.store_orders
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  add column if not exists paymob_order_id text;

create index if not exists store_orders_payment_status_idx on public.store_orders (payment_status);

-- ──────────────────────────────────────────────────────────────
-- 3. storefront_payments: tracks every Paymob payment attempt
-- ──────────────────────────────────────────────────────────────
create table if not exists public.storefront_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  paymob_intention_id text,
  paymob_transaction_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EGP',
  payment_method text,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'refunded', 'voided')),
  hmac_payload jsonb,
  paymob_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storefront_payments enable row level security;

-- Owners can read payments for their storefronts
create policy "Owners read storefront payments"
  on public.storefront_payments for select to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

-- Insert via SECURITY DEFINER RPC only (no direct insert policy)
-- Service role can do everything
grant select, insert, update, delete on public.storefront_payments to service_role;
grant select on public.storefront_payments to authenticated;

create index if not exists storefront_payments_order_idx on public.storefront_payments (order_id);
create index if not exists storefront_payments_storefront_idx on public.storefront_payments (storefront_id, status);

-- ──────────────────────────────────────────────────────────────
-- 4. storefront_payment_config: stores Paymob credentials per owner
-- ──────────────────────────────────────────────────────────────
create table if not exists public.storefront_payment_config (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  secret_key text,
  public_key text,
  hmac_secret text,
  integration_id_card integer,
  integration_id_wallet integer,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storefront_payment_config enable row level security;

create policy "Owners manage payment config"
  on public.storefront_payment_config for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- 5. RPC: get payment config (for Edge Function to verify owner)
-- ──────────────────────────────────────────────────────────────
create or replace function public.get_storefront_payment_config(p_owner_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    jsonb_build_object(
      'secret_key', secret_key,
      'public_key', public_key,
      'hmac_secret', hmac_secret,
      'integration_id_card', integration_id_card,
      'integration_id_wallet', integration_id_wallet,
      'enabled', enabled
    ),
    '{}'::jsonb
  )
  from public.storefront_payment_config
  where owner_id = p_owner_id;
$$;

revoke all on function public.get_storefront_payment_config(uuid) from public;
grant execute on function public.get_storefront_payment_config(uuid) to authenticated;

-- ──────────────────────────────────────────────────────────────
-- 6. RPC: save payment config
-- ──────────────────────────────────────────────────────────────
create or replace function public.save_storefront_payment_config(
  p_secret_key text,
  p_public_key text,
  p_hmac_secret text,
  p_integration_id_card integer,
  p_integration_id_wallet integer default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'سجل الدخول أولًا'; end if;
  insert into public.storefront_payment_config (owner_id, secret_key, public_key, hmac_secret, integration_id_card, integration_id_wallet, updated_at)
    values (v_owner, p_secret_key, p_public_key, p_hmac_secret, p_integration_id_card, p_integration_id_wallet, now())
    on conflict (owner_id) do update set
      secret_key = excluded.secret_key,
      public_key = excluded.public_key,
      hmac_secret = excluded.hmac_secret,
      integration_id_card = excluded.integration_id_card,
      integration_id_wallet = excluded.integration_id_wallet,
      updated_at = now();
  -- Enable the online_payment feature flag for this owner's storefronts
  update public.storefront_feature_flags set enabled = true, updated_at = now()
    where storefront_id in (select id from public.storefronts where owner_id = v_owner) and flag = 'online_payment';
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_storefront_payment_config(text, text, text, integer, integer) from public;
grant execute on function public.save_storefront_payment_config(text, text, text, integer, integer) to authenticated;

-- ──────────────────────────────────────────────────────────────
-- 7. RPC: record payment (called by Edge Function on webhook)
-- ──────────────────────────────────────────────────────────────
create or replace function public.record_storefront_payment(
  p_order_id uuid,
  p_paymob_intention_id text,
  p_paymob_transaction_id text,
  p_amount_cents integer,
  p_currency text,
  p_payment_method text,
  p_status text,
  p_hmac_payload jsonb default null,
  p_paymob_response jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment public.storefront_payments;
  v_order public.store_orders;
  v_storefront_id uuid;
begin
  -- Look up the order
  select * into v_order from public.store_orders where id = p_order_id;
  if not found then raise exception 'الطلب غير موجود: %', p_order_id; end if;
  v_storefront_id := v_order.storefront_id;

  -- Upsert payment record (idempotent by paymob_intention_id)
  insert into public.storefront_payments (order_id, storefront_id, paymob_intention_id, paymob_transaction_id, amount_cents, currency, payment_method, status, hmac_payload, paymob_response)
    values (p_order_id, v_storefront_id, p_paymob_intention_id, p_paymob_transaction_id, p_amount_cents, p_currency, p_payment_method, p_status, p_hmac_payload, p_paymob_response)
    on conflict (order_id) where paymob_intention_id = p_paymob_intention_id do update set
      paymob_transaction_id = excluded.paymob_transaction_id,
      status = excluded.status,
      hmac_payload = excluded.hmac_payload,
      paymob_response = excluded.paymob_response,
      updated_at = now()
    returning * into v_payment;

  -- Update order payment status
  update public.store_orders set
    payment_status = case when p_status = 'success' then 'paid' when p_status = 'failed' then 'failed' when p_status in ('refunded', 'voided') then 'refunded' else 'pending' end,
    updated_at = now()
  where id = p_order_id;

  -- Record order event
  insert into public.store_order_events (order_id, event_type, payload)
    values (p_order_id, 'payment_' || p_status, jsonb_build_object(
      'payment_id', v_payment.id,
      'paymob_transaction_id', p_paymob_transaction_id,
      'amount_cents', p_amount_cents,
      'payment_method', p_payment_method
    ));

  return jsonb_build_object('payment_id', v_payment.id, 'status', p_status);
end;
$$;

revoke all on function public.record_storefront_payment(uuid, text, text, integer, text, text, text, jsonb, jsonb) from public;
grant execute on function public.record_storefront_payment(uuid, text, text, integer, text, text, text, jsonb, jsonb) to service_role;

-- ──────────────────────────────────────────────────────────────
-- 8. RPC: check if online payment is enabled for a storefront
-- ──────────────────────────────────────────────────────────────
create or replace function public.is_online_payment_enabled(p_storefront_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select ff.enabled
    from public.storefront_feature_flags ff
    where ff.storefront_id = p_storefront_id and ff.flag = 'online_payment'
  ), false)
  and exists (
    select 1 from public.storefront_payment_config pc
    join public.storefronts s on s.owner_id = pc.owner_id
    where s.id = p_storefront_id and pc.enabled and pc.secret_key is not null
  );
$$;

revoke all on function public.is_online_payment_enabled(uuid) from public;
grant execute on function public.is_online_payment_enabled(uuid) to anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 9. Updated submit_store_order: accept 'online_payment' order_type
-- ──────────────────────────────────────────────────────────────
-- The enum already includes 'online_payment' from step 1.
-- The existing submit_store_order function accepts store_order_type as a parameter,
-- so it will accept 'online_payment' without any code change.
-- The payment_status defaults to 'unpaid' on insert.

-- ──────────────────────────────────────────────────────────────
-- 10. Add unique constraint on storefront_payments for idempotent upserts
-- ──────────────────────────────────────────────────────────────
do $$ begin
  alter table public.storefront_payments add constraint storefront_payments_intention_unique unique (order_id, paymob_intention_id);
exception when duplicate_object then null; end $$;


-- ===== FILE: 20260922000000_drop_storefront_tables.sql =====}
-- Drop Storefront Module: removes all storefront-related tables, enums, and RPCs.
-- This migration decommissions the e-commerce storefront feature entirely.

-- 1. Drop triggers first
DROP TRIGGER IF EXISTS store_order_event_notification ON public.store_order_events;
DROP TRIGGER IF EXISTS store_order_state_guard ON public.store_orders;

-- 2. Drop functions (SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text, text);
DROP FUNCTION IF EXISTS public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text);
DROP FUNCTION IF EXISTS public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid);
DROP FUNCTION IF EXISTS public.accept_store_order(uuid);
DROP FUNCTION IF EXISTS public.invoice_store_order(uuid);
DROP FUNCTION IF EXISTS public.invoice_store_order_installment(uuid, numeric, numeric, text, integer);
DROP FUNCTION IF EXISTS public.update_store_order_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.cancel_store_order(uuid, text);
DROP FUNCTION IF EXISTS public.expire_storefront_reservations();
DROP FUNCTION IF EXISTS public.get_public_storefront(text);
DROP FUNCTION IF EXISTS public.get_public_storefront_with_settings(text);
DROP FUNCTION IF EXISTS public.get_public_product(text);
DROP FUNCTION IF EXISTS public.get_public_order_status(text, text);
DROP FUNCTION IF EXISTS public.create_storefront_sale_return(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.reverse_storefront_sale_return(uuid);
DROP FUNCTION IF EXISTS public.notify_storefront_event();
DROP FUNCTION IF EXISTS public.validate_storefront_coupon(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.redeem_storefront_coupon(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.get_storefront_feature_flag(uuid, text);
DROP FUNCTION IF EXISTS public.get_storefront_analytics_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.record_storefront_event(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.assign_storefront_shipment(uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.update_storefront_shipment_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_storefront_payment_config(uuid);
DROP FUNCTION IF EXISTS public.save_storefront_payment_config(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.record_storefront_payment(uuid, text, text, integer, text, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.is_online_payment_enabled(uuid);
DROP FUNCTION IF EXISTS public.guard_store_order_transition() CASCADE;

-- 3. Drop tables (children first, then parents)
DROP TABLE IF EXISTS public.storefront_payments CASCADE;
DROP TABLE IF EXISTS public.storefront_payment_config CASCADE;
DROP TABLE IF EXISTS public.storefront_notifications CASCADE;
DROP TABLE IF EXISTS public.storefront_analytics_events CASCADE;
DROP TABLE IF EXISTS public.storefront_domains CASCADE;
DROP TABLE IF EXISTS public.storefront_feature_flags CASCADE;
DROP TABLE IF EXISTS public.storefront_coupons CASCADE;
DROP TABLE IF EXISTS public.store_order_events CASCADE;
DROP TABLE IF EXISTS public.store_order_items CASCADE;
DROP TABLE IF EXISTS public.stock_reservations CASCADE;
DROP TABLE IF EXISTS public.store_orders CASCADE;
DROP TABLE IF EXISTS public.storefront_products CASCADE;
DROP TABLE IF EXISTS public.storefront_categories CASCADE;
DROP TABLE IF EXISTS public.storefronts CASCADE;

-- 4. Drop enums
DROP TYPE IF EXISTS public.store_order_status CASCADE;
DROP TYPE IF EXISTS public.store_order_type CASCADE;
DROP TYPE IF EXISTS public.stock_reservation_status CASCADE;

-- Note: shipment_status and shipping_carriers/shipping_zones/shipments are kept
-- because they are used by the core shipping system independent of the storefront.


-- ===== FILE: 20260922010000_restore_late_shipment_notifications.sql =====}
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

-- Remove old job if it exists, then schedule new one
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-late-shipment-notifications';
  END IF;

  PERFORM cron.schedule(
    'sync-late-shipment-notifications',
    '*/15 * * * *',
    $cron$select public.sync_late_shipment_notifications();$cron$
  );
END
$$;


-- ===== FILE: 20260922020000_add_updated_at_for_sync.sql =====}
-- Final migration: updated_at + indexes + triggers for all core tables

-- 1. Add updated_at columns (skip tables that already have it).
-- Every table below gets the column: the old DB had them added piecemeal
-- via dashboard, but a fresh DB has none — and the indexes/triggers below
-- fail (42703) plus future UPDATEs would fail at runtime without it.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.return_records ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.return_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.shipping_carriers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON public.customers (updated_at);
CREATE INDEX IF NOT EXISTS idx_invoices_updated_at ON public.invoices (updated_at);
CREATE INDEX IF NOT EXISTS idx_payments_updated_at ON public.payments (updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_updated_at ON public.expenses (updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated_at ON public.suppliers (updated_at);
CREATE INDEX IF NOT EXISTS idx_purchases_updated_at ON public.purchases (updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_items_updated_at ON public.stock_items (updated_at);
CREATE INDEX IF NOT EXISTS idx_shipments_updated_at ON public.shipments (updated_at);
CREATE INDEX IF NOT EXISTS idx_branches_updated_at ON public.branches (updated_at);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_updated_at ON public.payment_vouchers (updated_at);

-- 3. Triggers (one per table)
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_invoice_items BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_expenses BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_suppliers BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_purchases BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_purchase_items BEFORE UPDATE ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_supplier_payments BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_stock_items BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_return_records BEFORE UPDATE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_return_items BEFORE UPDATE ON public.return_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_shipping_carriers BEFORE UPDATE ON public.shipping_carriers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_shipping_zones BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_shipments BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_payment_vouchers BEFORE UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();


-- ===== FILE: 20260922030000_backup_atomic_restore_wipe.sql =====}
-- Phase 2 (#15): atomic backup restore + wipe with server-side gates.
-- Both functions run in a single transaction: any error rolls everything back.

-- Gate helper: owner or manager (mirrors roles.ts ABILITIES for backups).
create or replace function public.assert_backup_manager()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'غير مصرح: سجّل الدخول أولاً';
  end if;
  if public.has_role(v_user, 'owner'::public.app_role) then
    return;
  end if;
  if public.has_role(v_user, 'manager'::public.app_role) then
    return;
  end if;
  raise exception 'النسخ الاحتياطي والمسح للمالك أو المدير فقط';
end;
$$;

revoke all on function public.assert_backup_manager() from public;
grant execute on function public.assert_backup_manager() to authenticated;

-- Atomic restore. Parents-first order satisfies immediate FK constraints.
-- Unknown columns are stripped, user_id is forced to the caller,
-- natural-key collisions (e.g. treasury local_key) count as skipped.
-- On any other error the whole transaction rolls back and nothing is written.
create or replace function public.restore_backup(
  p_tables jsonb,
  p_exported_by text default null,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order text[] := array[
    'customers', 'suppliers', 'stock_items', 'expenses', 'branches',
    'shipping_carriers', 'payment_vouchers',
    'invoices', 'purchases', 'shipping_zones',
    'invoice_items', 'payments', 'invoice_installments',
    'purchase_items', 'supplier_payments',
    'return_records', 'return_items',
    'shipments', 'carrier_settlements', 'delivery_attempts',
    'stock_adjustments', 'stock_movements', 'shop_settings',
    'audit_events', 'audit_logs',
    'staff_members', 'staff_attendance', 'shifts',
    'treasury_accounts', 'treasury_manual_transactions',
    'treasury_transfers', 'treasury_denomination_audits',
    'collection_promises', 'collection_call_logs', 'held_invoices',
    'expense_metadata', 'recurring_expenses', 'category_budgets',
    'expense_settings', 'promo_coupons', 'qty_offers', 'bundles',
    'loyalty_config', 'licenses', 'admin_settings'
  ];
  v_key text;
  v_rows jsonb;
  v_row jsonb;
  v_clean jsonb;
  v_cols text[];
  v_has_user boolean;
  v_inserted int := 0;
  v_skipped int := 0;
  v_total int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_seen jsonb := '{}'::jsonb;
  v_id text;
  v_dup text;
begin
  perform public.assert_backup_manager();

  if p_tables is null or jsonb_typeof(p_tables) <> 'object' then
    raise exception 'بيانات الجداول ناقصة';
  end if;

  -- 1) Reject unknown tables up front
  for v_key in select jsonb_object_keys(p_tables) loop
    if not (v_key = any (v_order)) then
      v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'جدول غير معروف — لن يُستورد');
    end if;
  end loop;

  -- 2) Per-table shape + duplicate-id validation
  foreach v_key in array v_order loop
    v_rows := p_tables -> v_key;
    if v_rows is null then continue; end if;
    if jsonb_typeof(v_rows) <> 'array' then
      v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'بيانات الجدول غير صالحة');
      continue;
    end if;
    v_total := v_total + jsonb_array_length(v_rows);
    for v_row in select * from jsonb_array_elements(v_rows) loop
      if jsonb_typeof(v_row) <> 'object' or not (v_row ? 'id') or jsonb_typeof(v_row -> 'id') <> 'string' then
        v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'سجل بدون معرّف صالح');
        continue;
      end if;
      v_id := v_row ->> 'id';
      if v_seen ? v_key and (v_seen -> v_key) ? v_id then
        v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'معرّف مكرر داخل النسخة');
      else
        v_seen := jsonb_set(v_seen, array[v_key], coalesce(v_seen -> v_key, '{}'::jsonb) || jsonb_build_object(v_id, true));
      end if;
    end loop;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object(
      'ok', false, 'tableCount', (select count(*) from jsonb_object_keys(p_tables)),
      'totalRows', v_total, 'inserted', 0, 'skipped', 0, 'failed', v_errors
    );
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'ok', true, 'tableCount', (select count(*) from jsonb_object_keys(p_tables)),
      'totalRows', v_total, 'inserted', 0, 'skipped', 0, 'failed', '[]'::jsonb
    );
  end if;

  -- 3) Insert parents-first; any failure aborts the whole transaction
  foreach v_key in array v_order loop
    v_rows := p_tables -> v_key;
    if v_rows is null or jsonb_array_length(v_rows) = 0 then continue; end if;
    select array_agg(c.column_name) into v_cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v_key;
    select exists(
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_key and c.column_name = 'user_id'
    ) into v_has_user;
    for v_row in select * from jsonb_array_elements(v_rows) loop
      select jsonb_object_agg(j.k, j.v) into v_clean
      from jsonb_each(v_row) as j(k, v)
      where j.k = any (v_cols);
      if v_has_user then
        v_clean := v_clean || jsonb_build_object('user_id', v_user::text);
      end if;
      begin
        execute format(
          'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',
          v_key, v_key
        ) using jsonb_build_array(v_clean);
        v_inserted := v_inserted + 1;
      exception
        when unique_violation then
          v_skipped := v_skipped + 1;
        when others then
          raise exception 'فشل إدخال سجل في %: %', v_key, sqlerrm;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true, 'exportedBy', p_exported_by,
    'tableCount', (select count(*) from jsonb_object_keys(p_tables)),
    'totalRows', v_total, 'inserted', v_inserted, 'skipped', v_skipped,
    'failed', '[]'::jsonb
  );
end;
$$;

revoke all on function public.restore_backup(jsonb, text, boolean) from public;
grant execute on function public.restore_backup(jsonb, text, boolean) to authenticated;

-- Atomic wipe. Child-first order; per-table counts returned.
-- Any failure rolls everything back.
create or replace function public.wipe_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order text[] := array[
    'admin_settings', 'licenses', 'loyalty_config', 'bundles', 'qty_offers',
    'promo_coupons', 'expense_settings', 'category_budgets', 'recurring_expenses',
    'expense_metadata', 'held_invoices', 'collection_call_logs', 'collection_promises',
    'shifts', 'staff_attendance', 'staff_members',
    'treasury_denomination_audits', 'treasury_transfers', 'treasury_manual_transactions',
    'treasury_accounts', 'invoice_installments', 'audit_logs', 'audit_events',
    'delivery_attempts', 'carrier_settlements', 'shipments', 'shipping_zones',
    'shipping_carriers', 'stock_movements', 'return_items', 'return_records',
    'payment_vouchers', 'branches', 'shop_settings', 'expenses', 'supplier_payments',
    'purchase_items', 'purchases', 'stock_adjustments', 'stock_items',
    'invoice_items', 'invoices', 'payments', 'customers', 'suppliers'
  ];
  v_t text;
  v_n int;
  v_deleted jsonb := '{}'::jsonb;
  v_has_user boolean;
begin
  perform public.assert_backup_manager();

  foreach v_t in array v_order loop
    select exists(
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_t and c.column_name = 'user_id'
    ) into v_has_user;
    if not v_has_user then continue; end if;
    execute format('delete from public.%I where user_id = $1', v_t) using v_user;
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object(v_t, v_n);
  end loop;

  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

revoke all on function public.wipe_user_data() from public;
grant execute on function public.wipe_user_data() to authenticated;


-- ===== FILE: 20260922040000_security_phase0_critical.sql =====}
-- Phase 0 (security review): close critical gaps. SQL only, no app changes.
-- Self-contained: defines its own trigger helper so a missing function
-- can never abort the whole script (which would roll back the drops above).
create or replace function public.sync_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.sync_set_updated_at() from public;
grant execute on function public.sync_set_updated_at() to authenticated;
grant execute on function public.sync_set_updated_at() to service_role;
--
-- 1. shipments: drop the permissive MVP policy. RLS is permissive-OR:
--    as long as "Allow authenticated full access to shipments" exists,
--    ANY authenticated user can read/write/delete ANYONE's shipments,
--    regardless of the restrictive "Users manage own shipments" policy.
--    carriers/zones permissives were already dropped in 20260823030000;
--    shipments was missed (only the storefront policy was dropped there).
drop policy if exists "Allow authenticated full access to shipments"
  on public.shipments;

-- 2. user_roles: remove self-manage. The "Users manage own roles" FOR ALL
--    policy lets any authenticated user INSERT/UPDATE/DELETE their own
--    role rows — i.e. grant themselves 'owner' — defeating every
--    has_role('owner') gate (admin_settings, team_invites, server fns).
--    "Users can view own roles" (SELECT) stays untouched.
--    Role assignment from now on: owner-gated server functions / service_role.
drop policy if exists "Users manage own roles"
  on public.user_roles;

-- Bootstrap: the very first owner. Without this, nobody could ever become
-- owner after the self-manage policy is gone (chicken-and-egg for new
-- installs). The check MUST bypass RLS, hence SECURITY DEFINER — a plain
-- policy subquery would only see the caller's own rows and could be fooled.
create or replace function public.no_owner_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.user_roles where role = 'owner');
$$;

revoke all on function public.no_owner_exists() from public;
grant execute on function public.no_owner_exists() to authenticated;

drop policy if exists "Bootstrap first owner" on public.user_roles;
create policy "Bootstrap first owner" on public.user_roles
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and role = 'owner'::public.app_role
    and public.no_owner_exists()
  );

-- 3. shifts: phantom table. staff-sync.ts pushes/pulls shifts via Supabase
--    (pushShift/pushCashShift/pushCashierShift + pullStaffFromCloud), but no
--    CREATE TABLE exists in any migration — so cloud shift sync silently
--    fails, backup/restore lists reference a missing table, and the atomic
--    restore_backup() would roll back on `insert into public.shifts`.
--    Create it with the exact columns the sync payloads use + standard
--    owner-scoped RLS + updated_at trigger + sync index.
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shift_number integer not null default 0,
  cashier_name text,
  opened_at timestamptz,
  closed_at timestamptz,
  opening_balance numeric not null default 0,
  expected_cash numeric not null default 0,
  actual_cash numeric not null default 0,
  cash_sales numeric not null default 0,
  electronic_sales numeric not null default 0,
  installment_sales numeric not null default 0,
  expenses numeric not null default 0,
  purchases numeric not null default 0,
  returns numeric not null default 0,
  variance numeric not null default 0,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The table may already exist live without some columns (created
-- out-of-band). Add every column the sync payloads use, idempotently.
alter table public.shifts add column if not exists user_id uuid;
alter table public.shifts add column if not exists shift_number integer not null default 0;
alter table public.shifts add column if not exists cashier_name text;
alter table public.shifts add column if not exists opened_at timestamptz;
alter table public.shifts add column if not exists closed_at timestamptz;
alter table public.shifts add column if not exists opening_balance numeric not null default 0;
alter table public.shifts add column if not exists expected_cash numeric not null default 0;
alter table public.shifts add column if not exists actual_cash numeric not null default 0;
alter table public.shifts add column if not exists cash_sales numeric not null default 0;
alter table public.shifts add column if not exists electronic_sales numeric not null default 0;
alter table public.shifts add column if not exists installment_sales numeric not null default 0;
alter table public.shifts add column if not exists expenses numeric not null default 0;
alter table public.shifts add column if not exists purchases numeric not null default 0;
alter table public.shifts add column if not exists returns numeric not null default 0;
alter table public.shifts add column if not exists variance numeric not null default 0;
alter table public.shifts add column if not exists status text not null default 'open';
alter table public.shifts add column if not exists notes text;
alter table public.shifts add column if not exists created_at timestamptz not null default now();
alter table public.shifts add column if not exists updated_at timestamptz not null default now();

alter table public.shifts enable row level security;

drop policy if exists "Users manage own shifts" on public.shifts;
create policy "Users manage own shifts" on public.shifts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at_shifts on public.shifts;
create trigger set_updated_at_shifts
  before update on public.shifts
  for each row execute function public.sync_set_updated_at();

create index if not exists idx_shifts_user_opened on public.shifts (user_id, opened_at desc);
create index if not exists idx_shifts_updated_at on public.shifts (updated_at);


-- ===== FILE: 20260922060000_drop_storefront_bucket.sql =====}
-- Phase 1 (security review): remove the orphaned storefront storage surface.
-- The storefront feature was deleted (tables + functions + code), but its
-- public bucket and 4 storage.objects policies survived. No live code reads
-- this bucket (verified: zero references in src/).

-- 1. Drop the orphaned policies
drop policy if exists "Public storefront product images are readable"
  on storage.objects;
drop policy if exists "Merchants upload storefront product images"
  on storage.objects;
drop policy if exists "Merchants update storefront product images"
  on storage.objects;
drop policy if exists "Merchants delete storefront product images"
  on storage.objects;

-- 2. Empty then delete the bucket (bucket delete requires it to be empty)
delete from storage.objects
where bucket_id = 'storefront-product-images';

delete from storage.buckets
where id = 'storefront-product-images';


-- ===== FILE: 20260922070000_courier_tokens.sql =====}
-- Phase 2 (security review): passwordless courier portals via per-carrier tokens.
--
-- Problem: /courier + /delivery are public routes that preselected carriers
-- via ?carrier=<uuid> (or phone match). Carrier UUIDs are enumerable and the
-- preselect leaks one carrier's customer names/phones/addresses to anyone
-- who guesses them (within whatever session/RLS context applies).
--
-- Fix: each carrier gets an unguessable 128-bit courier_token. The portals
-- accept ONLY ?token=<courier_token> and load data through scoped
-- SECURITY DEFINER RPCs — no session, no UUID enumeration, no other
-- carrier's data. Owners copy/regenerate the link from the shipping page.

-- 1. Secret token per carrier (md5 = core Postgres, no extension needed)
alter table public.shipping_carriers
  add column if not exists courier_token text;

update public.shipping_carriers
set courier_token = md5(id::text || now()::text || random()::text)
where courier_token is null;

create unique index if not exists idx_shipping_carriers_courier_token
  on public.shipping_carriers (courier_token);

-- 2. Scoped board read: carrier (WITHOUT the token) + active shipments.
--    Granted to anon: the token itself is the credential (receipt pattern).
create or replace function public.get_courier_board(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_carrier public.shipping_carriers%rowtype;
  v_shipments jsonb;
begin
  if p_token is null or p_token = '' then
    raise exception 'رمز الدخول مطلوب';
  end if;

  select * into v_carrier
  from public.shipping_carriers
  where courier_token = p_token
    and active is distinct from false;

  if not found then
    raise exception 'رمز الدخول غير صالح';
  end if;

  select coalesce(jsonb_agg(row_to_json(s) order by s.created_at desc), '[]'::jsonb)
  into v_shipments
  from public.shipments s
  where s.carrier_id = v_carrier.id
    and s.status in ('pending', 'processing', 'shipped', 'delivered', 'returned');

  return jsonb_build_object(
    'carrier', to_jsonb(v_carrier) - 'courier_token',
    'shipments', v_shipments
  );
end;
$$;

revoke all on function public.get_courier_board(text) from public;
grant execute on function public.get_courier_board(text) to anon, authenticated;

-- 3. Scoped status update: delivered / returned only, on the token's own
--    carrier shipments. Also appends a delivery_attempts audit row.
create or replace function public.courier_update_shipment(
  p_token text,
  p_shipment_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carrier public.shipping_carriers%rowtype;
  v_shipment public.shipments%rowtype;
  v_attempt_no integer;
  v_owner uuid;
begin
  if p_token is null or p_token = '' then
    raise exception 'رمز الدخول مطلوب';
  end if;
  if p_status not in ('delivered', 'returned') then
    raise exception 'الحالة المسموحة للمندوب: تم التسليم أو تعذر التسليم فقط';
  end if;

  select * into v_carrier
  from public.shipping_carriers
  where courier_token = p_token
    and active is distinct from false;

  if not found then
    raise exception 'رمز الدخول غير صالح';
  end if;

  select * into v_shipment
  from public.shipments
  where id = p_shipment_id
    and carrier_id = v_carrier.id
  for update;

  if not found then
    raise exception 'الشحنة غير موجودة لدى هذا المندوب';
  end if;

  update public.shipments
  set status = p_status::public.shipment_status,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      returned_at = case when p_status = 'returned' then now() else returned_at end,
      notes = coalesce(nullif(trim(coalesce(p_reason, '')), ''), notes)
  where id = v_shipment.id;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_no
  from public.delivery_attempts
  where shipment_id = v_shipment.id;

  -- delivery_attempts.user_id is NOT NULL but auth.uid() is empty for anon
  -- callers, so attribute the row to the carrier's owner explicitly.
  v_owner := coalesce(v_shipment.user_id, v_carrier.user_id);

  insert into public.delivery_attempts (
    user_id, shipment_id, attempt_number, outcome, reason, notes
  ) values (
    v_owner,
    v_shipment.id,
    v_attempt_no,
    case when p_status = 'delivered' then 'delivered' else 'refused' end,
    nullif(trim(coalesce(p_reason, '')), ''),
    'عبر بوابة المندوب'
  );

  select * into v_shipment from public.shipments where id = v_shipment.id;
  return row_to_json(v_shipment);
end;
$$;

revoke all on function public.courier_update_shipment(text, uuid, text, text) from public;
grant execute on function public.courier_update_shipment(text, uuid, text, text) to anon, authenticated;

