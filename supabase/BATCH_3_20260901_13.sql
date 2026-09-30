-- BATCH_3_20260901_13: paste in order BATCH_1..4 --

-- ===== FILE: 20260901145154_55a33b50-feb3-415a-beb8-3ff9cb3eed63.sql =====}
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

-- ===== FILE: 20260901145211_46f1a621-751f-4043-8d5e-efb4765efb2e.sql =====}
DROP FUNCTION IF EXISTS public.get_public_invoice_receipt(uuid);

-- ===== FILE: 20260901150315_ee3f058a-41eb-4c7e-9d78-ddfa679903b1.sql =====}
CREATE TABLE public.branches (
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
CREATE POLICY "Users manage their own branches" ON public.branches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.payment_vouchers (
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
CREATE POLICY "Users manage their own payment vouchers" ON public.payment_vouchers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_vouchers_updated_at BEFORE UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== FILE: 20260901161525_315fc183-fbe3-4f60-ab03-ba2e6734c38c.sql =====}
CREATE TABLE public.treasury_accounts (
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
CREATE POLICY "Users manage their own treasury accounts" ON public.treasury_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_accounts_updated_at BEFORE UPDATE ON public.treasury_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treasury_manual_transactions (
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
CREATE POLICY "Users manage their own manual cash transactions" ON public.treasury_manual_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_manual_transactions_updated_at BEFORE UPDATE ON public.treasury_manual_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treasury_transfers (
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
CREATE POLICY "Users manage their own internal transfers" ON public.treasury_transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_transfers_updated_at BEFORE UPDATE ON public.treasury_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treasury_denomination_audits (
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
CREATE POLICY "Users manage their own denomination audits" ON public.treasury_denomination_audits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_denomination_audits_updated_at BEFORE UPDATE ON public.treasury_denomination_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== FILE: 20260902183423_b66c4652-54e4-41d0-9aa2-41a1d3b200d7.sql =====}
CREATE TABLE public.reconciliation_audit_runs (
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
CREATE POLICY "Users manage their own audit runs" ON public.reconciliation_audit_runs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== FILE: 20260913000000_secure_has_role_function.sql =====}
-- Migration: Secure has_role() function
-- Revoke public EXECUTE to prevent anon users from querying user roles
-- This closes a security gap where SECURITY DEFINER + no REVOKE = anon access

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;


-- ===== FILE: 20260913010000_create_audit_logs_table.sql =====}
-- Migration: Create audit_logs table
-- Migrates audit logging from localStorage to Supabase database

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  staff_id TEXT,
  staff_name TEXT NOT NULL DEFAULT '',
  staff_role TEXT NOT NULL DEFAULT 'system',
  branch_name TEXT,
  entity_id TEXT,
  entity_name TEXT,
  title TEXT NOT NULL,
  details TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_id, module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own audit logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;


-- ===== FILE: 20260913030000_create_sync_tables.sql =====}
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


-- ===== FILE: 20260913040000_security_licenses_admin.sql =====}
-- =============================================================
-- Security: Move licenses + admin settings to Supabase
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================

-- ==================== Licenses Table ====================
CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  tier text NOT NULL DEFAULT 'trial',
  tier_label text NOT NULL DEFAULT 'test',
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  shop_name text NOT NULL DEFAULT '',
  shop_address text,
  tax_number text,
  issue_date date NOT NULL DEFAULT current_date,
  expiry_date text NOT NULL DEFAULT 'LIFETIME',
  status text NOT NULL DEFAULT 'active',
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  notes text,
  hardware_included text,
  hardware_items jsonb DEFAULT '[]',
  tax_rate_percent numeric(5,2) DEFAULT 0,
  modules jsonb NOT NULL DEFAULT '{}',
  installments jsonb,
  support_logs jsonb DEFAULT '[]',
  last_active_date date,
  device_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own licenses" ON public.licenses;
CREATE POLICY "Users manage own licenses" ON public.licenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== Admin Settings Table ====================
CREATE TABLE IF NOT EXISTS public.admin_settings (
  user_id uuid PRIMARY KEY,
  admin_pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only owners manage admin settings" ON public.admin_settings;
CREATE POLICY "Only owners manage admin settings" ON public.admin_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND auth.uid() = user_id);

-- ==================== RPC: Verify Admin Pin ====================
CREATE OR REPLACE FUNCTION public.verify_admin_pin(_user_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_settings
    WHERE user_id = _user_id
      AND admin_pin_hash = md5(_pin)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_pin(uuid, text) TO authenticated;

-- ==================== RPC: Set Admin Pin ====================
CREATE OR REPLACE FUNCTION public.set_admin_pin(_user_id uuid, _new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_user_id, 'owner') THEN
    RAISE EXCEPTION 'Only owners can change admin PIN';
  END IF;

  INSERT INTO public.admin_settings (user_id, admin_pin_hash, updated_at)
  VALUES (_user_id, md5(_new_pin), now())
  ON CONFLICT (user_id) DO UPDATE
  SET admin_pin_hash = md5(_new_pin), updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(uuid, text) TO authenticated;

-- ==================== RPC: Get Admin Pin Hash ====================
CREATE OR REPLACE FUNCTION public.get_admin_pin_hash(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_pin_hash FROM public.admin_settings
  WHERE user_id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_pin_hash(uuid) TO authenticated;

-- ==================== RPC: Verify Manager Pin ====================
CREATE OR REPLACE FUNCTION public.verify_manager_pin(_user_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_settings
    WHERE user_id = _user_id
      AND manager_pin IS NOT NULL
      AND manager_pin = md5(_pin)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_manager_pin(uuid, text) TO authenticated;

-- ==================== RPC: Set Manager Pin ====================
CREATE OR REPLACE FUNCTION public.set_manager_pin(_user_id uuid, _new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_user_id, 'owner') THEN
    RAISE EXCEPTION 'Only owners can change manager PIN';
  END IF;

  UPDATE public.shop_settings
  SET manager_pin = md5(_new_pin), updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_manager_pin(uuid, text) TO authenticated;


-- ===== FILE: 20260913050000_audit_hardening.sql =====}
-- =============================================================
-- Audit System Hardening
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================

-- ==================== Stage 1: Fix RLS on audit_logs ====================
-- Remove DELETE and UPDATE permissions — audit logs must be immutable

DROP POLICY IF EXISTS "Users manage own audit logs" ON public.audit_logs;

CREATE POLICY "Users read own audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Revoke dangerous permissions
REVOKE DELETE, UPDATE ON public.audit_logs FROM authenticated;

-- ==================== Stage 3: Add triggers for missing tables ====================
-- Cover customers, expenses, branches, staff_members, suppliers

do $$
declare
  v_table text;
begin
  foreach v_table in array array['customers', 'expenses', 'branches', 'staff_members', 'suppliers'] loop
    execute format('drop trigger if exists audit_%I on public.%I', v_table, v_table);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', v_table, v_table);
  end loop;
end $$;

