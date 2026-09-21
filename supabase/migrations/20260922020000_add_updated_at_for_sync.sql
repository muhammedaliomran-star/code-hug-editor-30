-- Final migration: updated_at + indexes + triggers for all core tables

-- 1. Add updated_at columns (skip tables that already have it)
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Indexes for sync queries
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

-- 3. Triggers (one per table)
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_invoice_items BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_expenses BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_suppliers BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_purchases BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_purchase_items BEFORE UPDATE ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_supplier_payments BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_stock_items BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_return_records BEFORE UPDATE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_return_items BEFORE UPDATE ON public.return_items FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_shipping_carriers BEFORE UPDATE ON public.shipping_carriers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_shipping_zones BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_shipments BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
CREATE TRIGGER set_updated_at_payment_vouchers BEFORE UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.sync_set_updated_at();
