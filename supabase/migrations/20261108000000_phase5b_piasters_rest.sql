-- =============================================================
-- Phase 5b (audit remediation) — piasters for the rest (core tables)
-- =============================================================
-- Converts the remaining core money columns to bigint piasters (×100):
-- expenses, suppliers, purchases, purchase_items, supplier_payments,
-- return_records, return_items, payment_vouchers, stock_movements.
--
-- Treasury, branch, staff, collection, discounts, shipments and
-- delivery tables are intentionally left as numeric (dinars) in this
-- phase to avoid touching their sync modules; they will be converted
-- in a later phase if needed.
--
-- Must be applied after 20261107000000 (Phase 5a).
-- =============================================================

alter table public.expenses
  alter column amount type bigint using (round(amount * 100))::bigint;

alter table public.suppliers
  alter column opening_balance type bigint using (round(opening_balance * 100))::bigint;

alter table public.purchases
  alter column total type bigint using (round(total * 100))::bigint;

alter table public.purchase_items
  alter column unit_cost type bigint using (round(unit_cost * 100))::bigint;

alter table public.supplier_payments
  alter column amount type bigint using (round(amount * 100))::bigint;

alter table public.return_records
  alter column total_amount type bigint using (round(total_amount * 100))::bigint;

alter table public.return_items
  alter column unit_price type bigint using (round(unit_price * 100))::bigint;

alter table public.payment_vouchers
  alter column amount type bigint using (round(amount * 100))::bigint;

alter table public.stock_movements
  alter column unit_cost type bigint using (round(unit_cost * 100))::bigint;
