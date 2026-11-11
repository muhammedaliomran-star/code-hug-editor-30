-- Sales drafts: persistent drafts, temporary stock reservations and deposits.
create sequence if not exists public.sales_draft_number_seq;

alter table public.stock_items
  add column if not exists reserved_quantity integer not null default 0;

alter table public.stock_items
  drop constraint if exists stock_items_reserved_quantity_check;
alter table public.stock_items
  add constraint stock_items_reserved_quantity_check check (reserved_quantity >= 0);

create table if not exists public.sales_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_number bigint not null default nextval('public.sales_draft_number_seq'),
  customer_id uuid references public.customers(id) on delete set null,
  total numeric not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft','held','cancelled','expired','converted')),
  deposit_total numeric not null default 0,
  expires_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, draft_number)
);

alter table public.sales_drafts
  add column if not exists discount_pct numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists tax_pct numeric not null default 0,
  add column if not exists tax_amount numeric not null default 0;

create table if not exists public.sales_draft_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null references public.sales_drafts(id) on delete cascade,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  name text not null,
  cost numeric not null default 0,
  price numeric not null default 0,
  discount_pct numeric not null default 0,
  tax_pct numeric not null default 0,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_draft_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null references public.sales_drafts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash',
  account_id text,
  reference_number text,
  status text not null default 'held' check (status in ('held','applied','refunded','forfeited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_drafts enable row level security;
alter table public.sales_draft_items enable row level security;
alter table public.sales_draft_deposits enable row level security;

drop policy if exists sales_drafts_owner on public.sales_drafts;
create policy sales_drafts_owner on public.sales_drafts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sales_draft_items_owner on public.sales_draft_items;
create policy sales_draft_items_owner on public.sales_draft_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sales_draft_deposits_owner on public.sales_draft_deposits;
create policy sales_draft_deposits_owner on public.sales_draft_deposits for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.sales_drafts, public.sales_draft_items, public.sales_draft_deposits to authenticated;
grant all on public.sales_drafts, public.sales_draft_items, public.sales_draft_deposits to service_role;

create or replace function public.create_sales_draft(
  p_draft_id uuid,
  p_customer_id uuid default null,
  p_total numeric default 0,
  p_discount_pct numeric default 0,
  p_discount_amount numeric default 0,
  p_tax_pct numeric default 0,
  p_tax_amount numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_deposit numeric default 0,
  p_deposit_method text default 'cash',
  p_deposit_account_id text default null,
  p_deposit_reference text default null,
  p_expires_at timestamptz default (now() + interval '48 hours')
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_stock public.stock_items;
  v_stock_id uuid;
  v_qty integer;
  v_draft_number bigint;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_draft_id is null then raise exception 'معرّف المسودة مطلوب'; end if;
  if exists (select 1 from public.sales_drafts where id = p_draft_id and user_id = v_user) then
    return jsonb_build_object('id', p_draft_id, 'draft_number', (select draft_number from public.sales_drafts where id = p_draft_id));
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'يجب إضافة صنف واحد على الأقل للمسودة';
  end if;
  if coalesce(p_deposit, 0) < 0 or coalesce(p_deposit, 0) > coalesce(p_total, 0) then
    raise exception 'قيمة العربون غير صحيحة';
  end if;

  insert into public.sales_drafts(user_id, id, customer_id, total, discount_pct, discount_amount, tax_pct, tax_amount, notes, deposit_total, expires_at)
  values (v_user, p_draft_id, p_customer_id, coalesce(p_total, 0), coalesce(p_discount_pct, 0), coalesce(p_discount_amount, 0), coalesce(p_tax_pct, 0), coalesce(p_tax_amount, 0), p_notes, coalesce(p_deposit, 0), p_expires_at)
  returning draft_number into v_draft_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_stock_id := nullif(v_item->>'stock_item_id', '')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'كمية غير صحيحة في المسودة'; end if;
    if v_stock_id is not null then
      select * into v_stock from public.stock_items where id = v_stock_id and user_id = v_user for update;
      if not found then raise exception 'صنف المخزون غير موجود'; end if;
      if v_stock.quantity - v_stock.reserved_quantity < v_qty then
        raise exception 'الكمية المتاحة للحجز من «%» هي % فقط', v_stock.name, greatest(0, v_stock.quantity - v_stock.reserved_quantity);
      end if;
      update public.stock_items set reserved_quantity = reserved_quantity + v_qty, updated_at = now() where id = v_stock_id;
    end if;
    insert into public.sales_draft_items(user_id, draft_id, stock_item_id, name, cost, price, discount_pct, tax_pct, quantity)
    values (v_user, p_draft_id, v_stock_id, trim(v_item->>'name'), coalesce((v_item->>'cost')::numeric, 0), coalesce((v_item->>'price')::numeric, 0), least(100, greatest(0, coalesce((v_item->>'discount_pct')::numeric, 0))), greatest(0, coalesce((v_item->>'tax_pct')::numeric, 0)), v_qty);
  end loop;

  if coalesce(p_deposit, 0) > 0 then
    insert into public.sales_draft_deposits(user_id, draft_id, amount, payment_method, account_id, reference_number)
    values (v_user, p_draft_id, p_deposit, coalesce(nullif(trim(p_deposit_method), ''), 'cash'), p_deposit_account_id, nullif(trim(p_deposit_reference), ''));
    insert into public.treasury_transactions(user_id, to_account_id, type, amount, category, description, reference_number)
    values (v_user, coalesce(nullif(p_deposit_account_id, ''), 'acc-cash-main'), 'manual_in', p_deposit, 'عربون حجز', 'عربون مسودة بيع D-' || lpad(v_draft_number::text, 4, '0'), 'sales-draft-deposit:' || p_draft_id::text);
  end if;
  return jsonb_build_object('id', p_draft_id, 'draft_number', v_draft_number);
end;
$$;

create or replace function public.cancel_sales_draft(p_draft_id uuid, p_refund boolean default true)
returns void language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_item record; v_deposit record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.sales_drafts where id = p_draft_id and user_id = v_user and status in ('draft','held')) then raise exception 'المسودة غير قابلة للإلغاء'; end if;
  for v_item in select * from public.sales_draft_items where draft_id = p_draft_id and user_id = v_user loop
    if v_item.stock_item_id is not null then
      update public.stock_items set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity), updated_at = now() where id = v_item.stock_item_id and user_id = v_user;
    end if;
  end loop;
  for v_deposit in select * from public.sales_draft_deposits where draft_id = p_draft_id and user_id = v_user and status = 'held' loop
    if p_refund then
      update public.sales_draft_deposits set status = 'refunded', updated_at = now() where id = v_deposit.id;
      insert into public.treasury_transactions(user_id, from_account_id, type, amount, category, description, reference_number)
      values (v_user, coalesce(nullif(v_deposit.account_id, ''), 'acc-cash-main'), 'manual_out', v_deposit.amount, 'رد عربون', 'رد عربون مسودة بيع', 'sales-draft-refund:' || v_deposit.id::text);
    else
      update public.sales_draft_deposits set status = 'forfeited', updated_at = now() where id = v_deposit.id;
    end if;
  end loop;
  update public.sales_drafts set status = 'cancelled', updated_at = now() where id = p_draft_id and user_id = v_user;
end;
$$;

revoke all on function public.create_sales_draft(uuid,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,numeric,text,text,text,timestamptz) from public, anon;
grant execute on function public.create_sales_draft(uuid,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,numeric,text,text,text,timestamptz) to authenticated;
revoke all on function public.cancel_sales_draft(uuid,boolean) from public, anon;
grant execute on function public.cancel_sales_draft(uuid,boolean) to authenticated;

-- Release reservations for drafts that passed their expiry time. This is safe to
-- call repeatedly and keeps expired drafts visible in the history.
create or replace function public.expire_sales_drafts()
returns integer language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_draft record; v_item record; v_count integer := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  for v_draft in
    select * from public.sales_drafts
    where user_id = v_user and status in ('draft','held') and expires_at is not null and expires_at <= now()
    for update
  loop
    for v_item in select * from public.sales_draft_items where draft_id = v_draft.id and user_id = v_user loop
      if v_item.stock_item_id is not null then
        update public.stock_items
           set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity), updated_at = now()
         where id = v_item.stock_item_id and user_id = v_user;
      end if;
    end loop;
    for v_item in select * from public.sales_draft_deposits where draft_id = v_draft.id and user_id = v_user and status = 'held' loop
      update public.sales_draft_deposits set status = 'forfeited', updated_at = now() where id = v_item.id;
    end loop;
    update public.sales_drafts set status = 'expired', updated_at = now() where id = v_draft.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Convert a draft atomically. The reservation is released immediately before
-- the normal sale workflow deducts real stock; a failure rolls the whole
-- transaction back, including the reservation and the deposit state.
create or replace function public.convert_sales_draft(
  p_draft_id uuid,
  p_invoice_id uuid,
  p_down_payment numeric default 0,
  p_monthly_installment numeric default 0,
  p_first_due_date date default current_date,
  p_notes text default null,
  p_discount_pct numeric default 0,
  p_discount_amount numeric default 0,
  p_tax_pct numeric default 0,
  p_tax_amount numeric default 0,
  p_status text default 'pending',
  p_paid numeric default 0,
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
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid(); v_draft public.sales_drafts; v_item record;
  v_items jsonb; v_total numeric; v_deposit numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_draft from public.sales_drafts where id = p_draft_id and user_id = v_user for update;
  if not found then raise exception 'المسودة غير موجودة'; end if;
  if v_draft.status = 'converted' then return v_draft.invoice_id; end if;
  if v_draft.status not in ('draft','held') then raise exception 'المسودة غير قابلة للتحويل'; end if;
  if v_draft.expires_at is not null and v_draft.expires_at <= now() then raise exception 'انتهت صلاحية المسودة'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', name, 'cost', cost, 'price', price, 'quantity', quantity,
    'stock_item_id', stock_item_id, 'discount_pct', discount_pct, 'tax_pct', tax_pct,
    'serial_numbers', '[]'::jsonb
  )), '[]'::jsonb), coalesce(sum((quantity * price) * (1 - discount_pct / 100) * (1 + tax_pct / 100)), 0)
    into v_items, v_total
    from public.sales_draft_items where draft_id = p_draft_id and user_id = v_user;
  if jsonb_array_length(v_items) = 0 then raise exception 'المسودة لا تحتوي على أصناف'; end if;
  v_total := v_total * (1 - greatest(0, least(100, coalesce(p_discount_pct, 0))) / 100);
  v_total := v_total * (1 + greatest(0, coalesce(p_tax_pct, 0)) / 100);
  if abs(round(v_total, 2) - round(v_draft.total, 2)) > 0.01 then raise exception 'إجمالي المسودة غير صحيح'; end if;

  select coalesce(sum(amount), 0) into v_deposit
    from public.sales_draft_deposits where draft_id = p_draft_id and user_id = v_user and status = 'held';
  if coalesce(p_down_payment, 0) < v_deposit or coalesce(p_paid, 0) < v_deposit then
    raise exception 'يجب احتساب العربون ضمن المبلغ المدفوع';
  end if;

  -- Keep the row locks while the sale workflow deducts actual stock.
  for v_item in select * from public.sales_draft_items where draft_id = p_draft_id and user_id = v_user loop
    if v_item.stock_item_id is not null then
      update public.stock_items set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity), updated_at = now()
       where id = v_item.stock_item_id and user_id = v_user;
    end if;
  end loop;

  perform public.create_sale_with_workflow_v3(
    v_draft.customer_id, v_draft.total, p_down_payment, p_monthly_installment,
    p_first_due_date, coalesce(p_notes, v_draft.notes), p_discount_pct, p_discount_amount, p_tax_pct, p_tax_amount, p_status,
    p_paid, v_items, p_invoice_id, p_down_payment_method, p_down_payment_account_id,
    p_down_payment_reference, p_split_cash_amount, p_split_electronic_amount,
    p_split_electronic_method, p_shipment, p_branch_id, p_cashier_id, p_source,
    p_external_order_number
  );
  update public.sales_draft_deposits set status = 'applied', updated_at = now()
    where draft_id = p_draft_id and user_id = v_user and status = 'held';
  update public.sales_drafts set status = 'converted', invoice_id = p_invoice_id, updated_at = now()
    where id = p_draft_id and user_id = v_user;
  return p_invoice_id;
end;
$$;

revoke all on function public.expire_sales_drafts() from public, anon;
grant execute on function public.expire_sales_drafts() to authenticated;
revoke all on function public.convert_sales_draft(uuid,uuid,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text,text) from public, anon;
grant execute on function public.convert_sales_draft(uuid,uuid,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text,text) to authenticated;
