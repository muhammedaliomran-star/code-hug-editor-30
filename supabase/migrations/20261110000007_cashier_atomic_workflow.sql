-- Cashier workflow hardening:
-- central invoice numbering, idempotent sale creation, payment metadata,
-- server-side total validation, and atomic shipment creation.

alter table public.invoices
  add column if not exists down_payment_method text not null default 'cash',
  add column if not exists down_payment_account_id text,
  add column if not exists down_payment_reference text,
  add column if not exists split_cash_amount numeric not null default 0,
  add column if not exists split_electronic_amount numeric not null default 0,
  add column if not exists split_electronic_method text;

alter table public.payments
  add column if not exists payment_method text not null default 'cash',
  add column if not exists account_id text,
  add column if not exists reference_number text;

create table if not exists public.invoice_number_sequences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_number bigint not null default 1,
  created_at timestamptz not null default now()
);

alter table public.invoice_number_sequences enable row level security;
drop policy if exists invoice_number_sequences_owner on public.invoice_number_sequences;
create policy invoice_number_sequences_owner on public.invoice_number_sequences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.reserve_invoice_number()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_number bigint;
        v_floor bigint;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select coalesce(max(nullif(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::bigint) + 1, 1)
    into v_floor
    from public.invoices where user_id = auth.uid();
  insert into public.invoice_number_sequences(user_id, next_number)
    values (auth.uid(), v_floor + 1)
    on conflict (user_id) do update set next_number = greatest(public.invoice_number_sequences.next_number, v_floor + 1) + 1
    returning next_number - 1 into v_number;
  return v_number;
end;
$$;

revoke all on function public.reserve_invoice_number() from public;
grant execute on function public.reserve_invoice_number() to authenticated;

with numbered as (
  select id, '#' || lpad(row_number() over (partition by user_id order by created_at, id)::text, 4, '0') as number
  from public.invoices where invoice_number is null
)
update public.invoices i set invoice_number = n.number
from numbered n where i.id = n.id;

create unique index if not exists invoices_user_invoice_number_unique
  on public.invoices(user_id, invoice_number)
  where invoice_number is not null;

-- The application uses this wrapper. The legacy create_sale remains available
-- only through this function so the old atomic stock implementation is reused.
create or replace function public.create_sale_with_workflow(
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
  p_shipment jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_customer record;
  v_item jsonb;
  v_expected numeric := 0;
  v_price numeric;
  v_qty numeric;
  v_discount numeric;
  v_tax numeric;
  v_down numeric := coalesce(p_down_payment, 0);
  v_paid numeric := coalesce(p_paid, p_down_payment, 0);
  v_number bigint;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_invoice_id is null then raise exception 'معرّف الفاتورة مطلوب'; end if;

  -- Safe retry: the same client-generated id returns the original invoice.
  if exists (select 1 from public.invoices where id = p_invoice_id and user_id = v_user) then
    return p_invoice_id;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'يجب إضافة صنف واحد على الأقل';
  end if;
  if p_total is null or p_total < 0 or v_down < 0 or v_paid < 0 or v_down > p_total or v_paid > p_total then
    raise exception 'قيم إجمالي أو دفع غير صحيحة';
  end if;

  select * into v_customer from public.customers where id = p_customer_id and user_id = v_user;
  if not found then raise exception 'العميل غير موجود'; end if;
  if v_customer.frozen or v_customer.status = 'defaulter' then
    raise exception 'لا يمكن إنشاء فاتورة لهذا العميل حاليًا';
  end if;
  if v_customer.customer_type = 'cash' and v_paid < p_total then
    raise exception 'العميل الفوري يجب تحصيل كامل قيمة الفاتورة';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if nullif(trim(v_item->>'name'), '') is null then raise exception 'اسم الصنف مطلوب'; end if;
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_price := coalesce((v_item->>'price')::numeric, 0);
    if v_qty <= 0 or v_qty <> floor(v_qty) or v_price < 0 then
      raise exception 'كمية أو سعر غير صحيح للصنف %', v_item->>'name';
    end if;
    v_discount := least(100, greatest(0, coalesce((v_item->>'discount_pct')::numeric, 0)));
    v_tax := greatest(0, coalesce((v_item->>'tax_pct')::numeric, 0));
    v_expected := v_expected + (v_price * v_qty) * (1 - v_discount / 100) * (1 + v_tax / 100);
  end loop;
  if abs(round(v_expected, 2) - round(p_total, 2)) > 0.01 then
    raise exception 'إجمالي الفاتورة لا يساوي مجموع الأصناف';
  end if;
  if abs(coalesce(p_split_cash_amount, 0) + coalesce(p_split_electronic_amount, 0) - v_down) > 0.01 then
    raise exception 'تفاصيل الدفع لا تساوي المبلغ المحصل';
  end if;

  v_number := public.reserve_invoice_number();
  perform public.create_sale(
    p_customer_id, p_total, p_down_payment, p_monthly_installment,
    p_first_due_date, p_notes, p_discount_pct, p_discount_amount,
    p_tax_pct, p_tax_amount, p_status, p_paid, p_items, p_invoice_id
  );

  update public.invoices set
    invoice_number = '#' || lpad(v_number::text, 4, '0'),
    down_payment_method = coalesce(nullif(trim(p_down_payment_method), ''), 'cash'),
    down_payment_account_id = p_down_payment_account_id,
    down_payment_reference = nullif(trim(p_down_payment_reference), ''),
    split_cash_amount = coalesce(p_split_cash_amount, 0),
    split_electronic_amount = coalesce(p_split_electronic_amount, 0),
    split_electronic_method = nullif(trim(p_split_electronic_method), '')
  where id = p_invoice_id and user_id = v_user;

  if p_shipment is not null and jsonb_typeof(p_shipment) = 'object' then
    insert into public.shipments(
      user_id, invoice_id, carrier_id, zone_id, tracking_number, status,
      recipient_name, recipient_phone, delivery_address
    ) values (
      v_user, p_invoice_id,
      nullif(p_shipment->>'carrier_id', '')::uuid,
      nullif(p_shipment->>'zone_id', '')::uuid,
      nullif(p_shipment->>'tracking_number', ''), 'pending',
      nullif(p_shipment->>'recipient_name', ''),
      nullif(p_shipment->>'recipient_phone', ''),
      nullif(p_shipment->>'delivery_address', '')
    );
  end if;
  return p_invoice_id;
end;
$$;

revoke all on function public.create_sale_with_workflow(uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb) from public, anon;
grant execute on function public.create_sale_with_workflow(uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb) to authenticated;
