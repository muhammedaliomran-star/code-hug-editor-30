-- Permanent deletion is allowed only for invoices already in the recycle bin.
create or replace function public.permanently_delete_purchase(
  p_purchase_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_purchase public.purchases;
begin
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;
  if not v_purchase.deleted then
    raise exception 'لا يمكن الحذف النهائي قبل نقل الفاتورة إلى سلة المحذوفات';
  end if;

  -- Inventory was already reversed when the invoice entered the recycle bin.
  delete from public.purchases
  where id = p_purchase_id and user_id = auth.uid();
end;
$$;

grant execute on function public.permanently_delete_purchase(uuid) to authenticated;
