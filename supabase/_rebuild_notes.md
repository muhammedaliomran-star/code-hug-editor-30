# Rebuild notes — `_rebuild_base.sql`

Reconstructed the missing BASE tables by reading TypeScript usage. Below is a
per-table list of the columns inferred and the file(s) that proved them.
Tables NOT touched (already created by existing repo migrations): branches,
payment_vouchers, shipment_carriers→`shipping_carriers`/`shipping_zones`,
shipments, carrier_settlements, return_records, return_items,
shipment_notifications, store_orders, store_order_events, storefront*,
stock_movements, audit_events, installment schedule tables.

## app_role enum + user_roles + has_role()
- Real role values are `owner | manager | seller` — **not**
  `owner/admin/manager/cashier/viewer` as the task description guessed.
  Proven by `src/lib/roles.ts` (`AppRole` type, `ROLE_RANK`, `ROLE_LABEL`)
  and `src/lib/team.functions.ts` (`z.enum(["owner","manager","seller"])`).
- `user_roles(user_id, role)` unique pair — from `src/lib/roles.ts` (`.eq("user_id", ...)`,
  `.update({ role })`, `.delete()`) and `team.functions.ts` upsert with
  `onConflict: "user_id,role"`.
- `has_role(_user_id uuid, _role app_role)` signature taken directly from
  `team.functions.ts`: `supabase.rpc("has_role", { _user_id: userId, _role: "owner" })`.

## profiles
- Columns from `src/lib/store.ts` `useProfile`/`save`: `id` (= auth uid, PK),
  `display_name`, `avatar_url`, `phone`. `created_at`/`updated_at` added defensively
  (not read by the app, but harmless and consistent with other tables).

## team_invites
- Columns from `src/lib/roles.ts` (`select("id, email, role, status, expires_at, created_at")`,
  update `status`) and `src/lib/team.functions.ts` (insert with `invited_by`, `email`,
  `role`, `status`, `accepted_by`, `accepted_at`; unique-violation handling implies
  a uniqueness constraint on pending invites — not enforced here beyond app-level
  duplicate detection, since the exact partial-unique-index shape wasn't determinable
  from the code alone).
- `status` values: `pending | accepted | revoked` (roles.ts `TeamInvite["status"]`).

## customers
- Full column set from `Customer` interface + `fetchAll()` mapping + `addCustomer`/`updateCustomer`
  in `src/lib/store.ts`. `status` check values `committed|neutral|defaulter`
  (`CustomerStatus` type), `customer_type` `installment|cash` (`CustomerType` type).

## invoices
- Columns from `Invoice` interface + `fetchAll()` + `addInvoice`/`updateInvoice` in `store.ts`.
- `status` check values `paid|pending|cancelled` (`InvoiceStatus` type).
- `invoice_number`, `date` are read optionally (`r.invoice_number`, `r.date || r.created_at`)
  but never written by `store.ts`'s `addInvoice` — likely populated elsewhere (POS/NewInvoice
  pages or a trigger not present in the repo). Included as nullable columns so
  reads/writes don't fail.
- `receipt_token` is intentionally **not** created here — it's added later via
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS receipt_token` in
  `20260901145154_..._.sql`, which also creates the unique index and the
  `get_public_invoice_receipt` RPC. Re-declaring it here would just be redundant
  with that migration's idempotent `ADD COLUMN IF NOT EXISTS`.
- `customer_id` FK added since every code path scopes invoices to a customer.

## invoice_items
- Columns from `InvoiceItem` interface + `invoiceItemFinancials()` helper in `store.ts`
  (`discount_pct`, `discount_amount`, `tax_pct`, `tax_amount`, `line_total`, `serial_numbers`).
  Constraints/defaults double-confirmed by migration `20260901145154_...sql` which
  does `ADD COLUMN IF NOT EXISTS` with identical names/types/defaults for this table
  (it assumes the table pre-exists) — this is strong independent confirmation.

## payments
- Columns from `Payment` interface + `recomputeInvoicePaid()` and `record_invoice_payment`
  RPC references (`invoice_id`, `amount`, `paid_at`) in `store.ts` /
  `20260827130000_atomic_invoice_payments.sql`.

## expenses
- Columns from `Expense` interface + `addExpense`/`updateExpense` in `store.ts`.
  `category` free-text (`ExpenseCategory` union used only in the UI/TS layer;
  `custom_expense_categories` in `shop_settings` shows categories are user-extensible,
  so no DB-level check constraint was added for category values).

## suppliers
- Columns from `Supplier` interface + `addSupplier`/`updateSupplier` in `store.ts`.

## purchases
- Columns confirmed twice: `Purchase` interface in `store.ts`, and directly by the
  `record_purchase_with_inventory`/`update_purchase_with_inventory` RPCs in
  `20260827140000_atomic_purchase_inventory.sql` which insert into
  `public.purchases (id, user_id, supplier_id, total, payment_type, purchase_date, notes)`.
  `payment_type` check `cash|credit` (`PurchasePaymentType` type).

## purchase_items
- Confirmed by the same RPC file: `insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity)`.

## supplier_payments
- Columns from `SupplierPayment` interface + `recordSupplierPayment`/`updateSupplierPayment`
  in `store.ts`.

## stock_items
- Base columns from `StockItem` interface + `addStockItem`/`updateStockItem`/`upsertStockDeltas`
  in `store.ts`: `name`, `quantity`, `last_unit_cost`, `sale_price`, `barcode`, `size`,
  `item_type`, `min_stock`.
- `updated_at` confirmed required because `record_purchase_with_inventory` RPC does
  `update public.stock_items set ... updated_at = now()`.
- Extra optional fields present on the `StockItem` TS interface but not clearly
  written anywhere in `store.ts` (`variants`, `lowStockAlert`, `season`, `category`,
  `notes`) were still added as nullable/defaulted columns (`variants jsonb`,
  `low_stock_alert numeric`, `season text`, `category text`, `notes text`) so reads
  via `select("*")` and any future writes don't 42703-error. `addStockItem`'s
  parameter list includes `lowStockAlert/season/category/notes` in its type but the
  actual `.insert()` call in the current code doesn't send them — kept as nullable
  columns since the type signature clearly anticipates them.

## stock_adjustments
- Columns confirmed by `store.ts` (`adjustStock`, `updateStockItem` adjustment path:
  `user_id, stock_item_id, delta, reason, notes`) and by the
  `log_stock_adjustment_movement()` trigger function in
  `20260827140000_atomic_purchase_inventory.sql` which reads
  `new.stock_item_id, new.delta, new.reason, new.id` off this table — strong
  independent confirmation of column names/types.

## warehouse_items
- Columns from `WarehouseItem` interface + `addWarehouseItem`/`updateWarehouseItem` in
  `store.ts`. `season` check `summer|winter|all` (`WarehouseSeason` type).

## shop_settings
- Exhaustive column list taken from `ShopSettings` interface, `EMPTY_SHOP_SETTINGS`
  defaults, and `fetchShopSettings()`/`saveShopSettings()` in `store.ts` (every
  `row.x`/`patch.x` mapping enumerated).
- `manager_pin`, `max_discount_without_pin`, `hide_cost_and_profits_from_cashier`,
  `prevent_invoice_deletion_without_pin`, `prevent_viewing_total_analytics_without_pin`,
  `thermal_paper_width`, `open_cash_drawer_on_print` are declared as optional (`?`) on
  the `ShopSettings` TS interface and are **not** read/written anywhere in
  `fetchShopSettings`/`saveShopSettings` in the current `store.ts` — could not find
  any other call site setting them (grepped whole repo, no hits). Added as nullable
  columns anyway so any future UI wiring (e.g. a manager-PIN feature flagged off
  today) won't hit a missing-column error; **could not fully confirm intended types**
  beyond what the TS interface implies (text/numeric/boolean as declared).
- `user_id unique` because `saveShopSettings` upserts with `onConflict: "user_id"`,
  i.e. one settings row per shop owner.
- Public/anon SELECT grant added because `src/lib/public-receipt.functions.ts` reads
  `shop_settings` by `user_id` for the printable receipt page — in the current code
  this specific call goes through `supabaseAdmin` (service_role), but the table is
  clearly meant to be publicly readable for that receipt flow, so the anon grant +
  policy were added per the task's explicit shop_settings/invoices guidance. (Did
  **not** add a public/anon policy on `invoices` itself since every read of it in
  the app — including the receipt function — goes through `supabaseAdmin` or an
  authenticated owner-scoped session; adding anon access to full invoice rows was
  judged an unnecessary data exposure without a corresponding public code path
  performing a plain anon `select` on it.)

## Things not fully determined / left as best-effort
- Whether `invoices.invoice_number`/`date` are auto-populated by a trigger or by
  application code elsewhere (not present in the grepped files) — left nullable,
  no default/sequence added.
- Exact intended types for the manager-PIN-related `shop_settings` columns (no
  code currently reads/writes them).
- `team_invites` duplicate-pending-invite uniqueness is enforced only by the
  Postgres `23505` error path expected in `team.functions.ts`, but no matching
  unique constraint/index was reverse-engineerable from the code (could be a
  partial unique index on `(email) where status = 'pending'` — left out to avoid
  guessing incorrectly and blocking legitimate re-invites after revocation).
