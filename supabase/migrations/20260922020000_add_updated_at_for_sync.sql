-- Add updated_at column to all core business tables for conflict resolution and sync.
-- Tables that already have updated_at are skipped via IF NOT EXISTS.

-- Helper: auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Core business tables
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.return_records ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.return_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Shipping tables
ALTER TABLE public.shipping_carriers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Indexes for sync queries (WHERE updated_at > last_sync)
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON public.customers (updated_at);
CREATE INDEX IF NOT EXISTS idx_invoices_updated_at ON public.invoices (updated_at);
CREATE INDEX IF NOT EXISTS idx_payments_updated_at ON public.payments (updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_updated_at ON public.expenses (updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated_at ON public.suppliers (updated_at);
CREATE INDEX IF NOT EXISTS idx_purchases_updated_at ON public.purchases (updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_items_updated_at ON public.stock_items (updated_at);
CREATE INDEX IF NOT EXISTS idx_shipments_updated_at ON public.shipments (updated_at);
CREATE INDEX IF NOT EXISTS idx_branches_updated_at ON public.branches (updated_at);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_updated_at ON public.payment_vouchers (updated_at);

-- Triggers: auto-set updated_at on UPDATE (skip tables that already have the trigger)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'customers', 'invoices', 'invoice_items', 'payments', 'expenses',
    'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
    'stock_items', 'return_records', 'return_items',
    'shipping_carriers', 'shipping_zones', 'shipments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END
$$;
