alter table public.return_records
  add column if not exists purchase_id uuid references public.purchases(id) on delete set null;

create or replace function public.create_supplier_return(
  p_purchase_id uuid, p_reason text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases; v_return_id uuid; v_item jsonb;
  v_name text; v_qty integer; v_cost numeric; v_bought integer; v_returned integer; v_total numeric := 0;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id and user_id = auth.uid() for update;
  if not found then raise exception 'فاتورة الشراء غير موجودة أو غير مسموح'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب المرتجع مطلوب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر صنفًا واحدًا على الأقل'; end if;

  insert into public.return_records (user_id, purchase_id, type, total_amount, reason)
    values (auth.uid(), p_purchase_id, 'supplier', 0, trim(p_reason)) returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name');
    v_qty := (v_item->>'quantity')::integer;
    v_cost := (v_item->>'unit_cost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;

    select coalesce(sum(quantity), 0) into v_bought from public.purchase_items where purchase_id = p_purchase_id and name = v_name;
    select coalesce(sum(ri.quantity), 0) into v_returned
      from public.return_items ri join public.return_records rr on rr.id = ri.return_id
      where rr.purchase_id = p_purchase_id and rr.type = 'supplier' and ri.name = v_name;
    if v_qty > v_bought - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المشتراة: %', v_name; end if;

    insert into public.return_items (user_id, return_id, name, unit_price, quantity)
      values (auth.uid(), v_return_id, v_name, round(v_cost, 2), v_qty);
    update public.stock_items set quantity = greatest(0, quantity - v_qty), updated_at = now()
      where user_id = auth.uid() and name = v_name;
    v_total := v_total + round(v_cost, 2) * v_qty;
  end loop;

  update public.return_records set total_amount = round(v_total, 2) where id = v_return_id;
  update public.purchases set total = greatest(0, total - round(v_total, 2)) where id = p_purchase_id;
  return v_return_id;
end;
$$;

revoke all on function public.create_supplier_return(uuid, text, jsonb) from public;
grant execute on function public.create_supplier_return(uuid, text, jsonb) to authenticated;
