-- Safely move an unpaid sale invoice back to a persistent sales draft.
-- Paid invoices are intentionally rejected; they require a refund workflow.
create or replace function public.revert_sale_invoice_to_draft(p_invoice_id uuid, p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invoice public.invoices;
  v_draft_number bigint;
  v_item record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_invoice_id is null or p_draft_id is null then raise exception 'معرّف الفاتورة والمسودة مطلوبان'; end if;

  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and user_id = v_user
   for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if coalesce(v_invoice.deleted, false) or coalesce(v_invoice.archived, false) or v_invoice.status = 'cancelled' then
    raise exception 'لا يمكن إعادة فاتورة محذوفة أو مؤرشفة أو ملغاة';
  end if;
  if greatest(coalesce(v_invoice.paid, 0), coalesce(v_invoice.down_payment, 0)) > 0 then
    raise exception 'لا يمكن إعادة فاتورة عليها دفعة؛ استخدم إجراء رد الأموال أولًا';
  end if;
  if exists (select 1 from public.sales_drafts where id = p_draft_id) then
    raise exception 'معرّف المسودة مستخدم بالفعل';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id and user_id = v_user) then
    raise exception 'الفاتورة لا تحتوي على أصناف';
  end if;

  insert into public.sales_drafts(
    id, user_id, customer_id, total, discount_pct, discount_amount,
    tax_pct, tax_amount, notes, deposit_total, expires_at
  ) values (
    p_draft_id, v_user, v_invoice.customer_id, v_invoice.total,
    coalesce(v_invoice.discount_pct, 0), coalesce(v_invoice.discount_amount, 0),
    coalesce(v_invoice.tax_pct, 0), coalesce(v_invoice.tax_amount, 0),
    v_invoice.notes, 0, now() + interval '48 hours'
  ) returning draft_number into v_draft_number;

  for v_item in
    select * from public.invoice_items where invoice_id = p_invoice_id and user_id = v_user
  loop
    if v_item.stock_item_id is not null then
      update public.stock_items
         set quantity = quantity + v_item.quantity, updated_at = now()
       where id = v_item.stock_item_id and user_id = v_user;
      if not found then raise exception 'صنف المخزون غير موجود: %', v_item.name; end if;
      update public.stock_items
         set reserved_quantity = reserved_quantity + v_item.quantity, updated_at = now()
       where id = v_item.stock_item_id and user_id = v_user;
    end if;
    insert into public.sales_draft_items(
      id, user_id, draft_id, stock_item_id, name, cost, price, discount_pct, tax_pct, quantity
    ) values (
      gen_random_uuid(), v_user, p_draft_id, v_item.stock_item_id, v_item.name,
      v_item.cost, v_item.price, coalesce(v_item.discount_pct, 0), coalesce(v_item.tax_pct, 0), v_item.quantity
    );
  end loop;

  update public.invoices
     set status = 'cancelled', notes = concat_ws(' — ', nullif(notes, ''), 'أعيدت إلى المسودة D-', lpad(v_draft_number::text, 4, '0'))
   where id = p_invoice_id and user_id = v_user;

  return jsonb_build_object('id', p_draft_id, 'draft_number', v_draft_number);
end;
$$;

revoke all on function public.revert_sale_invoice_to_draft(uuid,uuid) from public, anon;
grant execute on function public.revert_sale_invoice_to_draft(uuid,uuid) to authenticated;
