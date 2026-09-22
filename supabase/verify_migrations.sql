-- =============================================================
-- verify_migrations.sql
-- فحص حالة قاعدة البيانات: الجداول و الـ RPC functions
-- شغّل ده في Supabase Dashboard > SQL Editor
-- =============================================================

-- =============================================================
-- القسم 1: فحص الـ RPC Functions (15 function حية — بدون أشباح المتجر)
-- لو أي function مش موجودة، هتظهر في النتيجة
-- =============================================================
SELECT '--- RPC FUNCTIONS CHECK ---' AS info;

SELECT
  p.proname AS function_name,
  pg_catalog.pg_get_function_result(p.oid) AS return_type,
  CASE
    WHEN p.prokind = 'f' THEN 'FUNCTION'
    ELSE 'OTHER'
  END AS type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'record_invoice_payment',
    'update_invoice_payment',
    'delete_invoice_payment',
    'recalculate_invoice_paid',
    'record_purchase_with_inventory',
    'update_purchase_with_inventory',
    'delete_purchase_with_inventory',
    'create_invoice_shipment',
    'create_sale_return',
    'sync_late_shipment_notifications',
    'settle_carrier_collections',
    'restore_backup',
    'wipe_user_data',
    'assert_backup_manager',
    'no_owner_exists'
  )
ORDER BY p.proname;

-- عرض الـ functions الناقصة (لو موجودة)
SELECT '--- MISSING RPC FUNCTIONS ---' AS info;

WITH expected_functions AS (
  SELECT unnest(ARRAY[
    'record_invoice_payment',
    'update_invoice_payment',
    'delete_invoice_payment',
    'recalculate_invoice_paid',
    'record_purchase_with_inventory',
    'update_purchase_with_inventory',
    'delete_purchase_with_inventory',
    'create_invoice_shipment',
    'create_sale_return',
    'sync_late_shipment_notifications',
    'settle_carrier_collections',
    'restore_backup',
    'wipe_user_data',
    'assert_backup_manager',
    'no_owner_exists'
  ]) AS fn_name
),
existing_functions AS (
  SELECT DISTINCT p.proname AS fn_name
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
)
SELECT ef.fn_name AS missing_function
FROM expected_functions ef
LEFT JOIN existing_functions ex ON ef.fn_name = ex.fn_name
WHERE ex.fn_name IS NULL;

-- =============================================================
-- القسم 2: فحص الجداول الأساسية
-- =============================================================
SELECT '--- TABLES CHECK ---' AS info;

SELECT
  t.table_name,
  CASE
    WHEN t.table_type = 'BASE TABLE' THEN 'TABLE'
    ELSE t.table_type
  END AS type
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    -- جداول أساسية
    'customers', 'invoices', 'invoice_items', 'payments',
    'expenses', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
    'stock_items', 'stock_adjustments', 'warehouse_items',
    'shop_settings', 'profiles', 'user_roles', 'team_invites',
    -- جداول الشحن
    'shipments', 'shipping_carriers', 'shipping_zones',
    'carrier_settlements', 'shipment_notifications', 'delivery_attempts',
    'payment_vouchers',
    -- جداول المرتجعات
    'return_records', 'return_items',
    -- جداول أخرى
    'branches',
    'audit_events', 'audit_logs', 'invoice_installments',
    -- جداول المزامنة
    'treasury_accounts', 'treasury_manual_transactions',
    'treasury_transfers', 'treasury_denomination_audits',
    'staff_members', 'staff_attendance', 'shifts',
    'licenses', 'admin_settings',
    'expense_metadata', 'recurring_expenses', 'category_budgets',
    'expense_settings', 'promo_coupons', 'qty_offers', 'bundles',
    'loyalty_config', 'collection_promises', 'collection_call_logs',
    'held_invoices'
  )
ORDER BY t.table_name;

-- عرض الجداول الناقصة
SELECT '--- MISSING TABLES ---' AS info;

WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'customers', 'invoices', 'invoice_items', 'payments',
    'expenses', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
    'stock_items', 'stock_adjustments', 'warehouse_items',
    'shop_settings', 'profiles', 'user_roles', 'team_invites',
    'shipments', 'shipping_carriers', 'shipping_zones',
    'carrier_settlements', 'shipment_notifications', 'delivery_attempts',
    'payment_vouchers',
    'return_records', 'return_items',
    'branches',
    'audit_events', 'audit_logs', 'invoice_installments',
    'treasury_accounts', 'treasury_manual_transactions',
    'treasury_transfers', 'treasury_denomination_audits',
    'staff_members', 'staff_attendance', 'shifts',
    'licenses', 'admin_settings',
    'expense_metadata', 'recurring_expenses', 'category_budgets',
    'expense_settings', 'promo_coupons', 'qty_offers', 'bundles',
    'loyalty_config', 'collection_promises', 'collection_call_logs',
    'held_invoices'
  ]) AS tbl_name
),
existing_tables AS (
  SELECT t.table_name AS tbl_name
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
)
SELECT et.tbl_name AS missing_table
FROM expected_tables et
LEFT JOIN existing_tables ex ON et.tbl_name = ex.tbl_name
WHERE ex.tbl_name IS NULL;

-- =============================================================
-- القسم 3: فحص الـ Enums
-- =============================================================
SELECT '--- ENUMS CHECK ---' AS info;

SELECT t.typname AS enum_name,
       ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.typname IN ('app_role')
GROUP BY t.typname;

-- =============================================================
-- القسم 4: فحص Triggers على updated_at
-- =============================================================
SELECT '--- UPDATED_AT TRIGGERS ---' AS info;

SELECT
  event_object_table AS table_name,
  trigger_name,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%updated_at%'
ORDER BY event_object_table;

-- =============================================================
-- القسم 5: ملخص سريع
-- =============================================================
SELECT '--- SUMMARY ---' AS info;

SELECT
  (SELECT COUNT(DISTINCT p.proname)
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
      AND p.proname IN (
        'record_invoice_payment', 'update_invoice_payment',
        'delete_invoice_payment', 'recalculate_invoice_paid',
        'record_purchase_with_inventory', 'update_purchase_with_inventory',
        'delete_purchase_with_inventory', 'create_invoice_shipment',
        'create_sale_return', 'sync_late_shipment_notifications',
        'settle_carrier_collections', 'restore_backup', 'wipe_user_data',
        'assert_backup_manager', 'no_owner_exists'
      )) AS existing_rpc_count,
  15 AS expected_rpc_count,
  (SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'customers', 'invoices', 'invoice_items', 'payments',
        'expenses', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
        'stock_items', 'stock_adjustments', 'warehouse_items',
        'shop_settings', 'profiles', 'user_roles', 'team_invites',
        'shipments', 'shipping_carriers', 'shipping_zones',
        'carrier_settlements', 'shipment_notifications', 'delivery_attempts',
        'payment_vouchers',
        'return_records', 'return_items',
        'branches',
        'audit_events', 'audit_logs', 'invoice_installments',
        'treasury_accounts', 'treasury_manual_transactions',
        'treasury_transfers', 'treasury_denomination_audits',
        'staff_members', 'staff_attendance', 'shifts',
        'licenses', 'admin_settings',
        'expense_metadata', 'recurring_expenses', 'category_budgets',
        'expense_settings', 'promo_coupons', 'qty_offers', 'bundles',
        'loyalty_config', 'collection_promises', 'collection_call_logs',
        'held_invoices'
      )) AS existing_tables_count,
  49 AS expected_tables_count;

-- =============================================================
-- القسم 6: فحص RLS — أي جدول بلا سياسات يظهر هنا (يجب أن تكون فارغة)
-- =============================================================
SELECT '--- TABLES WITH RLS DISABLED (MUST BE EMPTY) ---' AS info;

SELECT c.relname AS unprotected_table
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE 'spatial_%'
ORDER BY c.relname;

SELECT '--- POLICY COUNT PER APP TABLE ---' AS info;

SELECT t.tablename,
  count(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = 'public' AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename
ORDER BY t.tablename;
