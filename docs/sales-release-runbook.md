# Sales release runbook

## 1. Apply migrations

Run the migrations in Supabase SQL Editor or with the Supabase CLI:

```powershell
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

The relevant files are:

- `supabase/migrations/20261112000001_sales_integrity_repairs.sql`
- `supabase/migrations/20261112000002_sales_idempotency_daily_summary.sql`

## 2. Backup before production deployment

Use a service-role or database connection that is never exposed to the browser:

```powershell
supabase db dump --linked --file backup-before-sales-release.sql
```

If the CLI is unavailable, create a database backup from Supabase Dashboard before applying the migrations.

## 3. Integration tests

Set these variables only in a local, ignored environment file:

```text
SUPABASE_TEST_URL
SUPABASE_TEST_ANON_KEY
SUPABASE_TEST_EMAIL
SUPABASE_TEST_PASSWORD
SUPABASE_TEST_CUSTOMER_ID
SUPABASE_TEST_STOCK_ITEM_ID
```

Then run:

```powershell
bun test src/__tests__/sales-integrity.integration.test.ts
```

The test covers atomic stock deduction, repeated-payment idempotency, and concurrent sales against one stock unit.

## 4. Production smoke test

Use a dedicated test customer and product, then verify:

1. Create a cash sale and confirm invoice, item, payment, and stock movement.
2. Submit the same sale command again and confirm no duplicate invoice.
3. Record the same payment command twice and confirm one payment row.
4. Create and delete a sales return and confirm stock, refund, treasury, and invoice status.
5. Create a draft with a deposit, convert it, and confirm the reservation is released once.
6. Disconnect the browser, create a test sale, reconnect, and confirm the queued RPC is replayed once.

Do not use a real customer or production stock item for this test.
