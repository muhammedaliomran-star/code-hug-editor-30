-- Weighted-average purchase cost and accounting-safe supplier returns.

create or replace function public.recalculate_stock_average_cost(p_stock_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_qty numeric; v_value numeric;
begin
  select coalesce(sum(quantity), 0), coalesce(sum(quantity * unit_cost), 0)
  into v_qty, v_value
  from public.stock_movements
  where stock_item_id = p_stock_item_id
    and movement_type in ('purchase', 'reversal', 'return');
  update public.stock_items
  set last_unit_cost = case when v_qty > 0 then round(v_value / v_qty, 2) else last_unit_cost end,
      updated_at = now()
  where id = p_stock_item_id;
end;
$$;

create or replace function public.record_purchase_with_inventory(
  p_supplier_id uuid, p_total numeric, p_payment_type text, p_purchase_date date,
  p_notes text, p_items jsonb, p_purchase_id uuid default gen_random_uuid(),
  p_supplier_invoice_number text default null, p_due_date date default null,
  p_paid_amount numeric default null, p_discount_amount numeric default 0,
  p_tax_amount numeric default 0, p_shipping_amount numeric default 0,
  p_subtotal numeric default null, p_status text default 'posted'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric;
  v_unit text; v_batch text; v_expiry date; v_purchase_number bigint; v_paid numeric;
  v_old_qty numeric; v_new_cost numeric;
begin
  if not exists (select 1 from public.suppliers where id = p_supplier_id and user_id = auth.uid()) then
    raise exception 'المورد غير موجود أو غير مسموح';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف صنفًا واحدًا على الأقل'; end if;
  if p_status not in ('draft', 'posted') then raise exception 'حالة فاتورة غير صحيحة'; end if;

  insert into public.purchase_number_counters(user_id, next_number) values (auth.uid(), 2)
  on conflict (user_id) do update set next_number = public.purchase_number_counters.next_number + 1
  returning next_number - 1 into v_purchase_number;
  v_paid := coalesce(p_paid_amount, case when p_payment_type = 'cash' then p_total else 0 end);

  insert into public.purchases (
    id, user_id, supplier_id, purchase_number, supplier_invoice_number, total,
    subtotal, discount_amount, tax_amount, shipping_amount, paid_amount,
    due_date, status, payment_type, purchase_date, notes
  ) values (
    p_purchase_id, auth.uid(), p_supplier_id, v_purchase_number, nullif(trim(p_supplier_invoice_number), ''),
    p_total, coalesce(p_subtotal, p_total), coalesce(p_discount_amount, 0), coalesce(p_tax_amount, 0),
    coalesce(p_shipping_amount, 0), v_paid, p_due_date, p_status, p_payment_type, p_purchase_date, p_notes
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unitCost')::numeric;
    v_unit := coalesce(nullif(trim(v_item->>'unit'), ''), 'قطعة');
    v_batch := nullif(trim(v_item->>'batchNumber'), '');
    v_expiry := nullif(v_item->>'expiryDate', '')::date;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost <= 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items(user_id, purchase_id, name, unit_cost, quantity, unit, batch_number, expiry_date)
      values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty, v_unit, v_batch, v_expiry);
    if p_status = 'posted' then
      select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
      if found then
        v_old_qty := greatest(0, v_stock.quantity);
        v_new_cost := case when v_old_qty + v_qty > 0 then ((v_old_qty * coalesce(v_stock.last_unit_cost, 0)) + (v_qty * v_cost)) / (v_old_qty + v_qty) else v_cost end;
        update public.stock_items set quantity = quantity + v_qty, last_unit_cost = round(v_new_cost, 2), updated_at = now() where id = v_stock.id;
      else
        insert into public.stock_items(user_id, name, quantity, last_unit_cost, sale_price) values(auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock;
      end if;
      insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id)
        values(auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
    end if;
  end loop;
  return p_purchase_id;
end;
$$;

grant execute on function public.record_purchase_with_inventory(uuid, numeric, text, date, text, jsonb, uuid, text, date, numeric, numeric, numeric, numeric, numeric, text) to authenticated;

create or replace function public.post_purchase_draft(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_item record; v_stock public.stock_items; v_old_qty numeric; v_new_cost numeric;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id and user_id = auth.uid() and not deleted for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_purchase.status <> 'draft' then raise exception 'الفاتورة ليست مسودة'; end if;
  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_item.name for update;
    if found then
      v_old_qty := greatest(0, v_stock.quantity);
      v_new_cost := case when v_old_qty + v_item.quantity > 0 then ((v_old_qty * coalesce(v_stock.last_unit_cost, 0)) + (v_item.quantity * v_item.unit_cost)) / (v_old_qty + v_item.quantity) else v_item.unit_cost end;
      update public.stock_items set quantity = quantity + v_item.quantity, last_unit_cost = round(v_new_cost, 2), updated_at = now() where id = v_stock.id;
    else
      insert into public.stock_items(user_id, name, quantity, last_unit_cost, sale_price) values(auth.uid(), v_item.name, v_item.quantity, v_item.unit_cost, 0) returning * into v_stock;
    end if;
    insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id) values(auth.uid(), v_stock.id, 'purchase', v_item.quantity, v_item.unit_cost, p_purchase_id);
  end loop;
  update public.purchases set status = 'posted' where id = p_purchase_id and user_id = auth.uid();
end;
$$;

grant execute on function public.post_purchase_draft(uuid) to authenticated;

-- Replace supplier-return logic with a stock movement and consistent totals.
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
  insert into public.return_records(user_id, purchase_id, type, total_amount, reason) values(auth.uid(), p_purchase_id, 'supplier', 0, trim(p_reason)) returning id into v_return_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unit_cost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;
    select coalesce(sum(quantity), 0) into v_bought from public.purchase_items where purchase_id = p_purchase_id and name = v_name;
    select coalesce(sum(ri.quantity), 0) into v_returned from public.return_items ri join public.return_records rr on rr.id = ri.return_id where rr.purchase_id = p_purchase_id and rr.type = 'supplier' and ri.name = v_name;
    if v_qty > v_bought - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المشتراة: %', v_name; end if;
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if not found or v_stock.quantity < v_qty then raise exception 'المخزون لا يسمح بالمرتجع: %', v_name; end if;
    insert into public.return_items(user_id, return_id, name, unit_price, quantity) values(auth.uid(), v_return_id, v_name, round(v_cost, 2), v_qty);
    update public.stock_items set quantity = quantity - v_qty, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes) values(auth.uid(), v_stock.id, 'return', -v_qty, round(v_cost, 2), p_purchase_id, 'مرتجع إلى المورد');
    perform public.recalculate_stock_average_cost(v_stock.id);
    v_total := v_total + round(v_cost, 2) * v_qty;
  end loop;
  update public.return_records set total_amount = round(v_total, 2) where id = v_return_id;
  update public.purchases
  set total = greatest(0, total - round(v_total, 2)),
      subtotal = greatest(0, coalesce(subtotal, total) - round(v_total, 2)),
      paid_amount = least(coalesce(paid_amount, 0), greatest(0, total - round(v_total, 2)))
  where id = p_purchase_id and user_id = auth.uid();
  return v_return_id;
end;
$$;

grant execute on function public.create_supplier_return(uuid, text, jsonb) to authenticated;
