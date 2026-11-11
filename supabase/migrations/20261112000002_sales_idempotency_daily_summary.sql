-- Idempotency للمبيعات والمدفوعات والمرتجعات + تجميعات اليومية.

create or replace function public.create_sale_with_workflow_v3(
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
  p_invoice_id uuid,
  p_down_payment_method text default 'cash',
  p_down_payment_account_id text default null,
  p_down_payment_reference text default null,
  p_split_cash_amount numeric default 0,
  p_split_electronic_amount numeric default 0,
  p_split_electronic_method text default null,
  p_shipment jsonb default null,
  p_branch_id uuid default null,
  p_cashier_id uuid default null,
  p_source text default 'pos',
  p_external_order_number text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_invoice_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_existing
  from public.invoices
  where id = p_invoice_id
    and user_id = auth.uid();

  if v_existing is not null then
    return v_existing;
  end if;

  v_invoice_id := public.create_sale_with_workflow_v2(
    p_customer_id,
    p_total,
    p_down_payment,
    p_monthly_installment,
    p_first_due_date,
    p_notes,
    p_discount_pct,
    p_discount_amount,
    p_tax_pct,
    p_tax_amount,
    p_status,
    p_paid,
    p_items,
    p_invoice_id,
    p_down_payment_method,
    p_down_payment_account_id,
    p_down_payment_reference,
    p_split_cash_amount,
    p_split_electronic_amount,
    p_split_electronic_method,
    p_shipment,
    p_branch_id,
    p_cashier_id,
    p_source
  );

  update public.invoices
  set external_order_number = nullif(trim(p_external_order_number), '')
  where id = v_invoice_id
    and user_id = auth.uid();

  return v_invoice_id;
end;
$$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_id uuid default gen_random_uuid(),
  p_paid_at timestamptz default now(),
  p_payment_method text default 'cash',
  p_account_id text default null,
  p_reference_number text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_existing public.payments;
  v_paid numeric;
begin
  select * into v_existing
  from public.payments
  where id = p_payment_id
    and user_id = auth.uid();

  if found then
    if v_existing.invoice_id <> p_invoice_id
       or v_existing.amount <> p_amount then
      raise exception 'معرّف الدفعة مستخدم ببيانات مختلفة';
    end if;
    return jsonb_build_object(
      'payment_id', v_existing.id,
      'invoice_id', v_existing.invoice_id,
      'paid', (select paid from public.invoices where id = v_existing.invoice_id)
    );
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ التحصيل يجب أن يكون أكبر من صفر';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception 'لا يمكن التحصيل من فاتورة ملغاة';
  end if;

  if p_amount > greatest(0, v_invoice.total - v_invoice.paid) then
    raise exception 'مبلغ التحصيل أكبر من المتبقي';
  end if;

  insert into public.payments(
    id,
    user_id,
    invoice_id,
    amount,
    paid_at,
    payment_method,
    account_id,
    reference_number
  )
  values (
    p_payment_id,
    auth.uid(),
    p_invoice_id,
    p_amount,
    p_paid_at,
    coalesce(nullif(trim(p_payment_method), ''), 'cash'),
    p_account_id,
    nullif(trim(p_reference_number), '')
  );

  select least(
    v_invoice.total,
    v_invoice.down_payment + coalesce(sum(amount), 0)
  )
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  update public.invoices
  set
    paid = v_paid,
    status = case when v_paid >= total then 'paid' else status end,
    updated_at = now()
  where id = p_invoice_id;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'invoice_id', p_invoice_id,
    'paid', v_paid
  );
end;
$$;

create or replace function public.create_sale_return(
  p_invoice_id uuid,
  p_reason text,
  p_items jsonb,
  p_return_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_return_id uuid;
  v_item jsonb;
  v_stock public.stock_items;
  v_name text;
  v_qty integer;
  v_price numeric;
  v_sold integer;
  v_returned integer;
  v_total numeric := 0;
begin
  if p_return_id is not null
     and exists (
       select 1 from public.return_records
       where id = p_return_id and user_id = auth.uid()
     ) then
    return p_return_id;
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'سبب المرتجع مطلوب';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'اختر صنفًا واحدًا على الأقل';
  end if;

  v_return_id := coalesce(p_return_id, gen_random_uuid());

  insert into public.return_records(
    id,
    user_id,
    invoice_id,
    type,
    total_amount,
    reason
  )
  values (
    v_return_id,
    auth.uid(),
    p_invoice_id,
    'sale',
    0,
    trim(p_reason)
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name');
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unit_price')::numeric;

    if v_name = '' or v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then
      raise exception 'بيانات المرتجع غير صحيحة';
    end if;

    select coalesce(sum(quantity), 0)
    into v_sold
    from public.invoice_items
    where invoice_id = p_invoice_id
      and name = v_name;

    select coalesce(sum(ri.quantity), 0)
    into v_returned
    from public.return_items ri
    join public.return_records rr on rr.id = ri.return_id
    where rr.invoice_id = p_invoice_id
      and rr.type = 'sale'
      and ri.name = v_name;

    if v_qty > v_sold - v_returned then
      raise exception 'الكمية المرتجعة أكبر من الكمية المباعة: %', v_name;
    end if;

    select * into v_stock
    from public.stock_items
    where user_id = auth.uid()
      and name = v_name
    for update;

    if not found then
      raise exception 'صنف المخزون غير موجود: %', v_name;
    end if;

    insert into public.return_items(
      user_id,
      return_id,
      name,
      unit_price,
      quantity
    )
    values (
      auth.uid(),
      v_return_id,
      v_name,
      round(v_price, 2),
      v_qty
    );

    update public.stock_items
    set
      quantity = quantity + v_qty,
      updated_at = now()
    where id = v_stock.id;

    v_total := v_total + round(v_price, 2) * v_qty;
  end loop;

  update public.return_records
  set total_amount = round(v_total, 2)
  where id = v_return_id;

  update public.invoices i
  set
    total = greatest(0, i.total - round(v_total, 2)),
    paid = least(
      greatest(0, i.total - round(v_total, 2)),
      i.down_payment + coalesce(
        (select sum(p.amount) from public.payments p where p.invoice_id = i.id),
        0
      )
    ),
    status = case
      when i.down_payment + coalesce(
        (select sum(p.amount) from public.payments p where p.invoice_id = i.id),
        0
      ) >= greatest(0, i.total - round(v_total, 2)) then 'paid'
      else 'pending'
    end,
    updated_at = now()
  where i.id = p_invoice_id;

  return v_return_id;
end;
$$;

create or replace function public.create_sale_return_with_refund(
  p_invoice_id uuid,
  p_reason text,
  p_items jsonb,
  p_payment_method text default 'cash',
  p_account_id text default null,
  p_reference_number text default null,
  p_return_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_return_id uuid;
  v_paid numeric;
  v_new_total numeric;
  v_refund numeric;
begin
  if p_return_id is not null
     and exists (
       select 1 from public.return_records
       where id = p_return_id and user_id = auth.uid()
     ) then
    return p_return_id;
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'الفاتورة غير موجودة أو غير مسموح';
  end if;

  v_paid := v_invoice.paid;

  v_return_id := public.create_sale_return(
    p_invoice_id,
    p_reason,
    p_items,
    p_return_id
  );

  select total into v_new_total
  from public.invoices
  where id = p_invoice_id
    and user_id = auth.uid();

  v_refund := greatest(0, v_paid - v_new_total);

  if v_refund > 0 then
    insert into public.invoice_refunds(
      user_id,
      invoice_id,
      return_id,
      amount,
      payment_method,
      account_id,
      reference_number
    )
    values (
      auth.uid(),
      p_invoice_id,
      v_return_id,
      v_refund,
      coalesce(nullif(trim(p_payment_method), ''), 'cash'),
      p_account_id,
      nullif(trim(p_reference_number), '')
    );

    if coalesce(nullif(trim(p_payment_method), ''), 'cash') = 'cash' then
      insert into public.treasury_transactions(
        id,
        user_id,
        from_account_id,
        type,
        amount,
        category,
        description,
        reference_number,
        created_at
      )
      values (
        gen_random_uuid(),
        auth.uid(),
        coalesce(p_account_id, 'acc-cash-main'),
        'manual_out',
        v_refund,
        'مرتجع مبيعات',
        'رد مبلغ مرتجع فاتورة',
        'invoice-refund:' || v_return_id::text,
        now()
      );
    end if;
  end if;

  return v_return_id;
end;
$$;

revoke all on function public.create_sale_with_workflow_v3(
  uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,
  text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text,text
) from public, anon;
grant execute on function public.create_sale_with_workflow_v3(
  uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,
  text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text,text
) to authenticated;

revoke all on function public.record_invoice_payment(
  uuid,numeric,uuid,timestamptz,text,text,text
) from public, anon;
grant execute on function public.record_invoice_payment(
  uuid,numeric,uuid,timestamptz,text,text,text
) to authenticated;

revoke all on function public.create_sale_return(
  uuid,text,jsonb,uuid
) from public, anon;
grant execute on function public.create_sale_return(
  uuid,text,jsonb,uuid
) to authenticated;

revoke all on function public.create_sale_return_with_refund(
  uuid,text,jsonb,text,text,text,uuid
) from public, anon;
grant execute on function public.create_sale_return_with_refund(
  uuid,text,jsonb,text,text,text,uuid
) to authenticated;

create or replace function public.get_daily_sales_summary(
  p_from date,
  p_to date,
  p_customer_id uuid default null,
  p_type text default 'all'
) returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_from timestamptz := p_from::timestamptz;
  v_to timestamptz := (p_to + 1)::timestamptz;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  with sale_rows as (
    select i.*
    from public.invoices i
    left join public.customers c on c.id = i.customer_id
    where i.user_id = v_user
      and i.created_at >= v_from
      and i.created_at < v_to
      and not coalesce(i.deleted, false)
      and not coalesce(i.archived, false)
      and i.status <> 'cancelled'
      and (p_customer_id is null or i.customer_id = p_customer_id)
      and (
        p_type = 'all'
        or (p_type = 'cash' and coalesce(c.customer_type, 'installment') = 'cash')
        or (p_type = 'installment' and coalesce(c.customer_type, 'installment') <> 'cash')
      )
  ), payment_rows as (
    select p.*
    from public.payments p
    join public.invoices i on i.id = p.invoice_id
    where p.user_id = v_user
      and p.paid_at >= v_from
      and p.paid_at < v_to
      and (p_customer_id is null or i.customer_id = p_customer_id)
  ), return_rows as (
    select r.*
    from public.return_records r
    join public.invoices i on i.id = r.invoice_id
    where r.user_id = v_user
      and r.type = 'sale'
      and r.created_at >= v_from
      and r.created_at < v_to
      and (p_customer_id is null or i.customer_id = p_customer_id)
  )
  select jsonb_build_object(
    'invoice_count', (select count(*) from sale_rows),
    'sales_total', coalesce((select sum(total) from sale_rows), 0),
    'paid_total', coalesce((select sum(paid) from sale_rows), 0),
    'down_payments', coalesce((select sum(down_payment) from sale_rows), 0),
    'cash_sales_total', coalesce((select sum(total) from sale_rows where monthly_installment <= 0), 0),
    'installment_sales_total', coalesce((select sum(total) from sale_rows where monthly_installment > 0), 0),
    'payments_total', coalesce((select sum(amount) from payment_rows), 0),
    'returns_total', coalesce((select sum(total_amount) from return_rows), 0),
    'remaining_total', coalesce((select sum(greatest(0, total - paid)) from sale_rows), 0)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_daily_sales_summary(date,date,uuid,text) from public, anon;
grant execute on function public.get_daily_sales_summary(date,date,uuid,text) to authenticated;
