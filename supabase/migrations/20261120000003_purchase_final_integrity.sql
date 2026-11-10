-- Final purchase workflow hardening.
-- The payment trigger is the only source of truth for purchases.paid_amount.
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
  -- Do not update purchases.paid_amount here: the supplier_payments trigger
  -- recalculates it from the active payment rows atomically.
  return v_id;
end;
$$;
grant execute on function public.record_purchase_payment(uuid, numeric, timestamptz, text, text) to authenticated;

-- Returned supplier lines reduce the effective item total without deleting the
-- original purchase lines, so include recorded supplier returns in the check.
create or replace function public.assert_purchase_totals(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_items_total numeric; v_return_total numeric;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id;
  if not found then return; end if;
  select coalesce(sum(unit_cost * quantity), 0) into v_items_total from public.purchase_items where purchase_id = p_purchase_id;
  select coalesce(sum(total_amount), 0) into v_return_total from public.return_records where purchase_id = p_purchase_id and type = 'supplier';
  v_items_total := greatest(0, v_items_total - v_return_total);
  if abs(coalesce(v_purchase.subtotal, v_items_total) - v_items_total) > 0.005 then raise exception 'إجمالي الأصناف لا يطابق subtotal الفاتورة'; end if;
  if abs(v_purchase.total - (coalesce(v_purchase.subtotal, v_items_total) - coalesce(v_purchase.discount_amount, 0) + coalesce(v_purchase.tax_amount, 0) + coalesce(v_purchase.shipping_amount, 0))) > 0.005 then raise exception 'إجمالي الفاتورة لا يطابق الخصم والضريبة والشحن'; end if;
  if v_purchase.paid_amount < 0 or v_purchase.paid_amount > v_purchase.total then raise exception 'قيمة المدفوع غير صحيحة'; end if;
end;
$$;

-- Keep the supplier return totals consistent and refund cash-paid returns.
create or replace function public.create_supplier_return(
  p_purchase_id uuid, p_reason text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases; v_return_id uuid; v_item jsonb; v_stock public.stock_items;
  v_name text; v_qty integer; v_cost numeric; v_bought integer; v_returned integer; v_total numeric := 0;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id and user_id = auth.uid() and not deleted for update;
  if not found then raise exception 'فاتورة الشراء غير موجودة أو محذوفة'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب المرتجع مطلوب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر صنفًا واحدًا على الأقل'; end if;

  insert into public.return_records(user_id, purchase_id, type, total_amount, reason)
    values(auth.uid(), p_purchase_id, 'supplier', 0, trim(p_reason)) returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unit_cost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;
    select coalesce(sum(quantity), 0) into v_bought from public.purchase_items where purchase_id = p_purchase_id and name = v_name;
    select coalesce(sum(ri.quantity), 0) into v_returned
    from public.return_items ri join public.return_records rr on rr.id = ri.return_id
    where rr.purchase_id = p_purchase_id and rr.type = 'supplier' and ri.name = v_name;
    if v_qty > v_bought - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المشتراة: %', v_name; end if;
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if not found or v_stock.quantity < v_qty then raise exception 'المخزون لا يسمح بالمرتجع: %', v_name; end if;
    insert into public.return_items(user_id, return_id, name, unit_price, quantity)
      values(auth.uid(), v_return_id, v_name, round(v_cost, 2), v_qty);
    update public.stock_items set quantity = quantity - v_qty, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values(auth.uid(), v_stock.id, 'return', -v_qty, round(v_cost, 2), p_purchase_id, 'مرتجع إلى المورد');
    perform public.recalculate_stock_average_cost(v_stock.id);
    v_total := v_total + round(v_cost, 2) * v_qty;
  end loop;

  update public.return_records set total_amount = round(v_total, 2) where id = v_return_id;
  update public.purchases
  set total = greatest(0, total - round(v_total, 2)),
      subtotal = greatest(0, coalesce(subtotal, total) - round(v_total, 2)),
      paid_amount = least(coalesce(paid_amount, 0), greatest(0, total - round(v_total, 2)))
  where id = p_purchase_id and user_id = auth.uid();

  if v_purchase.payment_type = 'cash' and v_total > 0 then
    insert into public.treasury_transactions(
      id, user_id, to_account_id, type, amount, category, description, reference_number, created_at
    ) values (
      v_return_id, auth.uid(), 'acc-cash-main', 'manual_in', round(v_total / 100.0, 2), 'مرتجع مشتريات',
      'رد قيمة مرتجع شراء', 'purchase-return:' || v_return_id::text, now()
    ) on conflict (id) do update set amount = excluded.amount, description = excluded.description;
  end if;
  perform public.assert_purchase_totals(p_purchase_id);
  return v_return_id;
end;
$$;
grant execute on function public.create_supplier_return(uuid, text, jsonb) to authenticated;

-- Existing purchase totals are stored in piasters/cents while treasury values
-- are displayed in pounds. Keep the database-side cashbox trigger in pounds.
create or replace function public.sync_purchase_cashbox_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_type = 'cash' and new.status = 'posted' and not new.deleted then
    insert into public.treasury_transactions(
      id, user_id, from_account_id, type, amount, category, description, reference_number, created_at
    ) values (
      new.id, new.user_id, 'acc-cash-main', 'manual_out', round(coalesce(new.total, 0) / 100.0, 2), 'مشتريات',
      'شراء بضاعة — ' || coalesce((select name from public.suppliers where id = new.supplier_id), 'مورد'),
      'purchase:' || new.id::text, new.purchase_date::timestamptz
    ) on conflict (id) do update set amount = excluded.amount, description = excluded.description, created_at = excluded.created_at;
  else
    delete from public.treasury_transactions where id = new.id and user_id = new.user_id and reference_number = 'purchase:' || new.id::text;
  end if;
  return new;
end;
$$;

create or replace function public.sync_supplier_payment_cashbox_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  if tg_op = 'DELETE' then
    delete from public.treasury_transactions where id = old.id and user_id = old.user_id;
    return old;
  end if;
  v_ref := 'purchase:' || coalesce(new.purchase_id::text, new.id::text) || ':payment:' || new.id::text;
  if new.purchase_id is not null and new.payment_method = 'cash' and not new.voided then
    insert into public.treasury_transactions(id, user_id, from_account_id, type, amount, category, description, reference_number, created_at)
    values(new.id, new.user_id, 'acc-cash-main', 'manual_out', round(new.amount / 100.0, 2), 'مشتريات', 'دفعة للمورد', v_ref, new.paid_at)
    on conflict (id) do update set amount = excluded.amount, created_at = excluded.created_at, reference_number = excluded.reference_number;
  else
    delete from public.treasury_transactions where id = new.id and user_id = new.user_id;
  end if;
  return new;
end;
$$;
