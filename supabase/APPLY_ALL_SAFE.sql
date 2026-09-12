-- =============================================================
-- APPLY_ALL_SAFE.sql - النسخة الآمنة
-- شغّل ده في Supabase Dashboard > SQL Editor
-- التاريخ: 2026-09-12 22:28
-- الملاحظات:afil的部分 متطبقش هيتطبق، اللي موجود مش هيتأثر
-- =============================================================

-- =============================================================
-- SECTION 0: REBUILD BASE TABLES
-- =============================================================

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

create table IF NOT EXISTS  public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own roles" ON public.user_roles;
create policy "Users manage own roles" on public.user_roles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------------
-- profiles  (src/lib/store.ts useProfile/save — id = auth.uid())
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.profiles (
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

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
create policy "Users manage own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- team_invites  (src/lib/roles.ts, src/lib/team.functions.ts)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.team_invites (
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

DROP POLICY IF EXISTS "Owners manage team invites" ON public.team_invites;
create policy "Owners manage team invites" on public.team_invites
  for all to authenticated
  using (public.has_role(auth.uid(), 'owner'))
  with check (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Invited-by user can view own invites" ON public.team_invites;
create policy "Invited-by user can view own invites" on public.team_invites
  for select to authenticated using (auth.uid() = invited_by);

-- ---------------------------------------------------------------------
-- customers  (src/lib/store.ts Customer interface + queries)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.customers (
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

DROP POLICY IF EXISTS "Users manage own customers" ON public.customers;
create policy "Users manage own customers" on public.customers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- invoices  (src/lib/store.ts Invoice interface + queries;
-- receipt_token/invoice_number added later via ALTER in existing migrations
-- but we still declare defaults here in case those migrations run first/after)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.invoices (
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

DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
create policy "Users manage own invoices" on public.invoices
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- invoice_items  (src/lib/store.ts InvoiceItem interface + invoiceItemFinancials)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.invoice_items (
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

DROP POLICY IF EXISTS "Users manage own invoice items" ON public.invoice_items;
create policy "Users manage own invoice items" on public.invoice_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- payments  (src/lib/store.ts Payment interface + recomputeInvoicePaid + record_invoice_payment RPC)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  paid_at timestamptz not null default now()
);

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;

alter table public.payments enable row level security;

DROP POLICY IF EXISTS "Users manage own payments" ON public.payments;
create policy "Users manage own payments" on public.payments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- expenses  (src/lib/store.ts Expense interface)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.expenses (
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

DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
create policy "Users manage own expenses" on public.expenses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- suppliers  (src/lib/store.ts Supplier interface)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.suppliers (
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

DROP POLICY IF EXISTS "Users manage own suppliers" ON public.suppliers;
create policy "Users manage own suppliers" on public.suppliers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- purchases  (src/lib/store.ts Purchase interface; inserted via
-- record_purchase_with_inventory() RPC defined in
-- 20260827140000_atomic_purchase_inventory.sql, which proves the exact columns)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.purchases (
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

DROP POLICY IF EXISTS "Users manage own purchases" ON public.purchases;
create policy "Users manage own purchases" on public.purchases
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- purchase_items  (src/lib/store.ts PurchaseItem interface;
-- confirmed by record_purchase_with_inventory RPC)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.purchase_items (
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

DROP POLICY IF EXISTS "Users manage own purchase items" ON public.purchase_items;
create policy "Users manage own purchase items" on public.purchase_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- supplier_payments  (src/lib/store.ts SupplierPayment interface)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  paid_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_payments to authenticated;
grant all on public.supplier_payments to service_role;

alter table public.supplier_payments enable row level security;

DROP POLICY IF EXISTS "Users manage own supplier payments" ON public.supplier_payments;
create policy "Users manage own supplier payments" on public.supplier_payments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- stock_items  (src/lib/store.ts StockItem interface + addStockItem/updateStockItem;
-- referenced by FK from storefront_products, purchase_items(stock_item_id), etc.)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.stock_items (
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

DROP POLICY IF EXISTS "Users manage own stock items" ON public.stock_items;
create policy "Users manage own stock items" on public.stock_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.stock_items;
create trigger set_updated_at before update on public.stock_items
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- stock_adjustments  (src/lib/store.ts adjustStock/updateStockItem;
-- confirmed by log_stock_adjustment_movement trigger in
-- 20260827140000_atomic_purchase_inventory.sql)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.stock_adjustments (
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

DROP POLICY IF EXISTS "Users manage own stock adjustments" ON public.stock_adjustments;
create policy "Users manage own stock adjustments" on public.stock_adjustments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- warehouse_items  (src/lib/store.ts WarehouseItem interface + Warehouse page)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.warehouse_items (
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

DROP POLICY IF EXISTS "Users manage own warehouse items" ON public.warehouse_items;
create policy "Users manage own warehouse items" on public.warehouse_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.warehouse_items;
create trigger set_updated_at before update on public.warehouse_items
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- shop_settings  (src/lib/store.ts ShopSettings interface + fetchShopSettings/saveShopSettings;
-- read publicly for the printable receipt page via supabaseAdmin, so anon grant added
-- for completeness though the app currently uses service_role for that path)
-- ---------------------------------------------------------------------
create table IF NOT EXISTS  public.shop_settings (
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

DROP POLICY IF EXISTS "Users manage own shop settings" ON public.shop_settings;
create policy "Users manage own shop settings" on public.shop_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public can read shop settings for receipts" ON public.shop_settings;
create policy "Public can read shop settings for receipts" on public.shop_settings
  for select to anon using (true);

DROP TRIGGER IF EXISTS set_updated_at ON public.shop_settings;
create trigger set_updated_at before update on public.shop_settings
  for each row execute function public.update_updated_at_column();


-- =============================================================
-- MIGRATION 1/48: 20260814203532_fc56da66-2189-46ff-8ca6-62368675a2eb.sql
-- =============================================================

-- Create return_records table
CREATE TABLE IF NOT EXISTS  public.return_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'supplier')),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create return_items table
CREATE TABLE IF NOT EXISTS  public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    return_id UUID NOT NULL REFERENCES public.return_records(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_records TO authenticated;
GRANT ALL ON public.return_records TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;

-- Enable RLS
ALTER TABLE public.return_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

-- Policies for return_records
CREATE POLICY "Users can manage their own return records"
ON public.return_records
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for return_items
CREATE POLICY "Users can manage their own return items"
ON public.return_items
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);



-- =============================================================
-- MIGRATION 2/48: 20260816000000_add_branches_and_payments.sql
-- =============================================================

-- Branches table
CREATE TABLE IF NOT EXISTS  public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    manager_name TEXT,
    is_main BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own branches" 
ON public.branches FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Payment Vouchers table
CREATE TABLE IF NOT EXISTS  public.payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('receipt', 'payment')),
    payment_method TEXT NOT NULL,
    description TEXT,
    voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_vouchers TO authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;

ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own payment vouchers" 
ON public.payment_vouchers FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);



-- =============================================================
-- MIGRATION 3/48: 20260816004057_fdb43e56-c139-4768-bdd4-fe3e0fa226af.sql
-- =============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('paid','pending','cancelled'));


-- =============================================================
-- MIGRATION 4/48: 20260820000000_shipping_system.sql
-- =============================================================

-- Shipping Carriers table
CREATE TABLE IF NOT EXISTS  public.shipping_carriers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    base_cost decimal(12,2) DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Shipping Zones table
CREATE TABLE IF NOT EXISTS  public.shipping_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL, -- e.g., "القاهرة", "الإسكندرية"
    carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
    delivery_cost decimal(12,2) DEFAULT 0,
    estimated_days integer DEFAULT 2,
    created_at timestamptz DEFAULT now()
);

-- Shipments table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
        CREATE TYPE public.shipment_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS  public.shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
    carrier_id uuid REFERENCES public.shipping_carriers(id),
    zone_id uuid REFERENCES public.shipping_zones(id),
    tracking_number text UNIQUE,
    status public.shipment_status DEFAULT 'pending',
    recipient_name text,
    recipient_phone text,
    delivery_address text,
    actual_delivery_date timestamptz,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_carriers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipping_carriers TO service_role;
GRANT ALL ON public.shipping_zones TO service_role;
GRANT ALL ON public.shipments TO service_role;
GRANT SELECT ON public.shipping_carriers TO anon;
GRANT SELECT ON public.shipping_zones TO anon;
GRANT SELECT ON public.shipments TO anon;

-- RLS
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access to shipping_carriers" ON public.shipping_carriers;
CREATE POLICY "Allow authenticated full access to shipping_carriers" ON public.shipping_carriers FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access to shipping_zones" ON public.shipping_zones;
CREATE POLICY "Allow authenticated full access to shipping_zones" ON public.shipping_zones FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access to shipments" ON public.shipments;
CREATE POLICY "Allow authenticated full access to shipments" ON public.shipments FOR ALL TO authenticated USING (true);




-- =============================================================
-- MIGRATION 5/48: 20260823000000_storefront_mvp.sql
-- =============================================================

-- Storefront MVP: public catalogue + reviewed orders, isolated from internal accounting data.

-- This migration may be applied to projects where the earlier shipping migration
-- was not run, so every shipping dependency is created defensively here.
do $$ begin
  create type public.store_order_status as enum ('submitted', 'under_review', 'needs_info', 'accepted', 'invoiced', 'shipped', 'delivered', 'rejected', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;
do $$ begin create type public.store_order_type as enum ('cash_on_delivery', 'installment_request'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_reservation_status as enum ('active', 'released', 'consumed', 'expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.shipment_status as enum ('pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.shipping_carriers (
  id uuid primary key default gen_random_uuid(), name text not null, contact_person text, phone text, email text,
  base_cost numeric(12,2) default 0, active boolean default true, created_at timestamptz default now()
);
create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(), name text not null,
  carrier_id uuid references public.shipping_carriers(id) on delete cascade,
  delivery_cost numeric(12,2) default 0, estimated_days integer default 2, created_at timestamptz default now()
);
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  carrier_id uuid references public.shipping_carriers(id), zone_id uuid references public.shipping_zones(id),
  tracking_number text unique, status public.shipment_status default 'pending', recipient_name text, recipient_phone text,
  delivery_address text, actual_delivery_date timestamptz, notes text, created_at timestamptz default now()
);
alter table public.shipments add column if not exists user_id uuid references auth.users(id) on delete cascade;
grant select, insert, update, delete on public.shipments to authenticated;
grant all on public.shipments to service_role;
alter table public.shipments enable row level security;
do $$ begin
DROP POLICY IF EXISTS "Storefront owners manage shipments" ON public.shipments;
  create policy "Storefront owners manage shipments" on public.shipments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  branch_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name text not null check (char_length(name) between 2 and 100),
  phone text,
  whatsapp_phone text,
  logo_url text,
  description text,
  shipping_policy text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storefront_categories (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9-]{2,48}$'),
  sort_order integer not null default 0,
  unique (storefront_id, slug)
);

create table if not exists public.storefront_products (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  category_id uuid references public.storefront_categories(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  display_price numeric(12,2) not null check (display_price >= 0),
  show_installments boolean not null default false,
  down_payment_from numeric(12,2),
  monthly_payment_from numeric(12,2),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storefront_id, slug),
  unique (storefront_id, stock_item_id),
  check (
    (not show_installments) or
    (down_payment_from is not null and monthly_payment_from is not null and down_payment_from >= 0 and monthly_payment_from > 0)
  )
);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  public_number text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  storefront_id uuid not null references public.storefronts(id) on delete restrict,
  status public.store_order_status not null default 'submitted',
  order_type public.store_order_type not null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 8 and 24),
  delivery_address text not null check (char_length(delivery_address) between 8 and 500),
  delivery_area text,
  notes text,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  invoice_id uuid unique references public.invoices(id) on delete set null,
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  storefront_product_id uuid references public.storefront_products(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  product_title text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  product_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status public.stock_reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique (order_id, stock_item_id)
);

create table if not exists public.store_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists storefront_products_public_idx on public.storefront_products (storefront_id, is_published, sort_order);
create index if not exists store_orders_storefront_status_idx on public.store_orders (storefront_id, status, created_at desc);
create index if not exists stock_reservations_active_idx on public.stock_reservations (stock_item_id, status, expires_at);

alter table public.storefronts enable row level security;
alter table public.storefront_categories enable row level security;
alter table public.storefront_products enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.store_order_events enable row level security;

drop policy if exists "Owners manage storefronts" on public.storefronts;
DROP POLICY IF EXISTS "Owners manage storefronts" ON public.storefronts;
create policy "Owners manage storefronts" on public.storefronts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Owners manage storefront categories" on public.storefront_categories;
DROP POLICY IF EXISTS "Owners manage storefront categories" ON public.storefront_categories;
create policy "Owners manage storefront categories" on public.storefront_categories for all to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));
drop policy if exists "Owners manage storefront products" on public.storefront_products;
DROP POLICY IF EXISTS "Owners manage storefront products" ON public.storefront_products;
create policy "Owners manage storefront products" on public.storefront_products for all to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));
drop policy if exists "Owners manage storefront orders" on public.store_orders;
DROP POLICY IF EXISTS "Owners manage storefront orders" ON public.store_orders;
create policy "Owners manage storefront orders" on public.store_orders for all to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));
drop policy if exists "Owners read storefront order items" on public.store_order_items;
DROP POLICY IF EXISTS "Owners read storefront order items" ON public.store_order_items;
create policy "Owners read storefront order items" on public.store_order_items for select to authenticated
  using (exists (select 1 from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = order_id and s.owner_id = auth.uid()));
drop policy if exists "Owners read storefront reservations" on public.stock_reservations;
DROP POLICY IF EXISTS "Owners read storefront reservations" ON public.stock_reservations;
create policy "Owners read storefront reservations" on public.stock_reservations for select to authenticated
  using (exists (select 1 from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = order_id and s.owner_id = auth.uid()));
drop policy if exists "Owners read storefront events" on public.store_order_events;
DROP POLICY IF EXISTS "Owners read storefront events" ON public.store_order_events;
create policy "Owners read storefront events" on public.store_order_events for select to authenticated
  using (exists (select 1 from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = order_id and s.owner_id = auth.uid()));

create or replace function public.get_public_storefront(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'storefront', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'phone', s.phone, 'whatsapp_phone', s.whatsapp_phone, 'logo_url', s.logo_url, 'description', s.description, 'shipping_policy', s.shipping_policy),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order) order by c.sort_order, c.name) from storefront_categories c where c.storefront_id = s.id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'description', p.description, 'images', p.images, 'display_price', p.display_price, 'show_installments', p.show_installments, 'down_payment_from', p.down_payment_from, 'monthly_payment_from', p.monthly_payment_from, 'category_id', p.category_id, 'available_quantity', greatest(si.quantity - coalesce((select sum(r.quantity) from stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0), 0)) order by p.sort_order, p.title) from storefront_products p join stock_items si on si.id = p.stock_item_id where p.storefront_id = s.id and p.is_published and (si.quantity - coalesce((select sum(r.quantity) from stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0)) > 0), '[]'::jsonb)
  ) from storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order store_orders; v_item jsonb; v_product storefront_products; v_stock stock_items; v_qty integer; v_subtotal numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  if not exists (select 1 from storefronts where id = p_storefront_id and is_published) then raise exception 'المتجر غير متاح'; end if;
  insert into store_orders (storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes, order_type, subtotal, total)
  values (p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), p_order_type, 0, 0) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from storefront_products p
      where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    insert into store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
      values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty,
        jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
    v_subtotal := v_subtotal + (v_product.display_price * v_qty);
  end loop;
  update store_orders set subtotal = v_subtotal, total = v_subtotal, updated_at = now() where id = v_order.id returning * into v_order;
  insert into store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront'));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status);
end;
$$;

create or replace function public.accept_store_order(p_order_id uuid)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order store_orders; v_item store_order_items; v_stock stock_items; v_reserved integer;
begin
  select o.* into v_order from store_orders o join storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.status not in ('submitted', 'under_review', 'needs_info') then raise exception 'لا يمكن قبول الطلب في حالته الحالية'; end if;
  update stock_reservations set status = 'expired', released_at = now() where status = 'active' and expires_at <= now();
  for v_item in select * from store_order_items where order_id = v_order.id loop
    select * into v_stock from stock_items where id = v_item.stock_item_id for update;
    select coalesce(sum(quantity), 0) into v_reserved from stock_reservations where stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now();
    if v_stock.quantity - v_reserved < v_item.quantity then raise exception 'المخزون لم يعد كافيًا للمنتج: %', v_item.product_title; end if;
    insert into stock_reservations (stock_item_id, order_id, quantity, status, expires_at)
      values (v_item.stock_item_id, v_order.id, v_item.quantity, 'active', now() + interval '24 hours');
  end loop;
  update store_orders set status = 'accepted', reservation_expires_at = now() + interval '24 hours', updated_at = now() where id = v_order.id returning * into v_order;
  insert into store_order_events (order_id, actor_user_id, event_type) values (v_order.id, auth.uid(), 'accepted');
  return v_order;
end;
$$;

-- Converts a reviewed cash order once. Installment requests intentionally stay in
-- review until the merchant records the agreed terms in the invoicing flow.
create or replace function public.invoice_store_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid; v_item store_order_items; v_stock stock_items;
begin
  select o.* into v_order from store_orders o join storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  select owner_id into v_owner from storefronts where id = v_order.storefront_id;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' then raise exception 'اقبل الطلب واحجز الكمية قبل إنشاء الفاتورة'; end if;
  if v_order.order_type <> 'cash_on_delivery' then raise exception 'طلب التقسيط يحتاج إدخال شروط الاتفاق قبل إنشاء الفاتورة'; end if;

  select id into v_customer_id from customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into customers (user_id, name, phone, address) values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address) returning id into v_customer_id;
  end if;
  insert into invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, 0, 0, current_date, 0, concat('طلب متجر #', v_order.public_number), 'pending') returning id into v_invoice_id;
  for v_item in select * from store_order_items where order_id = v_order.id loop
    select * into v_stock from stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into invoice_items (user_id, invoice_id, name, cost, price)
      select v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price from generate_series(1, v_item.quantity);
    update stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update stock_reservations set status = 'consumed', released_at = now() where order_id = v_order.id and stock_item_id = v_stock.id and status = 'active';
  end loop;
  insert into shipments (user_id, invoice_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update store_orders set invoice_id = v_invoice_id, status = 'invoiced', updated_at = now() where id = v_order.id;
  insert into store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;

grant execute on function public.get_public_storefront(text) to anon, authenticated;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb) to anon, authenticated;
grant execute on function public.accept_store_order(uuid) to authenticated;
grant execute on function public.invoice_store_order(uuid) to authenticated;



-- =============================================================
-- MIGRATION 6/48: 20260823010000_storefront_operations_hardening.sql
-- =============================================================

-- Storefront phase 1: secure reservations, cancellation, expiry and idempotent conversion.

alter table public.store_orders
  add column if not exists status_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists expires_at timestamptz;

-- SECURITY DEFINER functions must opt out of PostgreSQL's default PUBLIC execute grant.
revoke all on function public.get_public_storefront(text) from public;
revoke all on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb) from public;
revoke all on function public.accept_store_order(uuid) from public;
revoke all on function public.invoice_store_order(uuid) from public;
grant execute on function public.get_public_storefront(text) to anon, authenticated;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb) to anon, authenticated;
grant execute on function public.accept_store_order(uuid) to authenticated;
grant execute on function public.invoice_store_order(uuid) to authenticated;

create or replace function public.expire_storefront_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  with expired_orders as (
    update public.store_orders o
    set status = 'expired', status_reason = 'انتهت مهلة حجز المخزون', updated_at = now(), expires_at = now()
    where o.status = 'accepted' and o.reservation_expires_at <= now()
    returning o.id
  ), released as (
    update public.stock_reservations r set status = 'expired', released_at = now()
    where r.status = 'active' and (r.expires_at <= now() or r.order_id in (select id from expired_orders))
    returning r.order_id
  ) select count(distinct order_id) into v_count from released;
  insert into public.store_order_events (order_id, event_type, payload)
    select id, 'reservation_expired', jsonb_build_object('at', now()) from expired_orders;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid, p_reason text default null)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders;
begin
  select o.* into v_order
  from public.store_orders o join public.storefronts s on s.id = o.storefront_id
  where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.status in ('invoiced', 'shipped', 'delivered') then raise exception 'لا يمكن إلغاء طلب تم تحويله أو شحنه'; end if;
  if v_order.status in ('cancelled', 'rejected', 'expired') then return v_order; end if;
  update public.stock_reservations set status = 'released', released_at = now()
    where order_id = v_order.id and status = 'active';
  update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), cancelled_at = now(), updated_at = now()
    where id = v_order.id returning * into v_order;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'cancelled', jsonb_build_object('reason', v_order.status_reason));
  return v_order;
end;
$$;

create or replace function public.accept_store_order(p_order_id uuid)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders; v_item public.store_order_items; v_stock public.stock_items; v_reserved integer;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.status not in ('submitted', 'under_review', 'needs_info') then raise exception 'لا يمكن قبول الطلب في حالته الحالية'; end if;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    select coalesce(sum(quantity), 0) into v_reserved from public.stock_reservations
      where stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now();
    if not found or v_stock.quantity - v_reserved < v_item.quantity then
      raise exception 'المخزون لم يعد كافيًا للمنتج: %', v_item.product_title;
    end if;
    insert into public.stock_reservations (stock_item_id, order_id, quantity, status, expires_at)
      values (v_item.stock_item_id, v_order.id, v_item.quantity, 'active', now() + interval '24 hours')
      on conflict (order_id, stock_item_id) do update set quantity = excluded.quantity, status = 'active', expires_at = excluded.expires_at, released_at = null;
  end loop;
  update public.store_orders set status = 'accepted', status_reason = null, reservation_expires_at = now() + interval '24 hours', expires_at = null, updated_at = now()
    where id = v_order.id returning * into v_order;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'accepted', jsonb_build_object('reservation_expires_at', v_order.reservation_expires_at));
  return v_order;
end;
$$;

create or replace function public.invoice_store_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid; v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' or v_order.reservation_expires_at <= now() then raise exception 'انتهت مهلة الحجز أو الطلب غير مقبول'; end if;
  if v_order.order_type <> 'cash_on_delivery' then raise exception 'طلب التقسيط يحتاج شروط اتفاق قبل إنشاء الفاتورة'; end if;
  select owner_id into v_owner from public.storefronts where id = v_order.storefront_id;
  select id into v_customer_id from public.customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into public.customers (user_id, name, phone, address) values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address) returning id into v_customer_id;
  end if;
  insert into public.invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, 0, 0, current_date, 0, concat('طلب متجر #', v_order.public_number), 'pending') returning id into v_invoice_id;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_reservation from public.stock_reservations where order_id = v_order.id and stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now() for update;
    if not found then raise exception 'انتهى حجز المنتج: %', v_item.product_title; end if;
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into public.invoice_items (user_id, invoice_id, name, cost, price)
      select v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price from generate_series(1, v_item.quantity);
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update public.stock_reservations set status = 'consumed', released_at = now() where id = v_reservation.id;
  end loop;
  insert into public.shipments (user_id, invoice_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update public.store_orders set invoice_id = v_invoice_id, status = 'invoiced', status_reason = null, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;

revoke all on function public.expire_storefront_reservations() from public;
revoke all on function public.cancel_store_order(uuid, text) from public;
grant execute on function public.expire_storefront_reservations() to authenticated;
grant execute on function public.cancel_store_order(uuid, text) to authenticated;



-- =============================================================
-- MIGRATION 7/48: 20260823020000_storefront_status_audit_and_expiry.sql
-- =============================================================

-- Storefront phase 1: route merchant status changes through audited RPCs
-- and schedule reservation cleanup independently of customer traffic.

create extension if not exists pg_cron;

create or replace function public.update_store_order_status(
  p_order_id uuid,
  p_status public.store_order_status,
  p_reason text default null
)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders;
begin
  select o.* into v_order
  from public.store_orders o
  join public.storefronts s on s.id = o.storefront_id
  where o.id = p_order_id and s.owner_id = auth.uid()
  for update of o;

  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if p_status not in ('under_review', 'needs_info', 'rejected') then
    raise exception 'تغيير الحالة غير مسموح من هذا المسار';
  end if;
  if v_order.status in ('invoiced', 'shipped', 'delivered', 'cancelled', 'expired') then
    raise exception 'لا يمكن تغيير حالة الطلب بعد إغلاقه';
  end if;
  if p_status = 'rejected' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'سبب الرفض مطلوب';
  end if;

  update public.store_orders
  set status = p_status,
      status_reason = nullif(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
  values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('reason', v_order.status_reason));
  return v_order;
end;
$$;

revoke all on function public.update_store_order_status(uuid, public.store_order_status, text) from public;
grant execute on function public.update_store_order_status(uuid, public.store_order_status, text) to authenticated;

revoke all on function public.expire_storefront_reservations() from public, authenticated;
grant execute on function public.expire_storefront_reservations() to service_role;

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-storefront-reservations';
    perform cron.schedule('expire-storefront-reservations', '*/5 * * * *', $cron$select public.expire_storefront_reservations();$cron$);
  end if;
exception when undefined_table or undefined_function then
  null;
end;
$$;


-- =============================================================
-- MIGRATION 8/48: 20260823030000_shipping_data_isolation.sql
-- =============================================================

-- Phase 2 prerequisite: shipping configuration belongs to one merchant.

alter table public.shipping_carriers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.shipping_zones
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "Allow authenticated full access to shipping_carriers" on public.shipping_carriers;
drop policy if exists "Allow authenticated full access to shipping_zones" on public.shipping_zones;
drop policy if exists "Storefront owners manage shipments" on public.shipments;

DROP POLICY IF EXISTS "Users manage own shipping carriers" ON public.shipping_carriers;
create policy "Users manage own shipping carriers" on public.shipping_carriers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own shipping zones" ON public.shipping_zones;
create policy "Users manage own shipping zones" on public.shipping_zones
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own shipments" ON public.shipments;
create policy "Users manage own shipments" on public.shipments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists shipping_carriers_user_idx on public.shipping_carriers (user_id, active);
create index if not exists shipping_zones_user_idx on public.shipping_zones (user_id, name);


-- =============================================================
-- MIGRATION 9/48: 20260823040000_storefront_shipping_fees.sql
-- =============================================================

-- Storefront phase 2: calculate and snapshot delivery fees on the server.

create or replace function public.get_public_storefront(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'storefront', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'phone', s.phone, 'whatsapp_phone', s.whatsapp_phone, 'logo_url', s.logo_url, 'description', s.description, 'shipping_policy', s.shipping_policy),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order) order by c.sort_order, c.name) from public.storefront_categories c where c.storefront_id = s.id), '[]'::jsonb),
    'shipping_options', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'delivery_cost', z.delivery_cost, 'estimated_days', z.estimated_days, 'carrier_name', c.name) order by z.name) from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active where z.user_id = s.owner_id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'description', p.description, 'images', p.images, 'display_price', p.display_price, 'show_installments', p.show_installments, 'down_payment_from', p.down_payment_from, 'monthly_payment_from', p.monthly_payment_from, 'category_id', p.category_id, 'available_quantity', greatest(si.quantity - coalesce((select sum(r.quantity) from public.stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0), 0)) order by p.sort_order, p.title) from public.storefront_products p join public.stock_items si on si.id = p.stock_item_id where p.storefront_id = s.id and p.is_published and (si.quantity - coalesce((select sum(r.quantity) from public.stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0)) > 0), '[]'::jsonb)
  ) from public.storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

drop function if exists public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb);

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_item jsonb; v_product public.storefront_products; v_stock public.stock_items;
  v_qty integer; v_subtotal numeric := 0; v_shipping_fee numeric := 0; v_owner uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  select owner_id into v_owner from public.storefronts where id = p_storefront_id and is_published;
  if not found then raise exception 'المتجر غير متاح'; end if;
  if p_shipping_zone_id is not null then
    select z.delivery_cost into v_shipping_fee
    from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active
    where z.id = p_shipping_zone_id and z.user_id = v_owner;
    if not found then raise exception 'منطقة التوصيل غير متاحة'; end if;
  end if;
  insert into public.store_orders (storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes, order_type, shipping_fee, subtotal, total)
  values (p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), p_order_type, v_shipping_fee, 0, v_shipping_fee)
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from public.stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    insert into public.store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
    values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty, jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
    v_subtotal := v_subtotal + v_product.display_price * v_qty;
  end loop;
  update public.store_orders set subtotal = v_subtotal, total = v_subtotal + v_shipping_fee, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront', 'shipping_zone_id', p_shipping_zone_id, 'shipping_fee', v_shipping_fee));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status, 'shipping_fee', v_shipping_fee, 'total', v_subtotal + v_shipping_fee);
end;
$$;

revoke all on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid) from public;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid) to anon, authenticated;


-- =============================================================
-- MIGRATION 10/48: 20260823050000_storefront_product_images.sql
-- =============================================================

-- Phase 3: public product images with merchant-folder isolation.

insert into storage.buckets (id, name, public)
values ('storefront-product-images', 'storefront-product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public storefront product images are readable" on storage.objects;
create policy "Public storefront product images are readable"
  on storage.objects for select using (bucket_id = 'storefront-product-images');

drop policy if exists "Merchants upload storefront product images" on storage.objects;
create policy "Merchants upload storefront product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Merchants update storefront product images" on storage.objects;
create policy "Merchants update storefront product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Merchants delete storefront product images" on storage.objects;
create policy "Merchants delete storefront product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text);


-- =============================================================
-- MIGRATION 11/48: 20260823060000_storefront_notifications.sql
-- =============================================================

-- Phase 7: in-app merchant notifications for storefront activity.

create table if not exists public.storefront_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.store_orders(id) on delete cascade,
  event_id uuid references public.store_order_events(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id)
);

alter table public.storefront_notifications enable row level security;
drop policy if exists "Users read own storefront notifications" on public.storefront_notifications;
DROP POLICY IF EXISTS "Users read own storefront notifications" ON public.storefront_notifications;
create policy "Users read own storefront notifications" on public.storefront_notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users update own storefront notifications" on public.storefront_notifications;
DROP POLICY IF EXISTS "Users update own storefront notifications" ON public.storefront_notifications;
create policy "Users update own storefront notifications" on public.storefront_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_storefront_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_body text;
begin
  select s.owner_id into v_owner from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = new.order_id;
  if v_owner is null then return new; end if;
  v_title := case new.event_type when 'submitted' then 'طلب جديد من المتجر' when 'accepted' then 'تم قبول طلب' when 'invoiced' then 'تم إنشاء فاتورة' when 'cancelled' then 'تم إلغاء طلب' when 'rejected' then 'تم رفض طلب' else 'تحديث على طلب' end;
  v_body := coalesce(new.payload->>'reason', 'رقم الطلب: ' || new.order_id::text);
  insert into public.storefront_notifications (user_id, order_id, event_id, title, body) values (v_owner, new.order_id, new.id, v_title, v_body) on conflict (event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists store_order_event_notification on public.store_order_events;
DROP TRIGGER IF EXISTS store_order_event_notification ON public.store_order_events;
create trigger store_order_event_notification after insert on public.store_order_events for each row execute function public.notify_storefront_event();


-- =============================================================
-- MIGRATION 12/48: 20260823070000_public_order_tracking.sql
-- =============================================================

-- Phase 8: limited public order tracking by order number and phone.

create or replace function public.get_public_order_status(p_public_number text, p_customer_phone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'public_number', o.public_number,
    'status', o.status,
    'order_type', o.order_type,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'total', o.total,
    'shipping_fee', o.shipping_fee,
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.product_title, 'quantity', i.quantity)) from public.store_order_items i where i.order_id = o.id), '[]'::jsonb)
  ) from public.store_orders o
  where upper(o.public_number) = upper(trim(p_public_number))
    and regexp_replace(o.customer_phone, '[^0-9]+', '', 'g') = regexp_replace(trim(p_customer_phone), '[^0-9]+', '', 'g');
$$;

revoke all on function public.get_public_order_status(text, text) from public;
grant execute on function public.get_public_order_status(text, text) to anon, authenticated;


-- =============================================================
-- MIGRATION 13/48: 20260823080000_storefront_privacy_analytics.sql
-- =============================================================

-- Phase 9: conversion events without customer PII.

create table if not exists public.storefront_analytics_events (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  event_name text not null check (event_name in ('store_view', 'product_view', 'cart_add', 'checkout_start', 'order_submitted')),
  product_id uuid references public.storefront_products(id) on delete set null,
  source text check (source is null or source in ('direct', 'whatsapp', 'facebook', 'instagram', 'other')),
  occurred_at timestamptz not null default now()
);

alter table public.storefront_analytics_events enable row level security;
DROP POLICY IF EXISTS "Owners read storefront analytics" ON public.storefront_analytics_events;
create policy "Owners read storefront analytics" on public.storefront_analytics_events for select to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create or replace function public.record_storefront_event(p_storefront_id uuid, p_event_name text, p_product_id uuid default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event_name not in ('store_view', 'product_view', 'cart_add', 'checkout_start', 'order_submitted') then raise exception 'حدث غير مسموح'; end if;
  if not exists (select 1 from public.storefronts where id = p_storefront_id and is_published) then return; end if;
  if p_product_id is not null and not exists (select 1 from public.storefront_products where id = p_product_id and storefront_id = p_storefront_id) then return; end if;
  insert into public.storefront_analytics_events (storefront_id, event_name, product_id, source) values (p_storefront_id, p_event_name, p_product_id, nullif(p_source, ''));
end;
$$;

revoke all on function public.record_storefront_event(uuid, text, uuid, text) from public;
grant execute on function public.record_storefront_event(uuid, text, uuid, text) to anon, authenticated;

create or replace function public.get_storefront_analytics_summary(p_storefront_id uuid, p_from timestamptz default now() - interval '30 days')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'store_view', count(*) filter (where event_name = 'store_view'),
    'product_view', count(*) filter (where event_name = 'product_view'),
    'cart_add', count(*) filter (where event_name = 'cart_add'),
    'checkout_start', count(*) filter (where event_name = 'checkout_start'),
    'order_submitted', count(*) filter (where event_name = 'order_submitted')
  ) from public.storefront_analytics_events e
  join public.storefronts s on s.id = e.storefront_id
  where e.storefront_id = p_storefront_id and s.owner_id = auth.uid() and e.occurred_at >= p_from;
$$;

revoke all on function public.get_storefront_analytics_summary(uuid, timestamptz) from public;
grant execute on function public.get_storefront_analytics_summary(uuid, timestamptz) to authenticated;


-- =============================================================
-- MIGRATION 14/48: 20260823090000_storefront_coupons.sql
-- =============================================================

-- Phase 10: auditable, merchant-scoped storefront coupons.

create table if not exists public.storefront_coupons (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (storefront_id, code),
  check (ends_at is null or ends_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

alter table public.storefront_coupons enable row level security;
DROP POLICY IF EXISTS "Owners manage storefront coupons" ON public.storefront_coupons;
create policy "Owners manage storefront coupons" on public.storefront_coupons for all to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create or replace function public.validate_storefront_coupon(p_storefront_id uuid, p_code text, p_subtotal numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('valid', true, 'coupon_id', c.id, 'discount_type', c.discount_type, 'discount_value', c.discount_value,
    'discount_amount', least(p_subtotal, case when c.discount_type = 'percentage' then round(p_subtotal * c.discount_value / 100, 2) else c.discount_value end))
  from public.storefront_coupons c
  where c.storefront_id = p_storefront_id and upper(c.code) = upper(trim(p_code)) and c.active and now() >= c.starts_at and (c.ends_at is null or now() <= c.ends_at) and p_subtotal >= c.minimum_order and (c.max_uses is null or c.used_count < c.max_uses);
$$;

revoke all on function public.validate_storefront_coupon(uuid, text, numeric) from public;
grant execute on function public.validate_storefront_coupon(uuid, text, numeric) to anon, authenticated;


-- =============================================================
-- MIGRATION 15/48: 20260823091000_storefront_coupon_redemption.sql
-- =============================================================

-- Phase 10: consume coupons atomically after an order is created.

alter table public.store_orders
  add column if not exists coupon_id uuid references public.storefront_coupons(id) on delete set null,
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);

create or replace function public.redeem_storefront_coupon(p_order_id uuid, p_coupon_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_coupon public.storefront_coupons; v_order public.store_orders; v_discount numeric;
begin
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_order.coupon_id is not null then return v_order.discount_amount; end if;
  select * into v_coupon from public.storefront_coupons where id = p_coupon_id and storefront_id = v_order.storefront_id for update;
  if not found or not v_coupon.active or now() < v_coupon.starts_at or (v_coupon.ends_at is not null and now() > v_coupon.ends_at) or v_order.subtotal < v_coupon.minimum_order or (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses) then raise exception 'الكوبون غير صالح أو انتهت مرات استخدامه'; end if;
  v_discount := least(v_order.subtotal, case when v_coupon.discount_type = 'percentage' then round(v_order.subtotal * v_coupon.discount_value / 100, 2) else v_coupon.discount_value end);
  update public.storefront_coupons set used_count = used_count + 1 where id = v_coupon.id;
  update public.store_orders set coupon_id = v_coupon.id, discount_amount = v_discount, total = greatest(0, total - v_discount), updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'coupon_redeemed', jsonb_build_object('coupon_id', v_coupon.id, 'discount_amount', v_discount));
  return v_discount;
end;
$$;

revoke all on function public.redeem_storefront_coupon(uuid, uuid) from public;
grant execute on function public.redeem_storefront_coupon(uuid, uuid) to authenticated;


-- =============================================================
-- MIGRATION 16/48: 20260823100000_storefront_feature_flags.sql
-- =============================================================

-- Phase 10: controlled rollout switches per storefront.

create table if not exists public.storefront_feature_flags (
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  flag text not null check (flag in ('coupons', 'online_payment', 'custom_domain', 'branch_catalog')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (storefront_id, flag)
);

alter table public.storefront_feature_flags enable row level security;
DROP POLICY IF EXISTS "Owners manage storefront feature flags" ON public.storefront_feature_flags;
create policy "Owners manage storefront feature flags" on public.storefront_feature_flags for all to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create or replace function public.get_storefront_feature_flag(p_storefront_id uuid, p_flag text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.storefront_feature_flags where storefront_id = p_storefront_id and flag = p_flag), false);
$$;

revoke all on function public.get_storefront_feature_flag(uuid, text) from public;
grant execute on function public.get_storefront_feature_flag(uuid, text) to anon, authenticated;


-- =============================================================
-- MIGRATION 17/48: 20260823110000_storefront_custom_domains.sql
-- =============================================================

-- Phase 10: custom domain lifecycle foundation.

create table if not exists public.storefront_domains (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  domain text not null unique check (domain = lower(domain) and domain !~ '[^a-z0-9.-]'),
  status text not null default 'pending_dns' check (status in ('pending_dns', 'pending_ssl', 'active', 'disabled')),
  verification_token text not null default encode(gen_random_bytes(18), 'hex'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storefront_domains enable row level security;
DROP POLICY IF EXISTS "Owners manage storefront domains" ON public.storefront_domains;
create policy "Owners manage storefront domains" on public.storefront_domains for all to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create index if not exists storefront_domains_store_idx on public.storefront_domains (storefront_id, status);


-- =============================================================
-- MIGRATION 18/48: 20260827061920_506a391d-ed98-4f11-bad7-86b1bb38c6e4.sql
-- =============================================================

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;


-- =============================================================
-- MIGRATION 19/48: 20260827100000_storefront_installment_invoicing.sql
-- =============================================================

-- Allow an accepted storefront installment request to become a real installment invoice.
create or replace function public.invoice_store_order_installment(
  p_order_id uuid,
  p_down_payment numeric,
  p_monthly_installment numeric,
  p_first_due_date date
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid;
  v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' or v_order.reservation_expires_at <= now() then raise exception 'انتهت مهلة الحجز أو الطلب غير مقبول'; end if;
  if v_order.order_type <> 'installment_request' then raise exception 'الطلب ليس طلب تقسيط'; end if;
  if p_down_payment is null or p_down_payment < 0 or p_down_payment > v_order.total then raise exception 'المقدم غير صحيح'; end if;
  if p_monthly_installment is null or p_monthly_installment <= 0 then raise exception 'القسط الشهري يجب أن يكون أكبر من صفر'; end if;
  if p_first_due_date is null then raise exception 'تاريخ أول استحقاق مطلوب'; end if;

  select owner_id into v_owner from public.storefronts where id = v_order.storefront_id;
  select id into v_customer_id from public.customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into public.customers (user_id, name, phone, address, customer_type)
      values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address, 'installment') returning id into v_customer_id;
  end if;
  insert into public.invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, p_down_payment, p_monthly_installment, p_first_due_date, p_down_payment, concat('طلب متجر تقسيط #', v_order.public_number), 'pending') returning id into v_invoice_id;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_reservation from public.stock_reservations where order_id = v_order.id and stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now() for update;
    if not found then raise exception 'انتهى حجز المنتج: %', v_item.product_title; end if;
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into public.invoice_items (user_id, invoice_id, name, cost, price)
      select v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price from generate_series(1, v_item.quantity);
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update public.stock_reservations set status = 'consumed', released_at = now() where id = v_reservation.id;
  end loop;
  insert into public.shipments (user_id, invoice_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update public.store_orders set invoice_id = v_invoice_id, status = 'invoiced', status_reason = null, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id, 'order_type', 'installment_request', 'down_payment', p_down_payment, 'monthly_installment', p_monthly_installment, 'first_due_date', p_first_due_date));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;

revoke all on function public.invoice_store_order_installment(uuid, numeric, numeric, date) from public;
grant execute on function public.invoice_store_order_installment(uuid, numeric, numeric, date) to authenticated;



-- =============================================================
-- MIGRATION 20/48: 20260827110000_storefront_settings_and_shipping_links.sql
-- =============================================================

alter table public.storefronts
  add column if not exists banner_url text,
  add column if not exists theme_key text not null default 'emerald',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists minimum_order numeric(12,2) not null default 0,
  add column if not exists opening_hours jsonb not null default '{}'::jsonb;

alter table public.store_orders
  add column if not exists return_id uuid references public.return_records(id) on delete set null;

create index if not exists store_orders_return_idx on public.store_orders (return_id);



-- =============================================================
-- MIGRATION 21/48: 20260827120000_storefront_public_settings.sql
-- =============================================================

create or replace function public.get_public_storefront_with_settings(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(public.get_public_storefront(p_slug), '{storefront,banner_url}', to_jsonb(s.banner_url)),
          '{storefront,theme_key}', to_jsonb(s.theme_key)
        ),
        '{storefront,seo_title}', to_jsonb(s.seo_title)
      ),
      '{storefront,seo_description}', to_jsonb(s.seo_description)
    ),
    '{storefront,social_links}', s.social_links
  ) from public.storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

grant execute on function public.get_public_storefront_with_settings(text) to anon, authenticated;



-- =============================================================
-- MIGRATION 22/48: 20260827130000_atomic_invoice_payments.sql
-- =============================================================

-- Atomic payment operations: invoice.paid is always derived from the invoice down payment plus payment rows.
create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_id uuid default gen_random_uuid(),
  p_paid_at timestamptz default now()
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ التحصيل يجب أن يكون أكبر من صفر'; end if;
  select i.* into v_invoice from public.invoices i where i.id = p_invoice_id and i.user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'لا يمكن التحصيل من فاتورة ملغاة'; end if;
  if p_amount > greatest(0, v_invoice.total - v_invoice.paid) then raise exception 'مبلغ التحصيل أكبر من المتبقي'; end if;
  insert into public.payments (id, user_id, invoice_id, amount, paid_at) values (p_payment_id, auth.uid(), p_invoice_id, p_amount, p_paid_at);
  select v_invoice.down_payment + coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.invoice_id = p_invoice_id;
  v_paid := least(v_invoice.total, v_paid);
  update public.invoices set paid = v_paid, status = case when v_paid >= total then 'paid' else status end where id = p_invoice_id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', p_invoice_id, 'paid', v_paid);
end;
$$;

create or replace function public.update_invoice_payment(p_payment_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.payments; v_invoice public.invoices; v_other numeric; v_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ التحصيل يجب أن يكون أكبر من صفر'; end if;
  select p.* into v_payment from public.payments p where p.id = p_payment_id and p.user_id = auth.uid() for update;
  if not found then raise exception 'الدفعة غير موجودة أو غير مسموح'; end if;
  select i.* into v_invoice from public.invoices i where i.id = v_payment.invoice_id and i.user_id = auth.uid() for update;
  select coalesce(sum(p.amount), 0) into v_other from public.payments p where p.invoice_id = v_invoice.id and p.id <> v_payment.id;
  if v_invoice.status = 'cancelled' or p_amount > greatest(0, v_invoice.total - v_invoice.down_payment - v_other) then raise exception 'مبلغ التحصيل أكبر من المتبقي'; end if;
  update public.payments set amount = p_amount where id = p_payment_id;
  v_paid := least(v_invoice.total, v_invoice.down_payment + v_other + p_amount);
  update public.invoices set paid = v_paid, status = case when v_paid >= total then 'paid' when status = 'paid' then 'pending' else status end where id = v_invoice.id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', v_invoice.id, 'paid', v_paid);
end;
$$;

create or replace function public.delete_invoice_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.payments; v_invoice public.invoices; v_paid numeric;
begin
  select p.* into v_payment from public.payments p where p.id = p_payment_id and p.user_id = auth.uid() for update;
  if not found then raise exception 'الدفعة غير موجودة أو غير مسموح'; end if;
  select i.* into v_invoice from public.invoices i where i.id = v_payment.invoice_id and i.user_id = auth.uid() for update;
  delete from public.payments where id = p_payment_id;
  select least(v_invoice.total, v_invoice.down_payment + coalesce(sum(p.amount), 0)) into v_paid from public.payments p where p.invoice_id = v_invoice.id;
  update public.invoices set paid = v_paid, status = case when v_paid < total and status = 'paid' then 'pending' else status end where id = v_invoice.id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', v_invoice.id, 'paid', v_paid);
end;
$$;

create or replace function public.recalculate_invoice_paid(p_invoice_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_paid numeric;
begin
  select i.* into v_invoice from public.invoices i where i.id = p_invoice_id and i.user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  select least(v_invoice.total, v_invoice.down_payment + coalesce(sum(p.amount), 0)) into v_paid from public.payments p where p.invoice_id = v_invoice.id;
  update public.invoices set paid = v_paid, status = case when v_paid >= total then 'paid' when status = 'paid' then 'pending' else status end where id = v_invoice.id;
  return v_paid;
end;
$$;

grant execute on function public.record_invoice_payment(uuid, numeric, uuid, timestamptz) to authenticated;
grant execute on function public.update_invoice_payment(uuid, numeric) to authenticated;
grant execute on function public.delete_invoice_payment(uuid) to authenticated;
grant execute on function public.recalculate_invoice_paid(uuid) to authenticated;



-- =============================================================
-- MIGRATION 23/48: 20260827130001_store_order_shipping_zone.sql
-- =============================================================

-- Persist shipping zone on store orders and link shipments on invoicing.

alter table public.store_orders
  add column if not exists shipping_zone_id uuid references public.shipping_zones(id) on delete set null;

create index if not exists store_orders_shipping_zone_idx on public.store_orders (shipping_zone_id);

-- Backfill from submitted event payload where available
update public.store_orders o
set shipping_zone_id = (e.payload->>'shipping_zone_id')::uuid
from public.store_order_events e
where e.order_id = o.id
  and e.event_type = 'submitted'
  and o.shipping_zone_id is null
  and (e.payload->>'shipping_zone_id') is not null
  and (e.payload->>'shipping_zone_id') ~* '^[0-9a-f-]{36}$';

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_item jsonb; v_product public.storefront_products; v_stock public.stock_items;
  v_qty integer; v_subtotal numeric := 0; v_shipping_fee numeric := 0; v_owner uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  select owner_id into v_owner from public.storefronts where id = p_storefront_id and is_published;
  if not found then raise exception 'المتجر غير متاح'; end if;
  if p_shipping_zone_id is not null then
    select z.delivery_cost into v_shipping_fee
    from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active
    where z.id = p_shipping_zone_id and z.user_id = v_owner;
    if not found then raise exception 'منطقة التوصيل غير متاحة'; end if;
  end if;
  insert into public.store_orders (
    storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes,
    order_type, shipping_fee, shipping_zone_id, subtotal, total
  )
  values (
    p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address),
    nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
    p_order_type, v_shipping_fee, p_shipping_zone_id, 0, v_shipping_fee
  )
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from public.stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    insert into public.store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
    values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty, jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
    v_subtotal := v_subtotal + v_product.display_price * v_qty;
  end loop;
  update public.store_orders set subtotal = v_subtotal, total = v_subtotal + v_shipping_fee, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront', 'shipping_zone_id', p_shipping_zone_id, 'shipping_fee', v_shipping_fee));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status, 'shipping_fee', v_shipping_fee, 'total', v_subtotal + v_shipping_fee);
end;
$$;

create or replace function public.invoice_store_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid;
  v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
  v_carrier_id uuid; v_zone_id uuid;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' or v_order.reservation_expires_at <= now() then raise exception 'انتهت مهلة الحجز أو الطلب غير مقبول'; end if;
  if v_order.order_type <> 'cash_on_delivery' then raise exception 'طلب التقسيط يحتاج شروط اتفاق قبل إنشاء الفاتورة'; end if;
  select owner_id into v_owner from public.storefronts where id = v_order.storefront_id;
  select id into v_customer_id from public.customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into public.customers (user_id, name, phone, address) values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address) returning id into v_customer_id;
  end if;
  insert into public.invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, 0, 0, current_date, 0, concat('طلب متجر #', v_order.public_number), 'pending') returning id into v_invoice_id;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_reservation from public.stock_reservations where order_id = v_order.id and stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now() for update;
    if not found then raise exception 'انتهى حجز المنتج: %', v_item.product_title; end if;
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into public.invoice_items (user_id, invoice_id, name, cost, price)
      select v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price from generate_series(1, v_item.quantity);
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update public.stock_reservations set status = 'consumed', released_at = now() where id = v_reservation.id;
  end loop;
  v_zone_id := v_order.shipping_zone_id;
  if v_zone_id is not null then
    select z.carrier_id into v_carrier_id from public.shipping_zones z where z.id = v_zone_id;
  end if;
  insert into public.shipments (user_id, invoice_id, carrier_id, zone_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, v_carrier_id, v_zone_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update public.store_orders set invoice_id = v_invoice_id, status = 'invoiced', status_reason = null, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id, 'shipping_zone_id', v_zone_id));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;



-- =============================================================
-- MIGRATION 24/48: 20260827140000_atomic_purchase_inventory.sql
-- =============================================================

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  movement_type text not null check (movement_type in ('purchase', 'sale', 'return', 'adjustment', 'reversal')),
  quantity integer not null,
  unit_cost numeric(12,2) not null default 0,
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;
DROP POLICY IF EXISTS "Users manage own stock movements" ON public.stock_movements;
create policy "Users manage own stock movements" on public.stock_movements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.stock_movements to authenticated;

create or replace function public.record_purchase_with_inventory(
  p_supplier_id uuid, p_total numeric, p_payment_type text, p_purchase_date date, p_notes text, p_items jsonb, p_purchase_id uuid default gen_random_uuid()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف صنفًا واحدًا على الأقل'; end if;
  insert into public.purchases (id, user_id, supplier_id, total, payment_type, purchase_date, notes)
    values (p_purchase_id, auth.uid(), p_supplier_id, p_total, p_payment_type, p_purchase_date, p_notes);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unitCost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost <= 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity) values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty);
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if found then
      update public.stock_items set quantity = quantity + v_qty, last_unit_cost = v_cost, updated_at = now() where id = v_stock.id;
    else
      insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock;
    end if;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id) values (auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
  end loop;
  return p_purchase_id;
end;
$$;

create or replace function public.update_purchase_with_inventory(
  p_purchase_id uuid, p_supplier_id uuid, p_total numeric, p_payment_type text, p_purchase_date date, p_notes text, p_items jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_old record; v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric;
begin
  if not exists (select 1 from public.purchases where id = p_purchase_id and user_id = auth.uid()) then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_old.name for update;
    if not found or v_stock.quantity < v_old.quantity then raise exception 'المخزون لا يسمح بعكس الفاتورة القديمة: %', v_old.name; end if;
    update public.stock_items set quantity = quantity - v_old.quantity, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes) values (auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost, p_purchase_id, 'عكس نسخة الشراء القديمة');
  end loop;
  delete from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid();
  update public.purchases set supplier_id = p_supplier_id, total = p_total, payment_type = p_payment_type, purchase_date = p_purchase_date, notes = p_notes where id = p_purchase_id and user_id = auth.uid();
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unitCost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost <= 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity) values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty);
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if found then update public.stock_items set quantity = quantity + v_qty, last_unit_cost = v_cost, updated_at = now() where id = v_stock.id;
    else insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock; end if;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id) values (auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
  end loop;
end;
$$;

create or replace function public.delete_purchase_with_inventory(p_purchase_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_old record; v_stock public.stock_items;
begin
  if not exists (select 1 from public.purchases where id = p_purchase_id and user_id = auth.uid()) then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_old.name for update;
    if not found or v_stock.quantity < v_old.quantity then raise exception 'المخزون لا يسمح بحذف الفاتورة: %', v_old.name; end if;
    update public.stock_items set quantity = quantity - v_old.quantity, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes) values (auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost, p_purchase_id, 'عكس حذف فاتورة الشراء');
  end loop;
  delete from public.purchases where id = p_purchase_id and user_id = auth.uid();
end;
$$;

grant execute on function public.record_purchase_with_inventory(uuid, numeric, text, date, text, jsonb, uuid) to authenticated;
grant execute on function public.update_purchase_with_inventory(uuid, uuid, numeric, text, date, text, jsonb) to authenticated;
grant execute on function public.delete_purchase_with_inventory(uuid) to authenticated;

create or replace function public.log_invoice_item_stock_movement() returns trigger language plpgsql security definer set search_path = public as $$
declare v_stock public.stock_items;
begin
  select * into v_stock from public.stock_items where user_id = new.user_id and name = new.name limit 1;
  if found then
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (new.user_id, v_stock.id, 'sale', -new.quantity, new.cost, new.invoice_id, 'بيع من فاتورة');
  end if;
  return new;
end;
$$;

create or replace function public.log_return_item_stock_movement() returns trigger language plpgsql security definer set search_path = public as $$
declare v_stock public.stock_items; v_type text;
begin
  select type into v_type from public.return_records where id = new.return_id;
  select * into v_stock from public.stock_items where user_id = new.user_id and name = new.name limit 1;
  if found then
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (new.user_id, v_stock.id, 'return', case when v_type = 'supplier' then -new.quantity else new.quantity end, new.unit_price, new.return_id, 'مرتجع مخزون');
  end if;
  return new;
end;
$$;

create or replace function public.log_stock_adjustment_movement() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
    values (new.user_id, new.stock_item_id, 'adjustment', new.delta, 0, new.id, new.reason);
  return new;
end;
$$;

drop trigger if exists invoice_item_stock_movement on public.invoice_items;
DROP TRIGGER IF EXISTS invoice_item_stock_movement ON public.invoice_items;
create trigger invoice_item_stock_movement after insert on public.invoice_items for each row execute function public.log_invoice_item_stock_movement();
drop trigger if exists return_item_stock_movement on public.return_items;
DROP TRIGGER IF EXISTS return_item_stock_movement ON public.return_items;
create trigger return_item_stock_movement after insert on public.return_items for each row execute function public.log_return_item_stock_movement();
drop trigger if exists stock_adjustment_movement on public.stock_adjustments;
DROP TRIGGER IF EXISTS stock_adjustment_movement ON public.stock_adjustments;
create trigger stock_adjustment_movement after insert on public.stock_adjustments for each row execute function public.log_stock_adjustment_movement();



-- =============================================================
-- MIGRATION 25/48: 20260827150000_atomic_storefront_returns.sql
-- =============================================================

create or replace function public.create_storefront_sale_return(
  p_order_id uuid, p_reason text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_return_id uuid; v_item jsonb; v_order_item public.store_order_items;
  v_sold integer; v_returned integer; v_qty integer; v_total numeric := 0; v_stock public.stock_items; v_invoice public.invoices; v_returned_total numeric;
begin
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is null then raise exception 'لا يمكن تسجيل مرتجع قبل إنشاء الفاتورة'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب المرتجع مطلوب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر صنفًا واحدًا على الأقل'; end if;
  select * into v_invoice from public.invoices where id = v_order.invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;

  insert into public.return_records (user_id, invoice_id, type, total_amount, reason, notes)
    values (auth.uid(), v_order.invoice_id, 'sale', 0, trim(p_reason), concat('مرتجع طلب متجر #', v_order.public_number)) returning id into v_return_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_order_item from public.store_order_items where order_id = v_order.id and stock_item_id = (v_item->>'stock_item_id')::uuid;
    if not found or v_qty is null or v_qty <= 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;
    select quantity into v_sold from public.store_order_items where id = v_order_item.id;
    select coalesce(sum(ri.quantity), 0) into v_returned from public.return_items ri join public.return_records rr on rr.id = ri.return_id where rr.invoice_id = v_order.invoice_id and rr.type = 'sale' and ri.name = v_order_item.product_title;
    if v_qty > v_sold - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المباعة: %', v_order_item.product_title; end if;
    insert into public.return_items (user_id, return_id, name, unit_price, quantity) values (auth.uid(), v_return_id, v_order_item.product_title, v_order_item.unit_price, v_qty);
    v_total := v_total + v_order_item.unit_price * v_qty;
    select * into v_stock from public.stock_items where id = v_order_item.stock_item_id and user_id = auth.uid() for update;
    if not found then raise exception 'صنف المخزون غير موجود: %', v_order_item.product_title; end if;
    update public.stock_items set quantity = quantity + v_qty, updated_at = now() where id = v_stock.id;
  end loop;
  update public.return_records set total_amount = v_total where id = v_return_id;
  select coalesce(sum(rr.total_amount), 0) into v_returned_total from public.return_records rr where rr.invoice_id = v_order.invoice_id and rr.type = 'sale';
  update public.invoices set total = greatest(0, total - v_total), paid = least(greatest(0, total - v_total), down_payment + coalesce((select sum(p.amount) from public.payments p where p.invoice_id = v_invoice.id), 0)), status = case when v_returned_total >= v_order.subtotal then 'cancelled' when paid >= greatest(0, total - v_total) then 'paid' else 'pending' end where id = v_invoice.id;
  update public.store_orders set return_id = v_return_id, status = case when v_returned_total >= v_order.subtotal then 'cancelled' else status end, updated_at = now() where id = v_order.id;
  update public.shipments set status = 'returned' where invoice_id = v_order.invoice_id and v_returned_total >= v_order.subtotal;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'returned', jsonb_build_object('return_id', v_return_id, 'amount', v_total, 'full_return', v_returned_total >= v_order.subtotal));
  return v_return_id;
end;
$$;

grant execute on function public.create_storefront_sale_return(uuid, text, jsonb) to authenticated;

create or replace function public.reverse_storefront_sale_return(p_return_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_return public.return_records; v_item record; v_stock public.stock_items; v_order public.store_orders;
begin
  select rr.* into v_return from public.return_records rr where rr.id = p_return_id and rr.user_id = auth.uid() and rr.type = 'sale' for update;
  if not found then raise exception 'المرتجع غير موجود أو غير مسموح'; end if;
  for v_item in select * from public.return_items where return_id = p_return_id loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_item.name for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون لا يسمح بعكس المرتجع: %', v_item.name; end if;
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
  end loop;
  update public.invoices set total = total + v_return.total_amount, paid = least(total + v_return.total_amount, paid), status = case when paid >= total + v_return.total_amount then 'paid' else 'pending' end where id = v_return.invoice_id and user_id = auth.uid();
  select * into v_order from public.store_orders where return_id = p_return_id and storefront_id in (select id from public.storefronts where owner_id = auth.uid()) for update;
  if found then
    update public.store_orders set return_id = null, status = 'invoiced', updated_at = now() where id = v_order.id;
    perform set_config('app.allow_shipment_reversal', 'on', true);
    update public.shipments set status = 'pending' where invoice_id = v_return.invoice_id and user_id = auth.uid();
    insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'return_reversed', jsonb_build_object('return_id', p_return_id));
  end if;
  delete from public.return_records where id = p_return_id;
end;
$$;

grant execute on function public.reverse_storefront_sale_return(uuid) to authenticated;



-- =============================================================
-- MIGRATION 26/48: 20260827160000_atomic_storefront_coupon_orders.sql
-- =============================================================

drop function if exists public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid);

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null, p_coupon_code text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_item jsonb; v_product public.storefront_products; v_stock public.stock_items;
  v_coupon public.storefront_coupons; v_qty integer; v_subtotal numeric := 0; v_shipping_fee numeric := 0;
  v_discount numeric := 0; v_owner uuid; v_minimum numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  select owner_id, minimum_order into v_owner, v_minimum from public.storefronts where id = p_storefront_id and is_published;
  if not found then raise exception 'المتجر غير متاح'; end if;
  if p_shipping_zone_id is not null then
    select z.delivery_cost into v_shipping_fee from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active where z.id = p_shipping_zone_id and z.user_id = v_owner;
    if not found then raise exception 'منطقة التوصيل غير متاحة'; end if;
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from public.stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    v_subtotal := v_subtotal + v_product.display_price * v_qty;
  end loop;
  if v_minimum > 0 and v_subtotal < v_minimum then raise exception 'الحد الأدنى للطلب هو %', v_minimum; end if;
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from public.storefront_coupons where storefront_id = p_storefront_id and upper(code) = upper(trim(p_coupon_code)) and active and now() >= starts_at and (ends_at is null or now() <= ends_at) and v_subtotal >= minimum_order and (max_uses is null or used_count < max_uses) for update;
    if not found then raise exception 'الكوبون غير صالح أو انتهت مرات استخدامه'; end if;
    v_discount := least(v_subtotal, case when v_coupon.discount_type = 'percentage' then round(v_subtotal * v_coupon.discount_value / 100, 2) else v_coupon.discount_value end);
  end if;
  insert into public.store_orders (storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes, order_type, shipping_fee, subtotal, total, coupon_id, discount_amount)
    values (p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), p_order_type, v_shipping_fee, v_subtotal, greatest(0, v_subtotal + v_shipping_fee - v_discount), case when v_coupon.id is null then null else v_coupon.id end, v_discount) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    insert into public.store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
      values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty, jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
  end loop;
  if v_coupon.id is not null then update public.storefront_coupons set used_count = used_count + 1 where id = v_coupon.id; end if;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront', 'shipping_zone_id', p_shipping_zone_id, 'shipping_fee', v_shipping_fee, 'coupon_id', v_coupon.id, 'discount_amount', v_discount));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status, 'shipping_fee', v_shipping_fee, 'discount_amount', v_discount, 'total', greatest(0, v_subtotal + v_shipping_fee - v_discount));
end;
$$;

grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text) to anon, authenticated;



-- =============================================================
-- MIGRATION 27/48: 20260827170000_storefront_public_minimum_order.sql
-- =============================================================

create or replace function public.get_public_storefront_with_settings(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(public.get_public_storefront(p_slug), '{storefront,banner_url}', to_jsonb(s.banner_url)),
            '{storefront,theme_key}', to_jsonb(s.theme_key)
          ),
          '{storefront,seo_title}', to_jsonb(s.seo_title)
        ),
        '{storefront,seo_description}', to_jsonb(s.seo_description)
      ),
      '{storefront,social_links}', s.social_links
    ),
    '{storefront,minimum_order}', to_jsonb(s.minimum_order)
  ) from public.storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

grant execute on function public.get_public_storefront_with_settings(text) to anon, authenticated;



-- =============================================================
-- MIGRATION 28/48: 20260827180000_unified_storefront_shipment_state.sql
-- =============================================================

create or replace function public.assign_storefront_shipment(
  p_invoice_id uuid, p_carrier_id uuid, p_zone_id uuid, p_tracking_number text
) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments;
begin
  select sh.* into v_shipment from public.shipments sh where sh.invoice_id = p_invoice_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'المندوب غير متاح'; end if;
  if p_zone_id is not null and not exists (select 1 from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id)) then raise exception 'منطقة الشحن غير متاحة'; end if;
  update public.shipments set carrier_id = p_carrier_id, zone_id = p_zone_id, tracking_number = nullif(trim(coalesce(p_tracking_number, '')), '') where id = v_shipment.id;
end;
$$;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders;
begin
  select sh.* into v_shipment from public.shipments sh where sh.id = p_shipment_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status = 'delivered' and p_status <> 'delivered' then raise exception 'لا يمكن تغيير شحنة تم تسليمها'; end if;
  if v_shipment.status = 'cancelled' and p_status <> 'cancelled' then raise exception 'لا يمكن إعادة فتح شحنة ملغاة'; end if;
  if p_status = 'shipped' and v_shipment.status not in ('pending', 'processing') then raise exception 'انتقال حالة الشحنة غير مسموح'; end if;
  if p_status = 'delivered' and v_shipment.status <> 'shipped' then raise exception 'يجب شحن الطلب أولًا'; end if;
  if p_status = 'returned' and v_shipment.status not in ('shipped', 'delivered') then raise exception 'لا يمكن إرجاع الشحنة في حالتها الحالية'; end if;
  update public.shipments set status = p_status, actual_delivery_date = case when p_status = 'delivered' then now() else actual_delivery_date end where id = v_shipment.id;
  if v_shipment.invoice_id is not null then
    select * into v_order from public.store_orders where invoice_id = v_shipment.invoice_id for update;
    if found then
      if p_status = 'shipped' then update public.store_orders set status = 'shipped', updated_at = now() where id = v_order.id;
      elsif p_status = 'delivered' then update public.store_orders set status = 'delivered', updated_at = now() where id = v_order.id;
      elsif p_status = 'returned' then update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = v_order.id;
      end if;
      insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason));
    end if;
  end if;
end;
$$;

grant execute on function public.assign_storefront_shipment(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.update_storefront_shipment_status(uuid, public.shipment_status, text) to authenticated;



-- =============================================================
-- MIGRATION 29/48: 20260827190000_invoice_item_quantity.sql
-- =============================================================

alter table public.invoice_items
  add column if not exists quantity integer not null default 1;

alter table public.invoice_items
  drop constraint if exists invoice_items_quantity_check;

alter table public.invoice_items
  add constraint invoice_items_quantity_check check (quantity > 0);

alter table public.invoice_items
  drop constraint if exists invoice_items_money_scale_check;

alter table public.invoice_items
  add constraint invoice_items_money_scale_check check (
    cost = round(cost, 2) and price = round(price, 2)
  );



-- =============================================================
-- MIGRATION 30/48: 20260827200000_audit_events.sql
-- =============================================================

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  record_type text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  order_id uuid references public.store_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_user_created_idx on public.audit_events(user_id, created_at desc);
create index if not exists audit_events_record_idx on public.audit_events(record_type, record_id, created_at desc);
create index if not exists audit_events_order_idx on public.audit_events(order_id, created_at desc);

alter table public.audit_events enable row level security;
drop policy if exists "Users read own audit events" on public.audit_events;
DROP POLICY IF EXISTS "Users read own audit events" ON public.audit_events;
create policy "Users read own audit events" on public.audit_events
  for select to authenticated using (user_id = auth.uid());
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_user uuid := coalesce((v_after->>'user_id')::uuid, (v_before->>'user_id')::uuid, auth.uid());
  v_record_id uuid := coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid);
  v_order_id uuid := coalesce((v_after->>'order_id')::uuid, (v_before->>'order_id')::uuid);
  v_reason text := coalesce(v_after->>'reason', v_after->>'status_reason', v_after->>'notes', v_before->>'reason', v_before->>'status_reason', v_before->>'notes');
begin
  if v_user is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'store_orders' then v_order_id := v_record_id; end if;
  insert into public.audit_events (user_id, actor_user_id, operation, record_type, record_id, before_data, after_data, reason, order_id)
  values (v_user, auth.uid(), lower(tg_op), tg_table_name, v_record_id, v_before, v_after, v_reason, v_order_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['invoices', 'invoice_items', 'payments', 'purchases', 'purchase_items', 'stock_items', 'stock_adjustments', 'return_records', 'return_items', 'store_orders', 'shipments'] loop
    execute format('drop trigger if exists audit_%I on public.%I', v_table, v_table);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', v_table, v_table);
  end loop;
end $$;



-- =============================================================
-- MIGRATION 31/48: 20260827210000_atomic_sale_returns.sql
-- =============================================================

create or replace function public.create_sale_return(
  p_invoice_id uuid, p_reason text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.invoices; v_return_id uuid; v_item jsonb; v_stock public.stock_items;
  v_name text; v_qty integer; v_price numeric; v_sold integer; v_returned integer; v_total numeric := 0;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب المرتجع مطلوب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر صنفًا واحدًا على الأقل'; end if;
  insert into public.return_records (user_id, invoice_id, type, total_amount, reason)
    values (auth.uid(), p_invoice_id, 'sale', 0, trim(p_reason)) returning id into v_return_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_price := (v_item->>'unit_price')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;
    select coalesce(sum(quantity), 0) into v_sold from public.invoice_items where invoice_id = p_invoice_id and name = v_name;
    select coalesce(sum(ri.quantity), 0) into v_returned from public.return_items ri join public.return_records rr on rr.id = ri.return_id where rr.invoice_id = p_invoice_id and rr.type = 'sale' and ri.name = v_name;
    if v_qty > v_sold - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المباعة: %', v_name; end if;
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if not found then raise exception 'صنف المخزون غير موجود: %', v_name; end if;
    insert into public.return_items (user_id, return_id, name, unit_price, quantity)
      values (auth.uid(), v_return_id, v_name, round(v_price, 2), v_qty);
    update public.stock_items set quantity = quantity + v_qty, updated_at = now() where id = v_stock.id;
    v_total := v_total + round(v_price, 2) * v_qty;
  end loop;
  update public.return_records set total_amount = round(v_total, 2) where id = v_return_id;
  update public.invoices i
  set total = greatest(0, i.total - round(v_total, 2)),
      paid = least(greatest(0, i.total - round(v_total, 2)), i.down_payment + coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0)),
      status = case when i.down_payment + coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) >= greatest(0, i.total - round(v_total, 2)) then 'paid' else 'pending' end
  where i.id = p_invoice_id;
  return v_return_id;
end;
$$;

revoke all on function public.create_sale_return(uuid, text, jsonb) from public;
grant execute on function public.create_sale_return(uuid, text, jsonb) to authenticated;


-- =============================================================
-- MIGRATION 32/48: 20260827220000_installment_schedule.sql
-- =============================================================

alter table public.invoices
  add column if not exists installment_count integer not null default 1,
  add column if not exists last_installment_amount numeric(12,2) not null default 0;

create table if not exists public.invoice_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (invoice_id, installment_number)
);

alter table public.invoice_installments enable row level security;
drop policy if exists "Users manage own invoice installments" on public.invoice_installments;
DROP POLICY IF EXISTS "Users manage own invoice installments" ON public.invoice_installments;
create policy "Users manage own invoice installments" on public.invoice_installments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.invoice_installments to authenticated;

create or replace function public.invoice_store_order_installment(
  p_order_id uuid, p_down_payment numeric, p_monthly_installment numeric, p_first_due_date date, p_installment_count integer default 1
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid; v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
  v_remaining numeric; v_base numeric; v_accumulated numeric := 0; v_amount numeric; v_count integer;
  v_carrier_id uuid;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' or v_order.reservation_expires_at <= now() then raise exception 'انتهت مهلة الحجز أو الطلب غير مقبول'; end if;
  if v_order.order_type <> 'installment_request' then raise exception 'الطلب ليس طلب تقسيط'; end if;
  v_count := greatest(1, coalesce(p_installment_count, 1));
  if p_down_payment is null or p_down_payment < 0 or p_down_payment > v_order.total then raise exception 'المقدم غير صحيح'; end if;
  v_remaining := round(v_order.total - p_down_payment, 2);
  if v_remaining > 0 and (p_monthly_installment is null or p_monthly_installment <= 0) then raise exception 'القسط الشهري يجب أن يكون أكبر من صفر'; end if;
  if p_first_due_date is null then raise exception 'تاريخ أول استحقاق مطلوب'; end if;
  v_base := round(v_remaining / v_count, 2);
  select owner_id into v_owner from public.storefronts where id = v_order.storefront_id;
  select id into v_customer_id from public.customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then insert into public.customers (user_id, name, phone, address, customer_type) values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address, 'installment') returning id into v_customer_id; end if;
  insert into public.invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status, installment_count, last_installment_amount)
    values (v_owner, v_customer_id, v_order.total, p_down_payment, v_base, p_first_due_date, p_down_payment, concat('طلب متجر تقسيط #', v_order.public_number), 'pending', v_count, v_remaining - v_base * greatest(v_count - 1, 0)) returning id into v_invoice_id;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_reservation from public.stock_reservations where order_id = v_order.id and stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now() for update;
    if not found then raise exception 'انتهى حجز المنتج: %', v_item.product_title; end if;
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into public.invoice_items (user_id, invoice_id, name, cost, price, quantity) values (v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price, v_item.quantity);
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update public.stock_reservations set status = 'consumed', released_at = now() where id = v_reservation.id;
  end loop;
  for v_count in 1..greatest(1, coalesce(p_installment_count, 1)) loop
    if v_count = greatest(1, coalesce(p_installment_count, 1)) then v_amount := round(v_remaining - v_accumulated, 2); else v_amount := v_base; end if;
    insert into public.invoice_installments (user_id, invoice_id, installment_number, due_date, amount) values (v_owner, v_invoice_id, v_count, p_first_due_date + ((v_count - 1) * interval '1 month'), v_amount);
    v_accumulated := round(v_accumulated + v_amount, 2);
  end loop;
  if v_accumulated <> v_remaining then raise exception 'تعذر مطابقة مجموع الأقساط مع المتبقي'; end if;
  if v_order.shipping_zone_id is not null then select carrier_id into v_carrier_id from public.shipping_zones where id = v_order.shipping_zone_id; end if;
  insert into public.shipments (user_id, invoice_id, carrier_id, zone_id, status, recipient_name, recipient_phone, delivery_address, notes) values (v_owner, v_invoice_id, v_carrier_id, v_order.shipping_zone_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update public.store_orders set invoice_id = v_invoice_id, status = 'invoiced', status_reason = null, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id, 'installment_count', greatest(1, coalesce(p_installment_count, 1)), 'down_payment', p_down_payment));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false, 'installment_count', greatest(1, coalesce(p_installment_count, 1)), 'remaining', v_remaining);
end;
$$;

revoke all on function public.invoice_store_order_installment(uuid, numeric, numeric, date, integer) from public;
grant execute on function public.invoice_store_order_installment(uuid, numeric, numeric, date, integer) to authenticated;



-- =============================================================
-- MIGRATION 33/48: 20260827230000_state_machine_guards.sql
-- =============================================================

create or replace function public.guard_store_order_transition()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if current_setting('app.allow_shipment_reversal', true) = 'on'
    and old.status = 'returned' and new.status = 'pending' then
    return new;
  end if;
  if not (
    (old.status = 'submitted' and new.status in ('under_review', 'needs_info', 'accepted', 'rejected', 'cancelled')) or
    (old.status = 'under_review' and new.status in ('needs_info', 'accepted', 'rejected', 'cancelled')) or
    (old.status = 'needs_info' and new.status in ('under_review', 'accepted', 'rejected', 'cancelled')) or
    (old.status = 'accepted' and new.status = 'invoiced') or
    (old.status = 'invoiced' and new.status = 'shipped') or
    (old.status = 'shipped' and new.status = 'delivered')
  ) then raise exception 'انتقال حالة الطلب غير مسموح: % إلى %', old.status, new.status; end if;
  return new;
end;
$$;

drop trigger if exists store_order_state_guard on public.store_orders;
DROP TRIGGER IF EXISTS store_order_state_guard ON public.store_orders;
create trigger store_order_state_guard before update of status on public.store_orders for each row execute function public.guard_store_order_transition();

create or replace function public.guard_shipment_transition()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status = 'processing') or
    (old.status in ('pending', 'processing') and new.status = 'shipped') or
    (old.status = 'shipped' and new.status = 'delivered') or
    (old.status in ('shipped', 'delivered') and new.status = 'returned') or
    (old.status in ('pending', 'processing') and new.status = 'cancelled')
  ) then raise exception 'انتقال حالة الشحنة غير مسموح: % إلى %', old.status, new.status; end if;
  return new;
end;
$$;

drop trigger if exists shipment_state_guard on public.shipments;
DROP TRIGGER IF EXISTS shipment_state_guard ON public.shipments;
create trigger shipment_state_guard before update of status on public.shipments for each row execute function public.guard_shipment_transition();



-- =============================================================
-- MIGRATION 34/48: 20260827240000_order_idempotency_and_shipment_uniqueness.sql
-- =============================================================

alter table public.store_orders add column if not exists idempotency_key text;
create unique index if not exists store_orders_idempotency_key_idx on public.store_orders(storefront_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists shipments_invoice_unique_idx on public.shipments(invoice_id) where invoice_id is not null;

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null, p_coupon_code text default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing public.store_orders; v_result jsonb; v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_key is null then raise exception 'مفتاح الطلب مطلوب'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_storefront_id::text || ':' || v_key, 0));
  select * into v_existing from public.store_orders where storefront_id = p_storefront_id and idempotency_key = v_key for update;
  if found then return jsonb_build_object('id', v_existing.id, 'public_number', v_existing.public_number, 'status', v_existing.status, 'shipping_fee', v_existing.shipping_fee, 'discount_amount', v_existing.discount_amount, 'total', v_existing.total, 'already_submitted', true); end if;
  v_result := public.submit_store_order(p_storefront_id, p_customer_name, p_customer_phone, p_delivery_address, p_delivery_area, p_notes, p_order_type, p_items, p_shipping_zone_id, p_coupon_code);
  update public.store_orders set idempotency_key = v_key where id = (v_result->>'id')::uuid;
  return v_result || jsonb_build_object('already_submitted', false);
end;
$$;

revoke all on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text, text) from public;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text, text) to anon, authenticated;



-- =============================================================
-- MIGRATION 35/48: 20260827250000_atomic_manual_shipments.sql
-- =============================================================

create or replace function public.create_invoice_shipment(
  p_invoice_id uuid,
  p_carrier_id uuid default null,
  p_zone_id uuid default null,
  p_tracking_number text default null
) returns public.shipments language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.invoices;
  v_customer public.customers;
  v_shipment public.shipments;
  v_tracking text := nullif(trim(coalesce(p_tracking_number, '')), '');
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'لا يمكن إنشاء شحنة لفاتورة ملغاة'; end if;
  if exists (select 1 from public.shipments where invoice_id = p_invoice_id) then raise exception 'يوجد شحنة مسجلة لهذه الفاتورة بالفعل'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'شركة الشحن غير متاحة'; end if;
  if p_zone_id is not null and not exists (select 1 from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id)) then raise exception 'منطقة الشحن غير متاحة'; end if;
  select * into v_customer from public.customers where id = v_invoice.customer_id and user_id = auth.uid();
  insert into public.shipments (user_id, invoice_id, carrier_id, zone_id, tracking_number, status, recipient_name, recipient_phone, delivery_address)
    values (auth.uid(), p_invoice_id, p_carrier_id, p_zone_id, v_tracking, 'pending', v_customer.name, v_customer.phone, v_customer.address)
    returning * into v_shipment;
  return v_shipment;
exception when unique_violation then
  raise exception 'يوجد شحنة مسجلة لهذه الفاتورة أو رقم التتبع مستخدم بالفعل';
end;
$$;

revoke all on function public.create_invoice_shipment(uuid, uuid, uuid, text) from public;
grant execute on function public.create_invoice_shipment(uuid, uuid, uuid, text) to authenticated;



-- =============================================================
-- MIGRATION 36/48: 20260827260000_shipping_timeline_and_zone_audit.sql
-- =============================================================

alter table public.shipments
  add column if not exists processing_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists status_updated_by uuid references auth.users(id) on delete set null;

create or replace function public.assign_storefront_shipment(
  p_invoice_id uuid, p_carrier_id uuid, p_zone_id uuid, p_tracking_number text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders; v_old_zone uuid;
begin
  select sh.* into v_shipment from public.shipments sh where sh.invoice_id = p_invoice_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'المندوب غير متاح'; end if;
  if p_zone_id is not null and not exists (select 1 from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id)) then raise exception 'منطقة الشحن غير متاحة'; end if;
  select * into v_order from public.store_orders where invoice_id = p_invoice_id and storefront_id in (select id from public.storefronts where owner_id = auth.uid()) for update;
  v_old_zone := v_shipment.zone_id;
  if v_order.id is not null and v_old_zone is distinct from p_zone_id and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب تغيير منطقة الشحن مطلوب'; end if;
  update public.shipments set carrier_id = p_carrier_id, zone_id = p_zone_id, tracking_number = nullif(trim(coalesce(p_tracking_number, '')), '') where id = v_shipment.id;
  if v_order.id is not null and v_old_zone is distinct from p_zone_id then
    insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'shipping_zone_changed', jsonb_build_object('from_zone_id', v_old_zone, 'to_zone_id', p_zone_id, 'reason', trim(p_reason)));
  end if;
end;
$$;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders;
begin
  select sh.* into v_shipment from public.shipments sh where sh.id = p_shipment_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status = 'delivered' and p_status <> 'delivered' then raise exception 'لا يمكن تغيير شحنة تم تسليمها'; end if;
  if v_shipment.status = 'cancelled' and p_status <> 'cancelled' then raise exception 'لا يمكن إعادة فتح شحنة ملغاة'; end if;
  if p_status = 'processing' and v_shipment.status <> 'pending' then raise exception 'يجب أن تبدأ الشحنة من قيد الانتظار'; end if;
  if p_status = 'shipped' and v_shipment.status <> 'processing' then raise exception 'يجب تجهيز الشحنة أولًا'; end if;
  if p_status = 'delivered' and v_shipment.status <> 'shipped' then raise exception 'يجب شحن الطلب أولًا'; end if;
  if p_status = 'returned' and v_shipment.status not in ('shipped', 'delivered') then raise exception 'لا يمكن إرجاع الشحنة في حالتها الحالية'; end if;
  update public.shipments set status = p_status, processing_at = case when p_status = 'processing' then coalesce(processing_at, now()) else processing_at end, shipped_at = case when p_status = 'shipped' then now() else shipped_at end, delivered_at = case when p_status = 'delivered' then now() else delivered_at end, returned_at = case when p_status = 'returned' then now() else returned_at end, actual_delivery_date = case when p_status = 'delivered' then now() else actual_delivery_date end, status_updated_by = auth.uid() where id = v_shipment.id;
  if v_shipment.invoice_id is not null then
    select * into v_order from public.store_orders where invoice_id = v_shipment.invoice_id for update;
    if found and p_status in ('shipped', 'delivered') then update public.store_orders set status = p_status::text, updated_at = now() where id = v_order.id; end if;
    if found and p_status = 'returned' then update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = v_order.id; end if;
    if found then insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason)); end if;
  end if;
end;
$$;

revoke all on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) from public;
grant execute on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) to authenticated;


-- =============================================================
-- MIGRATION 37/48: 20260827270000_shipping_zone_delete_safety.sql
-- =============================================================

alter table public.shipments drop constraint if exists shipments_zone_id_fkey;
alter table public.shipments add constraint shipments_zone_id_fkey foreign key (zone_id) references public.shipping_zones(id) on delete set null;

alter table public.shipping_zones drop constraint if exists shipping_zones_carrier_id_fkey;
alter table public.shipping_zones add constraint shipping_zones_carrier_id_fkey foreign key (carrier_id) references public.shipping_carriers(id) on delete restrict;


-- =============================================================
-- MIGRATION 38/48: 20260827280000_atomic_shipment_assignment.sql
-- =============================================================

create or replace function public.assign_storefront_shipment(
  p_invoice_id uuid, p_carrier_id uuid, p_zone_id uuid, p_tracking_number text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment public.shipments; v_order public.store_orders; v_old_zone uuid; v_fee numeric := 0;
begin
  select * into v_shipment from public.shipments where invoice_id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status in ('shipped', 'delivered', 'returned', 'cancelled') and v_shipment.zone_id is distinct from p_zone_id then raise exception 'لا يمكن تغيير المنطقة بعد بدء تنفيذ الشحنة'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'شركة الشحن غير متاحة'; end if;
  if p_zone_id is not null then
    select delivery_cost into v_fee from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id);
    if not found then raise exception 'منطقة الشحن غير متاحة'; end if;
  end if;
  select * into v_order from public.store_orders where invoice_id = p_invoice_id and storefront_id in (select id from public.storefronts where owner_id = auth.uid()) for update;
  v_old_zone := v_shipment.zone_id;
  if v_order.id is not null and v_old_zone is distinct from p_zone_id and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب تغيير منطقة الشحن مطلوب'; end if;
  update public.shipments set carrier_id = p_carrier_id, zone_id = p_zone_id, tracking_number = nullif(trim(coalesce(p_tracking_number, '')), '') where id = v_shipment.id;
  if v_order.id is not null then
    update public.store_orders set shipping_zone_id = p_zone_id, shipping_fee = v_fee, total = greatest(0, subtotal + v_fee - coalesce(discount_amount, 0)), updated_at = now() where id = v_order.id;
    if v_old_zone is distinct from p_zone_id then
      insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'shipping_zone_changed', jsonb_build_object('from_zone_id', v_old_zone, 'to_zone_id', p_zone_id, 'old_fee', v_order.shipping_fee, 'new_fee', v_fee, 'reason', trim(p_reason)));
    end if;
  end if;
end;
$$;

revoke all on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) from public;
grant execute on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) to authenticated;


-- =============================================================
-- MIGRATION 39/48: 20260828120418_3aae12fe-9667-4f85-a42f-6c19235df24f.sql
-- =============================================================

alter table public.shipments
  add column if not exists shipping_cost numeric not null default 0,
  add column if not exists cod_amount numeric not null default 0,
  add column if not exists collection_status text not null default 'uncollected',
  add column if not exists collected_at timestamptz,
  add column if not exists settled_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shipments_collection_status_chk') then
    alter table public.shipments add constraint shipments_collection_status_chk
      check (collection_status in ('uncollected', 'collected', 'settled'));
  end if;
end $$;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders; v_due numeric;
begin
  select sh.* into v_shipment from public.shipments sh where sh.id = p_shipment_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status = 'delivered' and p_status <> 'delivered' then raise exception 'لا يمكن تغيير شحنة تم تسليمها'; end if;
  if v_shipment.status = 'cancelled' and p_status <> 'cancelled' then raise exception 'لا يمكن إعادة فتح شحنة ملغاة'; end if;
  if p_status = 'processing' and v_shipment.status <> 'pending' then raise exception 'يجب أن تبدأ الشحنة من قيد الانتظار'; end if;
  if p_status = 'shipped' and v_shipment.status <> 'processing' then raise exception 'يجب تجهيز الشحنة أولًا'; end if;
  if p_status = 'delivered' and v_shipment.status <> 'shipped' then raise exception 'يجب شحن الطلب أولًا'; end if;
  if p_status = 'returned' and v_shipment.status not in ('shipped', 'delivered') then raise exception 'لا يمكن إرجاع الشحنة في حالتها الحالية'; end if;

  update public.shipments set status = p_status,
    processing_at = case when p_status = 'processing' then coalesce(processing_at, now()) else processing_at end,
    shipped_at = case when p_status = 'shipped' then now() else shipped_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    returned_at = case when p_status = 'returned' then now() else returned_at end,
    actual_delivery_date = case when p_status = 'delivered' then now() else actual_delivery_date end,
    collection_status = case when p_status = 'delivered' and coalesce(cod_amount, 0) > 0 and collection_status = 'uncollected' then 'collected' else collection_status end,
    collected_at = case when p_status = 'delivered' and coalesce(cod_amount, 0) > 0 and collected_at is null then now() else collected_at end,
    status_updated_by = auth.uid()
  where id = v_shipment.id;

  if p_status = 'delivered' then
    if v_shipment.invoice_id is not null and coalesce(v_shipment.cod_amount, 0) > 0 then
      select greatest(0, i.total - i.paid) into v_due from public.invoices i where i.id = v_shipment.invoice_id and i.user_id = auth.uid();
      if coalesce(v_due, 0) > 0 then
        insert into public.payments (user_id, invoice_id, amount, paid_at)
        values (auth.uid(), v_shipment.invoice_id, least(v_due, v_shipment.cod_amount), now());
        perform public.recalculate_invoice_paid(v_shipment.invoice_id);
      end if;
    end if;
    if coalesce(v_shipment.shipping_cost, 0) > 0 then
      insert into public.expenses (user_id, amount, category, expense_date, notes)
      values (auth.uid(), v_shipment.shipping_cost, 'transport', current_date,
        concat('تكلفة شحن - شحنة ', coalesce(v_shipment.tracking_number, v_shipment.id::text)));
    end if;
  end if;

  if v_shipment.invoice_id is not null then
    select * into v_order from public.store_orders where invoice_id = v_shipment.invoice_id for update;
    if found and p_status in ('shipped', 'delivered') then update public.store_orders set status = p_status::text, updated_at = now() where id = v_order.id; end if;
    if found and p_status = 'returned' then update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = v_order.id; end if;
    if found then insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason)); end if;
  end if;
end;
$$;

create or replace function public.settle_carrier_collections(p_carrier_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid()) then
    raise exception 'المندوب غير موجود أو غير مسموح';
  end if;
  with upd as (
    update public.shipments set collection_status = 'settled', settled_at = now()
    where user_id = auth.uid() and carrier_id = p_carrier_id and collection_status = 'collected'
    returning id
  ) select count(*) into v_count from upd;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.settle_carrier_collections(uuid) from public;
grant execute on function public.settle_carrier_collections(uuid) to authenticated;


-- =============================================================
-- MIGRATION 40/48: 20260828120439_3f0ade12-0058-4174-8ea8-58f75ed7c82c.sql
-- =============================================================

alter table public.shipping_carriers enable row level security;
alter table public.shipping_zones enable row level security;


-- =============================================================
-- MIGRATION 41/48: 20260831142054_8e1ca3de-e0c8-4208-bc08-cb653592b5b4.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS  public.carrier_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier_id uuid NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'settlement' CHECK (type IN ('settlement','partial_payment','return_penalty','bonus','adjustment')),
  amount numeric NOT NULL DEFAULT 0,
  settled_on timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text NOT NULL DEFAULT 'cash',
  reference_number text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_settlements TO authenticated;
GRANT ALL ON public.carrier_settlements TO service_role;
ALTER TABLE public.carrier_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own carrier settlements" ON public.carrier_settlements;
CREATE POLICY "own carrier settlements" ON public.carrier_settlements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_carrier_settlements_carrier ON public.carrier_settlements(carrier_id, settled_on DESC);

CREATE TABLE IF NOT EXISTS  public.delivery_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  outcome text NOT NULL DEFAULT 'failed' CHECK (outcome IN ('delivered','partial','no_answer','refused','wrong_address','postponed','failed')),
  reason text,
  delivered_amount numeric NOT NULL DEFAULT 0,
  next_attempt_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_attempts TO authenticated;
GRANT ALL ON public.delivery_attempts TO service_role;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own delivery attempts" ON public.delivery_attempts;
CREATE POLICY "own delivery attempts" ON public.delivery_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_delivery_attempts_shipment ON public.delivery_attempts(shipment_id, created_at DESC);

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS weight_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pieces integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expected_delivery_date date;


-- =============================================================
-- MIGRATION 42/48: 20260831143640_e69f2e41-d93a-4031-bc8e-a8b4bdfdc3f4.sql
-- =============================================================

create table IF NOT EXISTS  public.shipment_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  kind text not null check (kind in ('late', 'status_update')),
  status public.shipment_status,
  title text not null,
  body text not null,
  tracking_identifier text,
  expected_delivery_date date,
  dedupe_key text not null,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

grant select, insert, update, delete on public.shipment_notifications to authenticated;
grant all on public.shipment_notifications to service_role;

alter table public.shipment_notifications enable row level security;

create policy "Users manage own shipment notifications"
on public.shipment_notifications
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index shipment_notifications_user_created_idx
  on public.shipment_notifications (user_id, created_at desc);
create index shipment_notifications_active_late_idx
  on public.shipment_notifications (user_id, shipment_id)
  where kind = 'late' and resolved_at is null;

create or replace function public.set_shipment_expected_delivery_date()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_days integer;
begin
  if new.zone_id is not null and (
    tg_op = 'INSERT'
    or new.expected_delivery_date is null
    or new.zone_id is distinct from old.zone_id
  ) then
    select greatest(coalesce(z.estimated_days, 3), 0)
      into v_days
    from public.shipping_zones z
    where z.id = new.zone_id;
    new.expected_delivery_date := coalesce(new.created_at, now())::date + coalesce(v_days, 3);
  elsif new.expected_delivery_date is null and tg_op = 'INSERT' then
    new.expected_delivery_date := coalesce(new.created_at, now())::date + 3;
  end if;
  return new;
end;
$$;

drop trigger if exists shipments_set_expected_delivery_date on public.shipments;
create trigger shipments_set_expected_delivery_date
before insert or update of zone_id on public.shipments
for each row execute function public.set_shipment_expected_delivery_date();

create or replace function public.sync_late_shipment_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;

  insert into public.shipment_notifications (
    user_id, shipment_id, kind, status, title, body,
    tracking_identifier, expected_delivery_date, dedupe_key
  )
  select
    sh.user_id,
    sh.id,
    'late',
    sh.status,
    'شحنة متأخرة عن موعد التسليم',
    concat('الشحنة ', coalesce(so.public_number, sh.tracking_number, left(sh.id::text, 8)), ' تجاوزت موعد التسليم المتوقع ', sh.expected_delivery_date::text),
    coalesce(so.public_number, sh.tracking_number),
    sh.expected_delivery_date,
    concat('late:', sh.id::text, ':', sh.expected_delivery_date::text)
  from public.shipments sh
  left join public.store_orders so on so.invoice_id = sh.invoice_id
  where sh.user_id = auth.uid()
    and sh.status in ('pending', 'processing', 'shipped')
    and sh.expected_delivery_date is not null
    and sh.expected_delivery_date < current_date
  on conflict (user_id, dedupe_key) do update
    set status = excluded.status,
        title = excluded.title,
        body = excluded.body,
        tracking_identifier = excluded.tracking_identifier,
        resolved_at = null;

  get diagnostics v_count = row_count;

  update public.shipment_notifications n
  set resolved_at = coalesce(n.resolved_at, now())
  where n.user_id = auth.uid()
    and n.kind = 'late'
    and n.resolved_at is null
    and not exists (
      select 1 from public.shipments sh
      where sh.id = n.shipment_id
        and sh.user_id = auth.uid()
        and sh.status in ('pending', 'processing', 'shipped')
        and sh.expected_delivery_date is not null
        and sh.expected_delivery_date < current_date
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.sync_late_shipment_notifications() from public;
grant execute on function public.sync_late_shipment_notifications() to authenticated;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments;
  v_order public.store_orders;
  v_due numeric;
  v_tracking_identifier text;
begin
  select sh.* into v_shipment from public.shipments sh where sh.id = p_shipment_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status = 'delivered' and p_status <> 'delivered' then raise exception 'لا يمكن تغيير شحنة تم تسليمها'; end if;
  if v_shipment.status = 'cancelled' and p_status <> 'cancelled' then raise exception 'لا يمكن إعادة فتح شحنة ملغاة'; end if;
  if p_status = 'processing' and v_shipment.status <> 'pending' then raise exception 'يجب أن تبدأ الشحنة من قيد الانتظار'; end if;
  if p_status = 'shipped' and v_shipment.status <> 'processing' then raise exception 'يجب تجهيز الشحنة أولًا'; end if;
  if p_status = 'delivered' and v_shipment.status <> 'shipped' then raise exception 'يجب شحن الطلب أولًا'; end if;
  if p_status = 'returned' and v_shipment.status not in ('shipped', 'delivered') then raise exception 'لا يمكن إرجاع الشحنة في حالتها الحالية'; end if;

  update public.shipments set status = p_status,
    processing_at = case when p_status = 'processing' then coalesce(processing_at, now()) else processing_at end,
    shipped_at = case when p_status = 'shipped' then now() else shipped_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    returned_at = case when p_status = 'returned' then now() else returned_at end,
    actual_delivery_date = case when p_status = 'delivered' then now() else actual_delivery_date end,
    collection_status = case when p_status = 'delivered' and coalesce(cod_amount, 0) > 0 and collection_status = 'uncollected' then 'collected' else collection_status end,
    collected_at = case when p_status = 'delivered' and coalesce(cod_amount, 0) > 0 and collected_at is null then now() else collected_at end,
    status_updated_by = auth.uid()
  where id = v_shipment.id;

  if p_status = 'delivered' then
    if v_shipment.invoice_id is not null and coalesce(v_shipment.cod_amount, 0) > 0 then
      select greatest(0, i.total - i.paid) into v_due from public.invoices i where i.id = v_shipment.invoice_id and i.user_id = auth.uid();
      if coalesce(v_due, 0) > 0 then
        insert into public.payments (user_id, invoice_id, amount, paid_at)
        values (auth.uid(), v_shipment.invoice_id, least(v_due, v_shipment.cod_amount), now());
        perform public.recalculate_invoice_paid(v_shipment.invoice_id);
      end if;
    end if;
    if coalesce(v_shipment.shipping_cost, 0) > 0 then
      insert into public.expenses (user_id, amount, category, expense_date, notes)
      values (auth.uid(), v_shipment.shipping_cost, 'transport', current_date,
        concat('تكلفة شحن - شحنة ', coalesce(v_shipment.tracking_number, v_shipment.id::text)));
    end if;
  end if;

  if v_shipment.invoice_id is not null then
    select * into v_order from public.store_orders where invoice_id = v_shipment.invoice_id for update;
    if found and p_status in ('shipped', 'delivered') then update public.store_orders set status = p_status::text, updated_at = now() where id = v_order.id; end if;
    if found and p_status = 'returned' then update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = v_order.id; end if;
    if found then
      insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
      values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason));
      v_tracking_identifier := v_order.public_number;
    end if;
  end if;

  v_tracking_identifier := coalesce(v_tracking_identifier, v_shipment.tracking_number);
  insert into public.shipment_notifications (
    user_id, shipment_id, kind, status, title, body, tracking_identifier, expected_delivery_date, dedupe_key
  ) values (
    auth.uid(), v_shipment.id, 'status_update', p_status,
    'تحديث حالة الشحنة',
    concat('تم تغيير حالة شحنة ', coalesce(v_tracking_identifier, left(v_shipment.id::text, 8)), ' إلى ', p_status::text, '. رابط التتبع جاهز للإرسال للعميل.'),
    v_tracking_identifier,
    v_shipment.expected_delivery_date,
    concat('status:', v_shipment.id::text, ':', p_status::text)
  ) on conflict (user_id, dedupe_key) do nothing;

  if p_status in ('delivered', 'returned', 'cancelled') then
    update public.shipment_notifications
    set resolved_at = coalesce(resolved_at, now())
    where user_id = auth.uid() and shipment_id = v_shipment.id and kind = 'late' and resolved_at is null;
  end if;
end;
$$;

revoke all on function public.update_storefront_shipment_status(uuid, public.shipment_status, text) from public;
grant execute on function public.update_storefront_shipment_status(uuid, public.shipment_status, text) to authenticated;

create or replace function public.get_public_order_status(p_public_number text, p_customer_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'public_number', o.public_number,
    'status', o.status,
    'order_type', o.order_type,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'total', o.total,
    'shipping_fee', o.shipping_fee,
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.product_title, 'quantity', i.quantity)) from public.store_order_items i where i.order_id = o.id), '[]'::jsonb)
  ) into v_result
  from public.store_orders o
  where upper(o.public_number) = upper(trim(p_public_number))
    and regexp_replace(o.customer_phone, '[^0-9]+', '', 'g') = regexp_replace(trim(p_customer_phone), '[^0-9]+', '', 'g');

  if v_result is not null then return v_result; end if;

  select jsonb_build_object(
    'public_number', coalesce(sh.tracking_number, left(sh.id::text, 8)),
    'status', case sh.status
      when 'pending' then 'submitted'
      when 'processing' then 'under_review'
      else sh.status::text
    end,
    'order_type', 'cash_on_delivery',
    'created_at', sh.created_at,
    'updated_at', coalesce(sh.actual_delivery_date, sh.created_at),
    'total', sh.cod_amount,
    'shipping_fee', sh.shipping_cost,
    'items', '[]'::jsonb
  ) into v_result
  from public.shipments sh
  where upper(coalesce(sh.tracking_number, '')) = upper(trim(p_public_number))
    and regexp_replace(coalesce(sh.recipient_phone, ''), '[^0-9]+', '', 'g') = regexp_replace(trim(p_customer_phone), '[^0-9]+', '', 'g')
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.get_public_order_status(text, text) from public;
grant execute on function public.get_public_order_status(text, text) to anon, authenticated;


-- =============================================================
-- MIGRATION 43/48: 20260831143701_8cdff5ab-8f66-4a50-a6a6-35dd2d366e5e.sql
-- =============================================================

alter function public.sync_late_shipment_notifications() security invoker;


-- =============================================================
-- MIGRATION 44/48: 20260901145154_55a33b50-feb3-415a-beb8-3ff9cb3eed63.sql
-- =============================================================

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serial_numbers text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.invoice_items
SET line_total = round(greatest(0, price * quantity - discount_amount) + tax_amount, 2)
WHERE line_total = 0;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_discount_pct_range CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD CONSTRAINT invoice_items_tax_pct_range CHECK (tax_pct >= 0 AND tax_pct <= 100),
  ADD CONSTRAINT invoice_items_nonnegative_amounts CHECK (discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS receipt_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS invoices_receipt_token_key ON public.invoices (receipt_token);

CREATE OR REPLACE FUNCTION public.get_public_invoice_receipt(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'number', upper(left(i.id::text, 6)),
      'created_at', i.created_at,
      'total', i.total,
      'paid', i.paid,
      'down_payment', i.down_payment,
      'monthly_installment', i.monthly_installment,
      'first_due_date', i.first_due_date,
      'discount_amount', i.discount_amount,
      'tax_amount', i.tax_amount,
      'status', i.status
    ),
    'customer', jsonb_build_object('name', c.name),
    'shop', jsonb_build_object(
      'name', COALESCE(NULLIF(s.shop_name, ''), 'سِجلّي'),
      'phone', NULLIF(s.phone, ''),
      'address', NULLIF(s.address, ''),
      'logo_url', s.logo_url,
      'currency', COALESCE(NULLIF(s.currency, ''), 'ج.م'),
      'tax_number', NULLIF(s.tax_number, ''),
      'footer_note', NULLIF(s.footer_note, '')
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', ii.name,
        'price', ii.price,
        'quantity', ii.quantity,
        'discount_pct', ii.discount_pct,
        'discount_amount', ii.discount_amount,
        'tax_pct', ii.tax_pct,
        'tax_amount', ii.tax_amount,
        'line_total', ii.line_total,
        'serial_numbers', ii.serial_numbers
      ) ORDER BY ii.created_at, ii.id)
      FROM public.invoice_items ii
      WHERE ii.invoice_id = i.id
    ), '[]'::jsonb)
  )
  FROM public.invoices i
  JOIN public.customers c ON c.id = i.customer_id AND c.user_id = i.user_id
  LEFT JOIN public.shop_settings s ON s.user_id = i.user_id
  WHERE i.receipt_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_receipt(uuid) TO anon, authenticated, service_role;


-- =============================================================
-- MIGRATION 45/48: 20260901145211_46f1a621-751f-4043-8d5e-efb4765efb2e.sql
-- =============================================================

DROP FUNCTION IF EXISTS public.get_public_invoice_receipt(uuid);


-- =============================================================
-- MIGRATION 46/48: 20260901150315_ee3f058a-41eb-4c7e-9d78-ddfa679903b1.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS  public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  phone text,
  manager_name text,
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own branches" ON public.branches;
CREATE POLICY "Users manage their own branches" ON public.branches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS  public.payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'receipt',
  payment_method text NOT NULL DEFAULT 'cash',
  description text,
  party_name text,
  party_phone text,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_vouchers TO authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own payment vouchers" ON public.payment_vouchers;
CREATE POLICY "Users manage their own payment vouchers" ON public.payment_vouchers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_payment_vouchers_updated_at ON public.payment_vouchers;
CREATE TRIGGER update_payment_vouchers_updated_at BEFORE UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================
-- MIGRATION 47/48: 20260901161525_315fc183-fbe3-4f60-ab03-ba2e6734c38c.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS  public.treasury_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_key text,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  initial_balance numeric NOT NULL DEFAULT 0,
  account_number text,
  bank_name text,
  color text NOT NULL DEFAULT 'emerald',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_accounts TO authenticated;
GRANT ALL ON public.treasury_accounts TO service_role;
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own treasury accounts" ON public.treasury_accounts;
CREATE POLICY "Users manage their own treasury accounts" ON public.treasury_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_treasury_accounts_updated_at ON public.treasury_accounts;
CREATE TRIGGER update_treasury_accounts_updated_at BEFORE UPDATE ON public.treasury_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS  public.treasury_manual_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_key text NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'عام',
  amount numeric NOT NULL DEFAULT 0,
  tx_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  notes text,
  reference_number text,
  payment_method text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_manual_transactions TO authenticated;
GRANT ALL ON public.treasury_manual_transactions TO service_role;
ALTER TABLE public.treasury_manual_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own manual cash transactions" ON public.treasury_manual_transactions;
CREATE POLICY "Users manage their own manual cash transactions" ON public.treasury_manual_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_treasury_manual_transactions_updated_at ON public.treasury_manual_transactions;
CREATE TRIGGER update_treasury_manual_transactions_updated_at BEFORE UPDATE ON public.treasury_manual_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS  public.treasury_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  from_account_key text NOT NULL,
  to_account_key text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  fee_recorded_as_expense boolean NOT NULL DEFAULT false,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text,
  notes text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_transfers TO authenticated;
GRANT ALL ON public.treasury_transfers TO service_role;
ALTER TABLE public.treasury_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own internal transfers" ON public.treasury_transfers;
CREATE POLICY "Users manage their own internal transfers" ON public.treasury_transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_treasury_transfers_updated_at ON public.treasury_transfers;
CREATE TRIGGER update_treasury_transfers_updated_at BEFORE UPDATE ON public.treasury_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS  public.treasury_denomination_audits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_number text NOT NULL,
  account_key text NOT NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  counted_by text,
  denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_actual_cash numeric NOT NULL DEFAULT 0,
  system_expected_cash numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  variance_reason text,
  notes text,
  status text NOT NULL DEFAULT 'settled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_denomination_audits TO authenticated;
GRANT ALL ON public.treasury_denomination_audits TO service_role;
ALTER TABLE public.treasury_denomination_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own denomination audits" ON public.treasury_denomination_audits;
CREATE POLICY "Users manage their own denomination audits" ON public.treasury_denomination_audits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_treasury_denomination_audits_updated_at ON public.treasury_denomination_audits;
CREATE TRIGGER update_treasury_denomination_audits_updated_at BEFORE UPDATE ON public.treasury_denomination_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================
-- MIGRATION 48/48: 20260902183423_b66c4652-54e4-41d0-9aa2-41a1d3b200d7.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS  public.reconciliation_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_score integer NOT NULL DEFAULT 100,
  total_discrepancy numeric NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  notice_count integer NOT NULL DEFAULT 0,
  auto_fixable_count integer NOT NULL DEFAULT 0,
  findings_count integer NOT NULL DEFAULT 0,
  category_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger_source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reconciliation_audit_runs_user_created_idx ON public.reconciliation_audit_runs (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.reconciliation_audit_runs TO authenticated;
GRANT ALL ON public.reconciliation_audit_runs TO service_role;
ALTER TABLE public.reconciliation_audit_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own audit runs" ON public.reconciliation_audit_runs;
CREATE POLICY "Users manage their own audit runs" ON public.reconciliation_audit_runs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


