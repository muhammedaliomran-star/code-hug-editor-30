-- =====================================================================
-- Rebuild of BASE tables missing from supabase/migrations/*.sql
-- Segilly POS — reconstructed from TypeScript usage (src/lib/store.ts,
-- src/lib/roles.ts, src/lib/team.functions.ts, src/lib/public-receipt.functions.ts,
-- src/lib/inventory-service.ts, Settings/Warehouse pages).
--
-- Does NOT touch auth/storage schemas. No CREATE EXTENSION. No DROP.
-- Existing repo migrations already create: shipments/carriers/zones,
-- branches, payment_vouchers, return_records/return_items,
-- storefront*, store_orders*, carrier_settlements, shipment_notifications,
-- audit_events, installment_schedule, stock_movements, and various
-- RPC functions that reference the base tables below — those are SKIPPED.
-- =====================================================================

-- Idempotency: this file may re-run on databases where it was already
-- applied manually. Drop every policy/trigger it manages, then recreate.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Users can view own roles', 'user_roles'),
      ('Users manage own profile', 'profiles'),
      ('Owners manage team invites', 'team_invites'),
      ('Invited-by user can view own invites', 'team_invites'),
      ('Users manage own customers', 'customers'),
      ('Users manage own invoices', 'invoices'),
      ('Users manage own invoice items', 'invoice_items'),
      ('Users manage own payments', 'payments'),
      ('Users manage own expenses', 'expenses'),
      ('Users manage own suppliers', 'suppliers'),
      ('Users manage own purchases', 'purchases'),
      ('Users manage own purchase items', 'purchase_items'),
      ('Users manage own supplier payments', 'supplier_payments'),
      ('Users manage own stock items', 'stock_items'),
      ('Users manage own stock adjustments', 'stock_adjustments'),
      ('Users manage own warehouse items', 'warehouse_items'),
      ('Users manage own shop settings', 'shop_settings'),
      ('Public can read shop settings for receipts', 'shop_settings')
    ) as v(pol, tbl)
  loop
    execute format('drop policy if exists %I on public.%I', r.pol, r.tbl);
  end loop;
  for r in
    select * from (values
      ('set_updated_at', 'profiles'),
      ('set_updated_at', 'stock_items'),
      ('set_updated_at', 'warehouse_items'),
      ('set_updated_at', 'shop_settings')
    ) as v(trg, tbl)
  loop
    execute format('drop trigger if exists %I on public.%I', r.trg, r.tbl);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Shared trigger function for updated_at columns
-- ---------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- app_role enum + user_roles + has_role()
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('owner', 'manager', 'seller');
  end if;
end
$$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
-- NOTE (security review Phase 0): the former "Users manage own roles" FOR ALL
-- policy was REMOVED — it let any user grant themselves 'owner'. First-owner
-- bootstrap lives in 20260922040000_security_phase0_critical.sql.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------------
-- profiles  (src/lib/store.ts useProfile/save — id = auth.uid())
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,
  display_name text not null default '',
  avatar_url text,
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users manage own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- team_invites  (src/lib/roles.ts, src/lib/team.functions.ts)
-- ---------------------------------------------------------------------
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  invited_by uuid not null,
  email text not null,
  role public.app_role not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.team_invites to authenticated;
grant all on public.team_invites to service_role;

alter table public.team_invites enable row level security;

create policy "Owners manage team invites" on public.team_invites
  for all to authenticated
  using (public.has_role(auth.uid(), 'owner'))
  with check (public.has_role(auth.uid(), 'owner'));
create policy "Invited-by user can view own invites" on public.team_invites
  for select to authenticated using (auth.uid() = invited_by);

-- ---------------------------------------------------------------------
-- customers  (src/lib/store.ts Customer interface + queries)
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  phone text not null default '',
  rating integer not null default 0,
  status text not null default 'neutral' check (status in ('committed', 'neutral', 'defaulter')),
  customer_type text not null default 'installment' check (customer_type in ('installment', 'cash')),
  notes text,
  frozen boolean not null default false,
  address text,
  joining_date date not null default current_date,
  credit_limit numeric(12,2) not null default 0,
  due_day integer not null default 1,
  opening_balance numeric(12,2) not null default 0,
  national_id text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;

alter table public.customers enable row level security;

create policy "Users manage own customers" on public.customers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- invoices  (src/lib/store.ts Invoice interface + queries;
-- receipt_token/invoice_number added later via ALTER in existing migrations
-- but we still declare defaults here in case those migrations run first/after)
-- ---------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  total numeric(12,2) not null default 0,
  down_payment numeric(12,2) not null default 0,
  monthly_installment numeric(12,2) not null default 0,
  first_due_date date,
  paid numeric(12,2) not null default 0,
  notes text,
  discount_pct numeric(6,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_pct numeric(6,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('paid', 'pending', 'cancelled')),
  invoice_number text,
  date timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
-- public receipt page (src/lib/public-receipt.functions.ts) reads via receipt_token
-- through supabaseAdmin (service_role), so anon grant is not strictly required,
-- but harmless read-only exposure is avoided; skip anon grant here.

alter table public.invoices enable row level security;

create policy "Users manage own invoices" on public.invoices
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- invoice_items  (src/lib/store.ts InvoiceItem interface + invoiceItemFinancials)
-- ---------------------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  name text not null,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  quantity integer not null default 1,
  discount_pct numeric(6,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_pct numeric(6,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  serial_numbers text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.invoice_items to authenticated;
grant all on public.invoice_items to service_role;

alter table public.invoice_items enable row level security;

create policy "Users manage own invoice items" on public.invoice_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- payments  (src/lib/store.ts Payment interface + recomputeInvoicePaid + record_invoice_payment RPC)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  paid_at timestamptz not null default now()
);

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;

alter table public.payments enable row level security;

create policy "Users manage own payments" on public.payments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- expenses  (src/lib/store.ts Expense interface)
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(12,2) not null default 0,
  category text not null default 'other',
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

alter table public.expenses enable row level security;

create policy "Users manage own expenses" on public.expenses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- suppliers  (src/lib/store.ts Supplier interface)
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  contact text not null default '',
  notes text,
  opening_balance numeric(12,2) not null default 0,
  national_id text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;

alter table public.suppliers enable row level security;

create policy "Users manage own suppliers" on public.suppliers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- purchases  (src/lib/store.ts Purchase interface; inserted via
-- record_purchase_with_inventory() RPC defined in
-- 20260827140000_atomic_purchase_inventory.sql, which proves the exact columns)
-- ---------------------------------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  total numeric(12,2) not null default 0,
  payment_type text not null default 'cash' check (payment_type in ('cash', 'credit')),
  purchase_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.purchases to authenticated;
grant all on public.purchases to service_role;

alter table public.purchases enable row level security;

create policy "Users manage own purchases" on public.purchases
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- purchase_items  (src/lib/store.ts PurchaseItem interface;
-- confirmed by record_purchase_with_inventory RPC)
-- ---------------------------------------------------------------------
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  name text not null,
  unit_cost numeric(12,2) not null default 0,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.purchase_items to authenticated;
grant all on public.purchase_items to service_role;

alter table public.purchase_items enable row level security;

create policy "Users manage own purchase items" on public.purchase_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- supplier_payments  (src/lib/store.ts SupplierPayment interface)
-- ---------------------------------------------------------------------
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  paid_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_payments to authenticated;
grant all on public.supplier_payments to service_role;

alter table public.supplier_payments enable row level security;

create policy "Users manage own supplier payments" on public.supplier_payments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- stock_items  (src/lib/store.ts StockItem interface + addStockItem/updateStockItem;
-- referenced by FK from storefront_products, purchase_items(stock_item_id), etc.)
-- ---------------------------------------------------------------------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  quantity numeric(12,2) not null default 0,
  last_unit_cost numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  barcode text,
  size text,
  item_type text,
  min_stock numeric(12,2) not null default 0,
  low_stock_alert numeric(12,2),
  season text,
  category text,
  notes text,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.stock_items to authenticated;
grant all on public.stock_items to service_role;

alter table public.stock_items enable row level security;

create policy "Users manage own stock items" on public.stock_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.stock_items
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- stock_adjustments  (src/lib/store.ts adjustStock/updateStockItem;
-- confirmed by log_stock_adjustment_movement trigger in
-- 20260827140000_atomic_purchase_inventory.sql)
-- ---------------------------------------------------------------------
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  delta numeric(12,2) not null,
  reason text not null,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.stock_adjustments to authenticated;
grant all on public.stock_adjustments to service_role;

alter table public.stock_adjustments enable row level security;

create policy "Users manage own stock adjustments" on public.stock_adjustments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- warehouse_items  (src/lib/store.ts WarehouseItem interface + Warehouse page)
-- ---------------------------------------------------------------------
create table if not exists public.warehouse_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  quantity numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  season text not null default 'all' check (season in ('summer', 'winter', 'all')),
  category text not null default 'other',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.warehouse_items to authenticated;
grant all on public.warehouse_items to service_role;

alter table public.warehouse_items enable row level security;

create policy "Users manage own warehouse items" on public.warehouse_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.warehouse_items
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- shop_settings  (src/lib/store.ts ShopSettings interface + fetchShopSettings/saveShopSettings;
-- read publicly for the printable receipt page via supabaseAdmin, so anon grant added
-- for completeness though the app currently uses service_role for that path)
-- ---------------------------------------------------------------------
create table if not exists public.shop_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  shop_name text not null default '',
  phone text not null default '',
  address text not null default '',
  logo_url text,
  footer_note text not null default '',
  currency text not null default 'ج.م',
  tax_number text not null default '',
  whatsapp text not null default '',
  low_stock_threshold integer not null default 5,
  default_installment_months integer not null default 6,
  default_due_day integer not null default 1,
  invoice_prefix text not null default '',
  print_paper text not null default 'a4' check (print_paper in ('a4', 'thermal')),
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  reminder_days_before integer not null default 3,
  alerts_enabled boolean not null default true,
  color_palette text not null default 'emerald',
  numerals_format text not null default 'latn' check (numerals_format in ('latn', 'arab')),
  auto_backup_frequency text not null default 'weekly' check (auto_backup_frequency in ('weekly', 'monthly', 'off')),
  commercial_register text not null default '',
  email text not null default '',
  website text not null default '',
  enable_vat boolean not null default false,
  default_vat_rate numeric(6,2) not null default 14,
  warranty_policy text not null default '',
  auto_print_on_save boolean not null default true,
  thermal_show_barcode boolean not null default true,
  thermal_show_header boolean not null default true,
  custom_expense_categories text[] not null default array['rent','electricity','salaries','transport','other'],
  whatsapp_reminder_template text not null default '',
  whatsapp_payment_thank_you_template text not null default '',
  critical_overdue_days integer not null default 15,
  audio_alerts_enabled boolean not null default true,
  manager_pin text,
  max_discount_without_pin numeric(6,2),
  hide_cost_and_profits_from_cashier boolean not null default false,
  prevent_invoice_deletion_without_pin boolean not null default false,
  prevent_viewing_total_analytics_without_pin boolean not null default false,
  thermal_paper_width text default '80mm',
  open_cash_drawer_on_print boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.shop_settings to authenticated;
grant all on public.shop_settings to service_role;
grant select on public.shop_settings to anon;

alter table public.shop_settings enable row level security;

create policy "Users manage own shop settings" on public.shop_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public can read shop settings for receipts" on public.shop_settings
  for select to anon using (true);

create trigger set_updated_at before update on public.shop_settings
  for each row execute function public.update_updated_at_column();
