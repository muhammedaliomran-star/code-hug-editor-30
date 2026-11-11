-- إصلاحات دورة بيع الفواتير: تعديل ذري وحذف مرتجع مع عكس القيود المالية والمخزنية.

create or replace function public.update_sale_invoice_workflow(
  p_invoice_id uuid,
  p_total numeric,
  p_down_payment numeric,
  p_monthly_installment numeric,
  p_first_due_date date,
  p_notes text,
  p_items jsonb default null,
  p_status text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_paid numeric;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_total is null or p_total < 0 then raise exception 'إجمالي الفاتورة غير صحيح'; end if;
  if p_down_payment is null or p_down_payment < 0 or p_down_payment > p_total then
    raise exception 'المقدم يجب أن يكون بين صفر وإجمالي الفاتورة';
  end if;
  if p_monthly_installment is null or p_monthly_installment < 0 then
    raise exception 'قيمة القسط غير صحيحة';
  end if;

  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and user_id = auth.uid()
   for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if coalesce(v_invoice.deleted, false) then raise exception 'لا يمكن تعديل فاتورة موجودة في سلة المحذوفات'; end if;
  if v_invoice.status in ('cancelled', 'returned_partial', 'returned_full') then
    raise exception 'لا يمكن تعديل فاتورة ملغاة أو مرتجعة';
  end if;
  if p_status in ('cancelled', 'returned_partial', 'returned_full') then
    raise exception 'حالة الفاتورة المطلوبة غير مسموحة من شاشة التعديل';
  end if;

  -- عند وجود أصناف، يتم استبدالها داخل نفس المعاملة وإعادة ضبط المخزون.
  if p_items is not null then
    perform public.replace_invoice_items(p_invoice_id, p_total, p_items);
  end if;

  select least(p_total, p_down_payment + coalesce(sum(amount), 0))
    into v_paid
    from public.payments
   where invoice_id = p_invoice_id and user_id = auth.uid();
  v_status := case when v_paid >= p_total then 'paid' else 'pending' end;

  update public.invoices
     set total = p_total,
         down_payment = p_down_payment,
         monthly_installment = p_monthly_installment,
         first_due_date = p_first_due_date,
         notes = p_notes,
         paid = v_paid,
         status = v_status,
         updated_at = now()
   where id = p_invoice_id and user_id = auth.uid();
end;
$$;

revoke all on function public.update_sale_invoice_workflow(uuid,numeric,numeric,numeric,date,text,jsonb,text) from public, anon;
grant execute on function public.update_sale_invoice_workflow(uuid,numeric,numeric,numeric,date,text,jsonb,text) to authenticated;

create or replace function public.set_sale_invoice_status(
  p_invoice_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('paid', 'pending') then raise exception 'حالة الفاتورة غير مسموحة'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if p_status = 'paid' and v_invoice.paid < v_invoice.total then
    raise exception 'لا يمكن وضع فاتورة غير مسددة كمسددة';
  end if;
  update public.invoices set status = p_status, updated_at = now() where id = p_invoice_id and user_id = auth.uid();
end;
$$;

revoke all on function public.set_sale_invoice_status(uuid,text) from public, anon;
grant execute on function public.set_sale_invoice_status(uuid,text) to authenticated;

create or replace function public.delete_sale_return_with_reversal(p_return_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.return_records;
  v_invoice public.invoices;
  v_refund public.invoice_refunds;
  v_item record;
  v_stock public.stock_items;
  v_remaining_returns numeric;
  v_new_total numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_return
    from public.return_records
   where id = p_return_id and user_id = auth.uid() and type = 'sale'
   for update;
  if not found then raise exception 'مرتجع البيع غير موجود أو غير مسموح'; end if;

  select * into v_invoice
    from public.invoices
   where id = v_return.invoice_id and user_id = auth.uid()
   for update;
  if not found then raise exception 'الفاتورة الأصلية غير موجودة'; end if;

  -- عكس الكمية التي أعادها المرتجع، مع منع الوصول إلى مخزون سالب.
  for v_item in
    select name, quantity
      from public.return_items
     where return_id = p_return_id and user_id = auth.uid()
  loop
    select * into v_stock
      from public.stock_items
     where user_id = auth.uid() and name = v_item.name
     order by id
     limit 1
     for update;
    if not found then raise exception 'صنف المخزون غير موجود لعكس المرتجع: %', v_item.name; end if;
    if v_stock.quantity < v_item.quantity then
      raise exception 'لا يمكن حذف المرتجع لأن الكمية أعيد بيعها أو لم تعد متاحة لعكس الحركة: %', v_item.name;
    end if;
    update public.stock_items
       set quantity = quantity - v_item.quantity, updated_at = now()
     where id = v_stock.id and user_id = auth.uid();
    insert into public.stock_movements(user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (auth.uid(), v_stock.id, 'reversal', -v_item.quantity, v_stock.last_unit_cost, p_return_id, 'عكس حذف مرتجع بيع');
  end loop;

  select * into v_refund
    from public.invoice_refunds
   where return_id = p_return_id and user_id = auth.uid()
   for update;
  if found then
    if v_refund.payment_method = 'cash' then
      delete from public.treasury_transactions
       where user_id = auth.uid()
         and reference_number = 'invoice-refund:' || p_return_id::text;
    end if;
    delete from public.invoice_refunds where id = v_refund.id and user_id = auth.uid();
  end if;

  delete from public.return_records where id = p_return_id and user_id = auth.uid();

  v_new_total := v_invoice.total + coalesce(v_return.total_amount, 0);
  select coalesce(sum(total_amount), 0) into v_remaining_returns
    from public.return_records
   where invoice_id = v_invoice.id and user_id = auth.uid() and type = 'sale';

  update public.invoices
     set total = v_new_total,
         paid = least(v_new_total, v_invoice.down_payment + coalesce((select sum(amount) from public.payments where invoice_id = v_invoice.id and user_id = auth.uid()), 0)),
         status = case
           when v_remaining_returns > 0 and v_remaining_returns >= v_new_total then 'returned_full'
           when v_remaining_returns > 0 then 'returned_partial'
           when v_invoice.down_payment + coalesce((select sum(amount) from public.payments where invoice_id = v_invoice.id and user_id = auth.uid()), 0) >= v_new_total then 'paid'
           else 'pending'
         end,
         updated_at = now()
   where id = v_invoice.id and user_id = auth.uid();
end;
$$;

revoke all on function public.delete_sale_return_with_reversal(uuid) from public, anon;
grant execute on function public.delete_sale_return_with_reversal(uuid) to authenticated;
