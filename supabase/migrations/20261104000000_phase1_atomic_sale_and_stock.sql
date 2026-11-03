-- =============================================================
-- Phase 1 (audit remediation) — atomic sale + stock integrity
-- =============================================================
-- Moves sale creation and deletion into SECURITY DEFINER RPCs so that
-- invoice + items + stock deduction + stock_movements happen in one
-- transaction (a partial failure can no longer leave orphan invoices or
-- un-deducted stock). Adds stock_item_id to invoice_items so restores
-- happen by id + quantity instead of by (ambiguous) name.
--
-- Server-side enforcement of customer freeze / defaulter / credit limit
-- is moved here too (client checks remain as UX hints only).
--
-- Must be applied after 20261103000000 (Phase 0).
-- =============================================================

-- -------------------------------------------------------------
-- 1. stock_item_id on invoice_items (idempotent)
-- -------------------------------------------------------------
alter table public.invoice_items
  add column if not exists stock_item_id uuid references public.stock_items(id) on delete set null;

-- -------------------------------------------------------------
-- 2. movement trigger prefers stock_item_id
-- -------------------------------------------------------------
create or replace function public.log_invoice_item_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_stock public.stock_items;
begin
  if new.stock_item_id is not null then
    select * into v_stock from public.stock_items where id = new.stock_item_id;
  else
    select * into v_stock from public.stock_items where user_id = new.user_id and name = new.name limit 1;
  end if;
  if found then
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (new.user_id, v_stock.id, 'sale', -new.quantity, new.cost, new.invoice_id, 'بيع من فاتورة');
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_item_stock_movement on public.invoice_items;
create trigger invoice_item_stock_movement
  after insert on public.invoice_items
  for each row execute function public.log_invoice_item_stock_movement();

-- -------------------------------------------------------------
-- 3. create_sale — atomic
-- -------------------------------------------------------------
create or replace function public.create_sale(
  p_customer_id uuid,
  p_total numeric,
  p_down_payment numeric,
  p_monthly_installment numeric,
  p_first_due_date date,
  p_notes text,
  p_discount_pct numeric,
  p_discount_amount numeric,
  p_tax_pct numeric,
  p_tax_amount numeric,
  p_status text,
  p_paid numeric,
  p_items jsonb,
  p_invoice_id uuid default gen_random_uuid()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_customer record;
  v_item jsonb;
  v_name text;
  v_qty integer;
  v_cost numeric;
  v_price numeric;
  v_discount_pct numeric;
  v_tax_pct numeric;
  v_discount_amount numeric;
  v_tax_amount numeric;
  v_line_total numeric;
  v_stock_id uuid;
  v_stock public.stock_items;
  v_remaining numeric;
  v_open_balance numeric;
  v_limit numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_customer_id is null then raise exception 'العميل مطلوب'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'بيانات الأصناف غير صحيحة'; end if;

  select * into v_customer
    from public.customers
   where id = p_customer_id and user_id = v_user;
  if not found then raise exception 'العميل غير موجود'; end if;
  if v_customer.frozen then
    raise exception 'العميل «%» مجمّد — لا يمكن فتح فاتورة جديدة قبل تسوية حسابه', v_customer.name;
  end if;
  if v_customer.status = 'defaulter' then
    raise exception 'العميل «%» مماطل — لا يمكن فتح فاتورة جديدة قبل تسوية حسابه', v_customer.name;
  end if;

  v_remaining := greatest(0, coalesce(p_total, 0) - coalesce(p_paid, p_down_payment, 0));
  v_limit := coalesce(v_customer.credit_limit, 0);
  if v_limit > 0 and v_remaining > 0 then
    select coalesce(sum(total - paid), 0) into v_open_balance
      from public.invoices
     where customer_id = p_customer_id and user_id = v_user;
    v_open_balance := v_open_balance + coalesce(v_customer.opening_balance, 0);
    if v_open_balance + v_remaining > v_limit then
      raise exception 'تجاوز سقف المديونية: الحد % والمديونية بعد الفاتورة %',
        round(v_limit), round(v_open_balance + v_remaining);
    end if;
  end if;

  insert into public.invoices (
    id, user_id, customer_id, total, down_payment, monthly_installment,
    first_due_date, paid, notes, discount_pct, discount_amount,
    tax_pct, tax_amount, status
  ) values (
    p_invoice_id, v_user, p_customer_id, coalesce(p_total, 0),
    coalesce(p_down_payment, 0), coalesce(p_monthly_installment, 0),
    p_first_due_date, coalesce(p_paid, p_down_payment, 0), p_notes,
    coalesce(p_discount_pct, 0), coalesce(p_discount_amount, 0),
    coalesce(p_tax_pct, 0), coalesce(p_tax_amount, 0),
    coalesce(p_status, 'pending')
  );

  if jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_name := trim(coalesce(v_item->>'name', ''));
      if v_name = '' then raise exception 'اسم الصنف مطلوب'; end if;
      v_qty := coalesce((v_item->>'quantity')::integer, 0);
      if v_qty <= 0 then raise exception 'كمية غير صحيحة للصنف %', v_name; end if;
      v_cost  := coalesce((v_item->>'cost')::numeric, 0);
      v_price := coalesce((v_item->>'price')::numeric, 0);
      if v_price < 0 then raise exception 'سعر غير صحيح للصنف %', v_name; end if;
      v_discount_pct := least(100, greatest(0, coalesce((v_item->>'discount_pct')::numeric, 0)));
      v_tax_pct      := greatest(0, coalesce((v_item->>'tax_pct')::numeric, 0));
      v_discount_amount := (v_price * v_qty) * v_discount_pct / 100;
      v_tax_amount      := ((v_price * v_qty) - v_discount_amount) * v_tax_pct / 100;
      v_line_total      := (v_price * v_qty) - v_discount_amount + v_tax_amount;

      v_stock_id := null;
      if v_item ? 'stock_item_id' and nullif(trim(v_item->>'stock_item_id'), '') is not null then
        v_stock_id := (v_item->>'stock_item_id')::uuid;
      end if;

      insert into public.invoice_items (
        user_id, invoice_id, name, cost, price, quantity,
        discount_pct, discount_amount, tax_pct, tax_amount, line_total,
        serial_numbers, stock_item_id
      ) values (
        v_user, p_invoice_id, v_name, v_cost, v_price, v_qty,
        v_discount_pct, v_discount_amount, v_tax_pct, v_tax_amount, v_line_total,
        coalesce(
          (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(v_item->'serial_numbers', '[]'::jsonb)) as x where trim(x) <> ''),
          '{}'::text[]
        ),
        v_stock_id
      );

      -- atomic stock deduction (row lock + availability check)
      if v_stock_id is not null then
        select * into v_stock
          from public.stock_items
         where id = v_stock_id and user_id = v_user
           for update;
        if not found then
          raise exception 'صنف المخزون غير موجود: %', v_name;
        end if;
        if v_stock.quantity < v_qty then
          raise exception 'الكمية المتاحة من «%» هي % فقط (المطلوب: %)',
            v_stock.name, v_stock.quantity, v_qty;
        end if;
        update public.stock_items
           set quantity = quantity - v_qty, updated_at = now()
         where id = v_stock_id and user_id = v_user;
      end if;
    end loop;
  end if;

  return p_invoice_id;
end;
$$;

-- -------------------------------------------------------------
-- 4. delete_invoice_with_stock — restore by id + quantity
-- -------------------------------------------------------------
create or replace function public.delete_invoice_with_stock(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item record;
  v_stock public.stock_items;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.invoices where id = p_invoice_id and user_id = v_user) then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;

  -- restore stock and log movements BEFORE deleting the invoice
  for v_item in
    select name, quantity, stock_item_id, cost
      from public.invoice_items
     where invoice_id = p_invoice_id and user_id = v_user
  loop
    if v_item.stock_item_id is not null then
      select * into v_stock
        from public.stock_items
       where id = v_item.stock_item_id and user_id = v_user
         for update;
      if found then
        update public.stock_items
           set quantity = quantity + v_item.quantity, updated_at = now()
         where id = v_item.stock_item_id and user_id = v_user;
        insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
          values (v_user, v_item.stock_item_id, 'return', v_item.quantity, v_item.cost, p_invoice_id, 'حذف فاتورة');
      end if;
    else
      -- legacy rows without stock_item_id: fall back to name lookup
      select * into v_stock
        from public.stock_items
       where user_id = v_user and name = v_item.name
         for update;
      if found then
        update public.stock_items
           set quantity = quantity + v_item.quantity, updated_at = now()
         where id = v_stock.id;
        insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
          values (v_user, v_stock.id, 'return', v_item.quantity, v_item.cost, p_invoice_id, 'حذف فاتورة');
      end if;
    end if;
  end loop;

  delete from public.payments where invoice_id = p_invoice_id and user_id = v_user;
  delete from public.invoices  where id = p_invoice_id and user_id = v_user;
end;
$$;

-- -------------------------------------------------------------
-- 5. deduct_stock — atomic ad-hoc deduction
-- -------------------------------------------------------------
create or replace function public.deduct_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_stock_id uuid;
  v_qty integer;
  v_stock public.stock_items;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'بيانات الأصناف غير صحيحة'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_stock_id := (v_item->>'stock_item_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_stock_id is null or v_qty <= 0 then continue; end if;
    select * into v_stock
      from public.stock_items
     where id = v_stock_id and user_id = v_user
       for update;
    if not found then raise exception 'صنف المخزون غير موجود'; end if;
    if v_stock.quantity < v_qty then
      raise exception 'الكمية المتاحة من «%» هي % فقط (المطلوب: %)', v_stock.name, v_stock.quantity, v_qty;
    end if;
    update public.stock_items
       set quantity = quantity - v_qty, updated_at = now()
     where id = v_stock_id and user_id = v_user;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (v_user, v_stock_id, 'adjustment', -v_qty, v_stock.last_unit_cost, null, 'خصم مخزون');
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- 6. Grants
-- -------------------------------------------------------------
revoke all on function public.create_sale(uuid, numeric, numeric, numeric, date, text, numeric, numeric, numeric, numeric, text, numeric, jsonb, uuid) from public, anon;
revoke all on function public.delete_invoice_with_stock(uuid) from public, anon;
revoke all on function public.deduct_stock(jsonb) from public, anon;

grant execute on function public.create_sale(uuid, numeric, numeric, numeric, date, text, numeric, numeric, numeric, numeric, text, numeric, jsonb, uuid) to authenticated;
grant execute on function public.delete_invoice_with_stock(uuid) to authenticated;
grant execute on function public.deduct_stock(jsonb) to authenticated;
