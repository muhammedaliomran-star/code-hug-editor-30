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
  upsert into public.storefront_payment_config (owner_id, secret_key, public_key, hmac_secret, integration_id_card, integration_id_wallet, updated_at)
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
