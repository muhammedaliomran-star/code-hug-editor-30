-- Preserve the accounting identity of every invoice payment.

drop function if exists public.record_invoice_payment(uuid, numeric, uuid, timestamptz);

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_id uuid default gen_random_uuid(),
  p_paid_at timestamptz default now(),
  p_payment_method text default 'cash',
  p_account_id text default null,
  p_reference_number text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ التحصيل يجب أن يكون أكبر من صفر'; end if;
  select i.* into v_invoice from public.invoices i
   where i.id = p_invoice_id and i.user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'لا يمكن التحصيل من فاتورة ملغاة'; end if;
  if p_amount > greatest(0, v_invoice.total - v_invoice.paid) then raise exception 'مبلغ التحصيل أكبر من المتبقي'; end if;
  insert into public.payments(id, user_id, invoice_id, amount, paid_at, payment_method, account_id, reference_number)
    values (p_payment_id, auth.uid(), p_invoice_id, p_amount, p_paid_at,
      coalesce(nullif(trim(p_payment_method), ''), 'cash'), p_account_id,
      nullif(trim(p_reference_number), ''));
  select least(v_invoice.total, v_invoice.down_payment + coalesce(sum(p.amount), 0))
    into v_paid from public.payments p where p.invoice_id = p_invoice_id;
  update public.invoices set paid = v_paid,
    status = case when v_paid >= total then 'paid' else status end
    where id = p_invoice_id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', p_invoice_id, 'paid', v_paid);
end;
$$;

grant execute on function public.record_invoice_payment(uuid,numeric,uuid,timestamptz,text,text,text) to authenticated;
