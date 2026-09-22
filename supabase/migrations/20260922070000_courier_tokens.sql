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
