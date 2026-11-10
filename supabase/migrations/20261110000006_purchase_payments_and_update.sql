-- Purchase-level supplier payments and complete invoice updates.
alter table public.supplier_payments
  add column if not exists purchase_id uuid references public.purchases(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists notes text;

create index if not exists supplier_payments_purchase_idx
  on public.supplier_payments(user_id, purchase_id, paid_at desc);

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
  select * into v_purchase from public.purchases where id = p_purchase_id and user_id = auth.uid() and not deleted for update;
  if not found then raise exception 'الفاتورة غير موجودة أو محذوفة'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ الدفعة غير صحيح'; end if;
  if p_amount > greatest(0, v_purchase.total - v_purchase.paid_amount) then raise exception 'الدفعة أكبر من المتبقي'; end if;

  insert into public.supplier_payments(user_id, supplier_id, purchase_id, amount, paid_at, payment_method, notes)
    values (auth.uid(), v_purchase.supplier_id, p_purchase_id, p_amount, p_paid_at, p_payment_method, p_notes)
    returning id into v_id;
  update public.purchases set paid_amount = paid_amount + p_amount where id = p_purchase_id and user_id = auth.uid();
  return v_id;
end;
$$;
grant execute on function public.record_purchase_payment(uuid, numeric, timestamptz, text, text) to authenticated;

create or replace function public.update_purchase_with_inventory(
  p_purchase_id uuid, p_supplier_id uuid, p_total numeric, p_payment_type text,
  p_purchase_date date, p_notes text, p_items jsonb,
  p_supplier_invoice_number text default null, p_due_date date default null,
  p_paid_amount numeric default null, p_discount_amount numeric default 0,
  p_tax_amount numeric default 0, p_shipping_amount numeric default 0,
  p_subtotal numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old record; v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric; v_unit text; v_batch text; v_expiry date;
begin
  if not exists (select 1 from public.purchases where id = p_purchase_id and user_id = auth.uid() and not deleted) then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف صنفًا واحدًا على الأقل'; end if;
  for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_old.name for update;
    if not found or v_stock.quantity < v_old.quantity then raise exception 'المخزون لا يسمح بعكس الفاتورة القديمة: %', v_old.name; end if;
    update public.stock_items set quantity = quantity - v_old.quantity, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes) values(auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost, p_purchase_id, 'عكس نسخة الشراء القديمة');
  end loop;
  delete from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid();
  update public.purchases set supplier_id=p_supplier_id,total=p_total,payment_type=p_payment_type,purchase_date=p_purchase_date,notes=p_notes,supplier_invoice_number=nullif(trim(p_supplier_invoice_number),''),due_date=p_due_date,paid_amount=coalesce(p_paid_amount,paid_amount),subtotal=coalesce(p_subtotal,p_total),discount_amount=coalesce(p_discount_amount,0),tax_amount=coalesce(p_tax_amount,0),shipping_amount=coalesce(p_shipping_amount,0) where id=p_purchase_id and user_id=auth.uid();
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name:=trim(v_item->>'name'); v_qty:=(v_item->>'quantity')::integer; v_cost:=(v_item->>'unitCost')::numeric; v_unit:=coalesce(nullif(trim(v_item->>'unit'),''),'قطعة'); v_batch:=nullif(trim(v_item->>'batchNumber'),''); v_expiry:=nullif(v_item->>'expiryDate','')::date;
    if v_name='' or v_qty is null or v_qty<=0 or v_cost is null or v_cost<=0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items(user_id,purchase_id,name,unit_cost,quantity,unit,batch_number,expiry_date) values(auth.uid(),p_purchase_id,v_name,v_cost,v_qty,v_unit,v_batch,v_expiry);
    select * into v_stock from public.stock_items where user_id=auth.uid() and name=v_name for update;
    if found then update public.stock_items set quantity=quantity+v_qty,last_unit_cost=v_cost,updated_at=now() where id=v_stock.id; else insert into public.stock_items(user_id,name,quantity,last_unit_cost,sale_price) values(auth.uid(),v_name,v_qty,v_cost,0) returning * into v_stock; end if;
    insert into public.stock_movements(user_id,stock_item_id,movement_type,quantity,unit_cost,reference_id) values(auth.uid(),v_stock.id,'purchase',v_qty,v_cost,p_purchase_id);
  end loop;
end;
$$;
grant execute on function public.update_purchase_with_inventory(uuid,uuid,numeric,text,date,text,jsonb,text,date,numeric,numeric,numeric,numeric,numeric) to authenticated;
