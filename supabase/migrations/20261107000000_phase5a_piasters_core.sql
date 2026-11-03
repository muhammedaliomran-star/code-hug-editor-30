-- =============================================================
-- Phase 5a (audit remediation) — money as integer piasters (core)
-- =============================================================
-- Converts the core financial tables (customers, invoices, invoice_items,
-- payments) from numeric(12,2) dinars to bigint piasters (×100). Postgres
-- `numeric` is arbitrary-precision so there is no float drift on the DB
-- side, but integer arithmetic is faster and simpler, and it removes the
-- last JS-side rounding edge cases.
--
-- Client converts at the db.ts boundary: reads ÷100 (dinars for UI),
-- writes ×100 (piasters to DB). UI and fmt() are unchanged.
--
-- Must be applied after 20261106000000 (Phase 4).
-- =============================================================

-- customers
alter table public.customers
  alter column credit_limit type bigint using (round(credit_limit * 100))::bigint,
  alter column opening_balance type bigint using (round(opening_balance * 100))::bigint;

-- invoices
alter table public.invoices
  alter column total type bigint using (round(total * 100))::bigint,
  alter column down_payment type bigint using (round(down_payment * 100))::bigint,
  alter column monthly_installment type bigint using (round(monthly_installment * 100))::bigint,
  alter column paid type bigint using (round(paid * 100))::bigint,
  alter column discount_amount type bigint using (round(discount_amount * 100))::bigint,
  alter column tax_amount type bigint using (round(tax_amount * 100))::bigint,
  alter column last_installment_amount type bigint using (round(last_installment_amount * 100))::bigint;

-- invoice_items
alter table public.invoice_items
  alter column cost type bigint using (round(cost * 100))::bigint,
  alter column price type bigint using (round(price * 100))::bigint,
  alter column discount_amount type bigint using (round(discount_amount * 100))::bigint,
  alter column tax_amount type bigint using (round(tax_amount * 100))::bigint,
  alter column line_total type bigint using (round(line_total * 100))::bigint;

-- payments
alter table public.payments
  alter column amount type bigint using (round(amount * 100))::bigint;
