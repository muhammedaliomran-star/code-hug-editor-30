-- Purchase integrity: keep invoice payments synchronized and protect supplier ownership.

-- The WAC migration introduced a legacy seven-argument overload. The application
-- uses the extended workflow function; removing the overload prevents an older
-- fallback from silently bypassing invoice metadata and numbering.
drop function if exists public.record_purchase_with_inventory(uuid, numeric, text, date, text, jsonb, uuid);

create or replace function public.sync_purchase_paid_amount()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.purchase_id is not null then
      update public.purchases
      set paid_amount = coalesce((select sum(amount) from public.supplier_payments where purchase_id = old.purchase_id), 0)
      where id = old.purchase_id and user_id = old.user_id;
    end if;
    return old;
  end if;

  if new.purchase_id is not null then
    update public.purchases
    set paid_amount = coalesce((select sum(amount) from public.supplier_payments where purchase_id = new.purchase_id), 0)
    where id = new.purchase_id and user_id = new.user_id;
  end if;

  if tg_op = 'UPDATE' and old.purchase_id is distinct from new.purchase_id and old.purchase_id is not null then
    update public.purchases
    set paid_amount = coalesce((select sum(amount) from public.supplier_payments where purchase_id = old.purchase_id), 0)
    where id = old.purchase_id and user_id = old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_payments_sync_purchase_paid on public.supplier_payments;
create trigger supplier_payments_sync_purchase_paid
after insert or update of purchase_id, amount or delete on public.supplier_payments
for each row execute function public.sync_purchase_paid_amount();

-- The trigger is now the single source of truth for linked payment totals.
-- Replacing this RPC avoids adding the same payment twice after the trigger runs.
create or replace function public.record_purchase_payment(
  p_purchase_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_payment_method text default 'cash',
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_id uuid;
begin
  select * into v_purchase from public.purchases
  where id = p_purchase_id and user_id = auth.uid() and not deleted for update;
  if not found then raise exception 'الفاتورة غير موجودة أو محذوفة'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ الدفعة غير صحيح'; end if;
  if p_amount > greatest(0, v_purchase.total - v_purchase.paid_amount) then raise exception 'الدفعة أكبر من المتبقي'; end if;
  insert into public.supplier_payments(user_id, supplier_id, purchase_id, amount, paid_at, payment_method, notes)
    values (auth.uid(), v_purchase.supplier_id, p_purchase_id, p_amount, p_paid_at, p_payment_method, p_notes)
    returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.record_purchase_payment(uuid, numeric, timestamptz, text, text) to authenticated;

-- Security-definer purchase RPCs must never accept a supplier belonging to another user.
create or replace function public.guard_purchase_supplier_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.supplier_id is not null
     and not exists (
       select 1 from public.suppliers s
       where s.id = new.supplier_id and s.user_id = new.user_id and s.user_id = auth.uid()
     ) then
    raise exception 'المورد غير موجود أو غير مسموح';
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_supplier_owner_guard on public.purchases;
create trigger purchases_supplier_owner_guard
before insert or update of supplier_id on public.purchases
for each row execute function public.guard_purchase_supplier_owner();

-- Recalculate existing linked payments once when this migration is applied.
update public.purchases p
set paid_amount = coalesce((select sum(sp.amount) from public.supplier_payments sp where sp.purchase_id = p.id), p.paid_amount)
where exists (select 1 from public.supplier_payments sp where sp.purchase_id = p.id);
