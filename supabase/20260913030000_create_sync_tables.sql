-- =============================================================
-- Missing tables for new sync modules
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================

-- ==================== Expense Metadata ====================
CREATE TABLE IF NOT EXISTS public.expense_metadata (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  expense_id text NOT NULL,
  account_id text,
  branch_id text,
  cost_center text,
  voucher_number text,
  receipt_url text,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_metadata TO authenticated;
ALTER TABLE public.expense_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own expense_metadata" ON public.expense_metadata;
CREATE POLICY "Users manage own expense_metadata" ON public.expense_metadata
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Recurring Expenses ====================
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  frequency text NOT NULL DEFAULT 'monthly',
  next_due_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own recurring_expenses" ON public.recurring_expenses;
CREATE POLICY "Users manage own recurring_expenses" ON public.recurring_expenses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Category Budgets ====================
CREATE TABLE IF NOT EXISTS public.category_budgets (
  user_id uuid NOT NULL,
  category text NOT NULL,
  monthly_budget numeric(12,2) NOT NULL DEFAULT 0,
  alert_threshold numeric(5,2) NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_budgets TO authenticated;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own category_budgets" ON public.category_budgets;
CREATE POLICY "Users manage own category_budgets" ON public.category_budgets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Expense Settings ====================
CREATE TABLE IF NOT EXISTS public.expense_settings (
  user_id uuid PRIMARY KEY,
  custom_categories jsonb DEFAULT '[]',
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_settings TO authenticated;
ALTER TABLE public.expense_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own expense_settings" ON public.expense_settings;
CREATE POLICY "Users manage own expense_settings" ON public.expense_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Staff Members ====================
CREATE TABLE IF NOT EXISTS public.staff_members (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'cashier',
  pin_code text,
  branch_name text,
  is_active boolean NOT NULL DEFAULT true,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  permissions jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own staff_members" ON public.staff_members;
CREATE POLICY "Users manage own staff_members" ON public.staff_members
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Staff Attendance ====================
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  branch_name text,
  date date NOT NULL,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  total_hours numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance TO authenticated;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own staff_attendance" ON public.staff_attendance;
CREATE POLICY "Users manage own staff_attendance" ON public.staff_attendance
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Collection Promises ====================
CREATE TABLE IF NOT EXISTS public.collection_promises (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  invoice_id text NOT NULL,
  customer_id text NOT NULL,
  promised_date date NOT NULL,
  promised_amount numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_promises TO authenticated;
ALTER TABLE public.collection_promises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own collection_promises" ON public.collection_promises;
CREATE POLICY "Users manage own collection_promises" ON public.collection_promises
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Collection Call Logs ====================
CREATE TABLE IF NOT EXISTS public.collection_call_logs (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  invoice_id text NOT NULL,
  customer_id text NOT NULL,
  outcome text NOT NULL,
  outcome_label text,
  notes text,
  promised_date date,
  promised_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_call_logs TO authenticated;
ALTER TABLE public.collection_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own collection_call_logs" ON public.collection_call_logs;
CREATE POLICY "Users manage own collection_call_logs" ON public.collection_call_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Held Invoices ====================
CREATE TABLE IF NOT EXISTS public.held_invoices (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'pos',
  customer_id text,
  customer_name text,
  customer_phone text,
  sale_type text NOT NULL DEFAULT 'cash',
  items jsonb NOT NULL DEFAULT '[]',
  total numeric(12,2) NOT NULL DEFAULT 0,
  down_payment numeric(12,2),
  monthly_installment numeric(12,2),
  installment_count integer,
  notes text,
  discount_pct numeric(6,2),
  discount_amt numeric(12,2),
  tax_pct numeric(6,2),
  shipping_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.held_invoices TO authenticated;
ALTER TABLE public.held_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own held_invoices" ON public.held_invoices;
CREATE POLICY "Users manage own held_invoices" ON public.held_invoices
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Promo Coupons ====================
CREATE TABLE IF NOT EXISTS public.promo_coupons (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  min_order_value numeric(12,2) NOT NULL DEFAULT 0,
  max_usage integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  customer_eligibility text NOT NULL DEFAULT 'all',
  notes text,
  is_loyalty_reward boolean NOT NULL DEFAULT false,
  customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_coupons TO authenticated;
ALTER TABLE public.promo_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own promo_coupons" ON public.promo_coupons;
CREATE POLICY "Users manage own promo_coupons" ON public.promo_coupons
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Qty Offers ====================
CREATE TABLE IF NOT EXISTS public.qty_offers (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  min_quantity integer NOT NULL DEFAULT 1,
  discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qty_offers TO authenticated;
ALTER TABLE public.qty_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own qty_offers" ON public.qty_offers;
CREATE POLICY "Users manage own qty_offers" ON public.qty_offers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Bundles ====================
CREATE TABLE IF NOT EXISTS public.bundles (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  item_keywords jsonb NOT NULL DEFAULT '[]',
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundles TO authenticated;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own bundles" ON public.bundles;
CREATE POLICY "Users manage own bundles" ON public.bundles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Loyalty Config ====================
CREATE TABLE IF NOT EXISTS public.loyalty_config (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  points_per_100_egp numeric(5,2) NOT NULL DEFAULT 2,
  point_value_egp numeric(5,2) NOT NULL DEFAULT 1,
  min_points_to_redeem integer NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_config TO authenticated;
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own loyalty_config" ON public.loyalty_config;
CREATE POLICY "Users manage own loyalty_config" ON public.loyalty_config
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Branch Stock ====================
CREATE TABLE IF NOT EXISTS public.branch_stock (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  branch_id text NOT NULL,
  stock_item_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 3,
  max_stock integer,
  shelf_location text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id, stock_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_stock TO authenticated;
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own branch_stock" ON public.branch_stock;
CREATE POLICY "Users manage own branch_stock" ON public.branch_stock
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== Branch Transfers ====================
CREATE TABLE IF NOT EXISTS public.branch_transfers (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  transfer_number text NOT NULL,
  from_branch_id text NOT NULL,
  to_branch_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]',
  notes text,
  driver_name text,
  driver_phone text,
  vehicle_number text,
  created_by text,
  dispatched_by text,
  received_by text,
  dispatched_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_transfers TO authenticated;
ALTER TABLE public.branch_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own branch_transfers" ON public.branch_transfers;
CREATE POLICY "Users manage own branch_transfers" ON public.branch_transfers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
