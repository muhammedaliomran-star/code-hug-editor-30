-- Purchase invoice workflow: stable internal numbering, supplier invoice data,
-- payment breakdown, due dates and paper-invoice attachments.

alter table public.purchases
  add column if not exists purchase_number bigint,
  add column if not exists supplier_invoice_number text,
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists shipping_amount numeric(12,2) not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists due_date date,
  add column if not exists status text not null default 'posted',
  add column if not exists attachment_path text;

alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check
  check (status in ('draft', 'posted', 'cancelled'));

-- Preserve existing invoices and give each workspace a monotonic sequence.
with numbered as (
  select id, row_number() over (partition by user_id order by created_at, id) as number
  from public.purchases
  where purchase_number is null
)
update public.purchases p
set purchase_number = numbered.number,
    subtotal = case when p.subtotal = 0 then p.total else p.subtotal end,
    paid_amount = case when p.payment_type = 'cash' then p.total else p.paid_amount end
from numbered
where p.id = numbered.id;

alter table public.purchases alter column purchase_number set not null;
create unique index if not exists purchases_user_purchase_number_idx
  on public.purchases(user_id, purchase_number);

create table if not exists public.purchase_number_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_number bigint not null default 1 check (next_number > 0)
);

insert into public.purchase_number_counters(user_id, next_number)
select user_id, coalesce(max(purchase_number), 0) + 1
from public.purchases
group by user_id
on conflict (user_id) do update
set next_number = greatest(public.purchase_number_counters.next_number, excluded.next_number);

alter table public.purchase_number_counters enable row level security;
drop policy if exists "Users manage own purchase counters" on public.purchase_number_counters;
create policy "Users manage own purchase counters" on public.purchase_number_counters
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.purchase_number_counters to authenticated;

alter table public.purchase_items
  add column if not exists unit text not null default 'قطعة',
  add column if not exists batch_number text,
  add column if not exists expiry_date date;

create or replace function public.get_next_purchase_number()
returns bigint language sql stable security invoker set search_path = public as $$
  select coalesce((select next_number from public.purchase_number_counters where user_id = auth.uid()),
                  (select coalesce(max(purchase_number), 0) + 1 from public.purchases where user_id = auth.uid()));
$$;
grant execute on function public.get_next_purchase_number() to authenticated;

-- The counter is incremented inside the transaction, so two browser tabs cannot
-- receive the same internal purchase code.
drop function if exists public.record_purchase_with_inventory(uuid, numeric, text, date, text, jsonb, uuid);
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
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'أضف صنفًا واحدًا على الأقل';
  end if;
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
    insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity, unit, batch_number, expiry_date)
      values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty, v_unit, v_batch, v_expiry);
    if p_status = 'posted' then
      select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
      if found then
        update public.stock_items set quantity = quantity + v_qty, last_unit_cost = v_cost, updated_at = now() where id = v_stock.id;
      else
        insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock;
      end if;
      insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id)
        values (auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
    end if;
  end loop;
  return p_purchase_id;
end;
$$;

grant execute on function public.record_purchase_with_inventory(uuid, numeric, text, date, text, jsonb, uuid, text, date, numeric, numeric, numeric, numeric, numeric, text) to authenticated;

create or replace function public.post_purchase_draft(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_item record; v_stock public.stock_items;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_purchase.status <> 'draft' then raise exception 'الفاتورة ليست مسودة'; end if;
  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_item.name for update;
    if found then
      update public.stock_items set quantity = quantity + v_item.quantity, last_unit_cost = v_item.unit_cost, updated_at = now() where id = v_stock.id;
    else
      insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_item.name, v_item.quantity, v_item.unit_cost, 0) returning * into v_stock;
    end if;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id)
      values (auth.uid(), v_stock.id, 'purchase', v_item.quantity, v_item.unit_cost, p_purchase_id);
  end loop;
  update public.purchases set status = 'posted' where id = p_purchase_id and user_id = auth.uid();
end;
$$;
grant execute on function public.post_purchase_draft(uuid) to authenticated;

create or replace function public.delete_purchase_with_inventory(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_old record; v_stock public.stock_items;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_purchase.status = 'posted' then
    for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
      select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_old.name for update;
      if not found or v_stock.quantity < v_old.quantity then raise exception 'المخزون لا يسمح بحذف الفاتورة: %', v_old.name; end if;
      update public.stock_items set quantity = quantity - v_old.quantity, updated_at = now() where id = v_stock.id;
      insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
        values (auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost, p_purchase_id, 'عكس حذف فاتورة الشراء');
    end loop;
  end if;
  delete from public.purchases where id = p_purchase_id and user_id = auth.uid();
end;
$$;
grant execute on function public.delete_purchase_with_inventory(uuid) to authenticated;
