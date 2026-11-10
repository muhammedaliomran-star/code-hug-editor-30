-- Allocate supplier payments to purchase invoices in FIFO order.
-- Any amount left after settling invoices remains an unallocated supplier credit
-- so opening balances and overpayments are not lost.

create or replace function public.record_supplier_payment_fifo(
  p_supplier_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_payment_method text default 'cash',
  p_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase record;
  v_remaining numeric := coalesce(p_amount, 0);
  v_due numeric;
  v_allocated numeric;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and user_id = auth.uid()
  ) then
    raise exception 'المورد غير موجود أو غير مسموح';
  end if;
  if v_remaining <= 0 then
    raise exception 'مبلغ الدفعة غير صحيح';
  end if;

  for v_purchase in
    select id, total, paid_amount
    from public.purchases
    where supplier_id = p_supplier_id
      and user_id = auth.uid()
      and not deleted
      and payment_type = 'credit'
      and greatest(0, total - paid_amount) > 0
    order by purchase_date asc, created_at asc, id asc
    for update
  loop
    exit when v_remaining <= 0;
    v_due := greatest(0, v_purchase.total - v_purchase.paid_amount);
    v_allocated := least(v_remaining, v_due);
    if v_allocated > 0 then
      insert into public.supplier_payments(
        user_id, supplier_id, purchase_id, amount, paid_at, payment_method, notes
      ) values (
        auth.uid(), p_supplier_id, v_purchase.id, v_allocated,
        p_paid_at, p_payment_method, p_notes
      );
      v_remaining := v_remaining - v_allocated;
      v_count := v_count + 1;
    end if;
  end loop;

  if v_remaining > 0 then
    insert into public.supplier_payments(
      user_id, supplier_id, amount, paid_at, payment_method, notes
    ) values (
      auth.uid(), p_supplier_id, v_remaining,
      p_paid_at, p_payment_method, coalesce(p_notes, 'دفعة زائدة أو رصيد غير موزع')
    );
  end if;

  return v_count;
end;
$$;

grant execute on function public.record_supplier_payment_fifo(uuid, numeric, timestamptz, text, text) to authenticated;

-- A purchase with linked payment rows cannot have its paid amount edited
-- independently; this prevents invoice/supplier-ledger divergence.
create or replace function public.guard_purchase_paid_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked numeric;
begin
  select coalesce(sum(amount), 0)
  into v_linked
  from public.supplier_payments
  where purchase_id = new.id;

  if exists (select 1 from public.supplier_payments where purchase_id = new.id)
     and abs(coalesce(new.paid_amount, 0) - v_linked) > 0.005 then
    raise exception 'لا يمكن تعديل المدفوع يدويًا؛ عدّل الدفعات المرتبطة بالفاتورة أولًا';
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_paid_amount_guard on public.purchases;
create trigger purchases_paid_amount_guard
before update of paid_amount on public.purchases
for each row execute function public.guard_purchase_paid_amount();
