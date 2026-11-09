-- Weighted Average Cost (WAC) for stock_items.last_unit_cost on purchase.
-- Replaces record_purchase_with_inventory to compute a weighted average
-- instead of overwriting with the last purchase price.
create or replace function public.record_purchase_with_inventory(
  p_supplier_id uuid, p_total numeric, p_payment_type text, p_purchase_date date, p_notes text, p_items jsonb, p_purchase_id uuid default gen_random_uuid()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric; v_new_cost numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف صنفًا واحدًا على الأقل'; end if;
  insert into public.purchases (id, user_id, supplier_id, total, payment_type, purchase_date, notes)
    values (p_purchase_id, auth.uid(), p_supplier_id, p_total, p_payment_type, p_purchase_date, p_notes);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unitCost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost <= 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity) values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty);
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if found then
      -- Weighted average cost
      if (v_stock.quantity + v_qty) > 0 then
        v_new_cost := (v_stock.quantity * v_stock.last_unit_cost + v_qty * v_cost) / (v_stock.quantity + v_qty);
      else
        v_new_cost := v_cost;
      end if;
      update public.stock_items set quantity = quantity + v_qty, last_unit_cost = v_new_cost, updated_at = now() where id = v_stock.id;
    else
      insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock;
    end if;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id) values (auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
  end loop;
  return p_purchase_id;
end;
$$;
