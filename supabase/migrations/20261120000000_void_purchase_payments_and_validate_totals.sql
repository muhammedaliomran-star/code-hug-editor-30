-- Preserve payment history when a purchase is moved to/from the recycle bin.
alter table public.supplier_payments
  add column if not exists voided boolean not null default false,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_reason text;

create index if not exists supplier_payments_active_purchase_idx
  on public.supplier_payments(user_id, purchase_id, voided, paid_at desc);

create or replace function public.sync_purchase_paid_amount()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.purchase_id is not null then
      update public.purchases set paid_amount = coalesce((select sum(amount) from public.supplier_payments where purchase_id = old.purchase_id and not voided), 0)
      where id = old.purchase_id and user_id = old.user_id;
    end if;
    return old;
  end if;
  if new.purchase_id is not null then
    update public.purchases set paid_amount = coalesce((select sum(amount) from public.supplier_payments where purchase_id = new.purchase_id and not voided), 0)
    where id = new.purchase_id and user_id = new.user_id;
  end if;
  if tg_op = 'UPDATE' and old.purchase_id is distinct from new.purchase_id and old.purchase_id is not null then
    update public.purchases set paid_amount = coalesce((select sum(amount) from public.supplier_payments where purchase_id = old.purchase_id and not voided), 0)
    where id = old.purchase_id and user_id = old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_payments_sync_purchase_paid on public.supplier_payments;
create trigger supplier_payments_sync_purchase_paid
after insert or update of purchase_id, amount, voided or delete on public.supplier_payments
for each row execute function public.sync_purchase_paid_amount();

create or replace function public.sync_deleted_purchase_payments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted is distinct from old.deleted then
    update public.supplier_payments
    set voided = new.deleted,
        voided_at = case when new.deleted then now() else null end,
        voided_reason = case when new.deleted then coalesce(new.delete_reason, 'الفاتورة في سلة المحذوفات') else null end
    where purchase_id = new.id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_sync_deleted_payments on public.purchases;
create trigger purchases_sync_deleted_payments
after update of deleted on public.purchases
for each row execute function public.sync_deleted_purchase_payments();

create or replace function public.guard_purchase_paid_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_linked numeric;
begin
  if new.deleted then return new; end if;
  select coalesce(sum(amount), 0) into v_linked
  from public.supplier_payments where purchase_id = new.id and not voided;
  if exists (select 1 from public.supplier_payments where purchase_id = new.id and not voided)
     and abs(coalesce(new.paid_amount, 0) - v_linked) > 0.005 then
    raise exception 'لا يمكن تعديل المدفوع يدويًا؛ عدّل الدفعات المرتبطة بالفاتورة أولًا';
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_paid_amount_guard on public.purchases;
create trigger purchases_paid_amount_guard
before update of paid_amount on public.purchases
for each row execute function public.guard_purchase_paid_amount();

create or replace function public.guard_purchase_total_against_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_paid numeric;
begin
  select coalesce(sum(amount), 0) into v_paid
  from public.supplier_payments where purchase_id = new.id and not voided;
  if v_paid > coalesce(new.total, 0) + 0.005 then
    raise exception 'لا يمكن تخفيض إجمالي الفاتورة أسفل المدفوعات المسجلة؛ سجّل رد المبلغ أو رصيدًا للمورد أولًا';
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_total_payment_guard on public.purchases;
create trigger purchases_total_payment_guard
before update of total on public.purchases
for each row execute function public.guard_purchase_total_against_payments();

-- Deferred validation runs after all purchase items have been inserted/replaced.
create or replace function public.assert_purchase_totals(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_items_total numeric;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id;
  if not found then return; end if;
  select coalesce(sum(unit_cost * quantity), 0) into v_items_total from public.purchase_items where purchase_id = p_purchase_id;
  if abs(coalesce(v_purchase.subtotal, v_items_total) - v_items_total) > 0.005 then
    raise exception 'إجمالي الأصناف لا يطابق subtotal الفاتورة';
  end if;
  if abs(v_purchase.total - (coalesce(v_purchase.subtotal, v_items_total) - coalesce(v_purchase.discount_amount, 0) + coalesce(v_purchase.tax_amount, 0) + coalesce(v_purchase.shipping_amount, 0))) > 0.005 then
    raise exception 'إجمالي الفاتورة لا يطابق الخصم والضريبة والشحن';
  end if;
  if v_purchase.paid_amount < 0 or v_purchase.paid_amount > v_purchase.total then
    raise exception 'قيمة المدفوع غير صحيحة';
  end if;
end;
$$;

create or replace function public.validate_purchase_item_totals_deferred()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_purchase_totals(case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end);
  return null;
end;
$$;

create or replace function public.validate_purchase_header_totals_deferred()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_purchase_totals(new.id);
  return null;
end;
$$;

drop trigger if exists purchase_items_totals_validation on public.purchase_items;
create constraint trigger purchase_items_totals_validation
after insert or update or delete on public.purchase_items
deferrable initially deferred for each row execute function public.validate_purchase_item_totals_deferred();

drop trigger if exists purchases_totals_validation on public.purchases;
create constraint trigger purchases_totals_validation
after insert or update on public.purchases
deferrable initially deferred for each row execute function public.validate_purchase_header_totals_deferred();

grant execute on function public.assert_purchase_totals(uuid) to authenticated;
