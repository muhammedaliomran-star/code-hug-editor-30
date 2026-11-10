-- Replace all sale items atomically and keep stock movements reversible.

create or replace function public.replace_invoice_items(
  p_invoice_id uuid,
  p_total numeric,
  p_items jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.invoices;
  v_item jsonb;
  v_old record;
  v_stock public.stock_items;
  v_name text;
  v_qty integer;
  v_cost numeric;
  v_price numeric;
  v_discount numeric;
  v_tax numeric;
  v_expected numeric := 0;
  v_line numeric;
  v_stock_id uuid;
begin
  select * into v_invoice from public.invoices
   where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'يجب إضافة صنف واحد على الأقل';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(coalesce(v_item->>'name', ''));
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    v_cost := coalesce((v_item->>'cost')::numeric, 0);
    v_price := coalesce((v_item->>'price')::numeric, 0);
    v_discount := least(100, greatest(0, coalesce((v_item->>'discount_pct')::numeric, 0)));
    v_tax := greatest(0, coalesce((v_item->>'tax_pct')::numeric, 0));
    if v_name = '' or v_qty <= 0 or v_price < 0 or v_cost < 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    v_line := (v_price * v_qty) * (1 - v_discount / 100) * (1 + v_tax / 100);
    v_expected := v_expected + v_line;
  end loop;
  if abs(round(v_expected, 2) - round(p_total, 2)) > 0.01 then
    raise exception 'إجمالي الفاتورة لا يساوي مجموع الأصناف';
  end if;

  -- Restore the previous stock quantities before replacing the rows.
  for v_old in select * from public.invoice_items where invoice_id = p_invoice_id and user_id = auth.uid() loop
    if v_old.stock_item_id is not null then
      update public.stock_items set quantity = quantity + v_old.quantity, updated_at = now()
       where id = v_old.stock_item_id and user_id = auth.uid();
      insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
       values (auth.uid(), v_old.stock_item_id, 'reversal', v_old.quantity, v_old.cost, p_invoice_id, 'استبدال أصناف فاتورة');
    end if;
  end loop;
  delete from public.invoice_items where invoice_id = p_invoice_id and user_id = auth.uid();

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name');
    v_qty := (v_item->>'quantity')::integer;
    v_cost := coalesce((v_item->>'cost')::numeric, 0);
    v_price := coalesce((v_item->>'price')::numeric, 0);
    v_discount := least(100, greatest(0, coalesce((v_item->>'discount_pct')::numeric, 0)));
    v_tax := greatest(0, coalesce((v_item->>'tax_pct')::numeric, 0));
    v_line := (v_price * v_qty) * (1 - v_discount / 100) * (1 + v_tax / 100);
    v_stock_id := nullif(trim(v_item->>'stock_item_id'), '')::uuid;
    insert into public.invoice_items(user_id, invoice_id, name, cost, price, quantity, discount_pct, discount_amount, tax_pct, tax_amount, line_total, serial_numbers, stock_item_id)
    values (auth.uid(), p_invoice_id, v_name, v_cost, v_price, v_qty, v_discount,
      (v_price * v_qty) * v_discount / 100,
      v_tax, ((v_price * v_qty) * (1 - v_discount / 100)) * v_tax / 100,
      v_line,
      coalesce((select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(v_item->'serial_numbers', '[]'::jsonb)) as x where trim(x) <> ''), '{}'::text[]),
      v_stock_id);
    if v_stock_id is not null then
      select * into v_stock from public.stock_items where id = v_stock_id and user_id = auth.uid() for update;
      if not found or v_stock.quantity < v_qty then raise exception 'الكمية المتاحة غير كافية للصنف %', v_name; end if;
      update public.stock_items set quantity = quantity - v_qty, updated_at = now() where id = v_stock_id;
    end if;
  end loop;
  update public.invoices set total = p_total, paid = least(p_total, down_payment + coalesce((select sum(amount) from public.payments where invoice_id = p_invoice_id), 0)),
    status = case when least(p_total, down_payment + coalesce((select sum(amount) from public.payments where invoice_id = p_invoice_id), 0)) >= p_total then 'paid' else 'pending' end
    where id = p_invoice_id;
end;
$$;

revoke all on function public.replace_invoice_items(uuid,numeric,jsonb) from public, anon;
grant execute on function public.replace_invoice_items(uuid,numeric,jsonb) to authenticated;
