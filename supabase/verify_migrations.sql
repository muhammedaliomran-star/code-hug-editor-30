-- =============================================================
-- verify_migrations.sql
-- فحص حالة قاعدة البيانات: الجداول و الـ RPC functions
-- شغّل ده في Supabase Dashboard > SQL Editor
-- =============================================================

-- =============================================================
-- القسم 1: فحص الـ RPC Functions (14 function)
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
    'assign_storefront_shipment',
    'create_sale_return',
    'create_storefront_sale_return',
    'reverse_storefront_sale_return',
    'invoice_store_order_installment',
    'get_public_storefront_with_settings'
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
    'assign_storefront_shipment',
    'create_sale_return',
    'create_storefront_sale_return',
    'reverse_storefront_sale_return',
    'invoice_store_order_installment',
    'get_public_storefront_with_settings'
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
    -- جداول المرتجعات
    'return_records', 'return_items',
    -- جداول المتجر
    'store_orders', 'store_order_events',
    'storefront_products', 'storefront_categories',
    -- جداول أخرى
    'branches', 'carrier_settlements', 'shipment_notifications',
    'audit_events', 'installment_schedules'
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
    'return_records', 'return_items',
    'store_orders', 'store_order_events',
    'storefront_products', 'storefront_categories',
    'branches', 'carrier_settlements', 'shipment_notifications',
    'audit_events', 'installment_schedules'
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
       'assign_storefront_shipment', 'create_sale_return',
       'create_storefront_sale_return', 'reverse_storefront_sale_return',
       'invoice_store_order_installment', 'get_public_storefront_with_settings'
     )) AS existing_rpc_count,
  14 AS expected_rpc_count,
  (SELECT COUNT(*)
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'customers', 'invoices', 'invoice_items', 'payments',
       'expenses', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
       'stock_items', 'stock_adjustments', 'warehouse_items',
       'shop_settings', 'profiles', 'user_roles', 'team_invites',
       'shipments', 'shipping_carriers', 'shipping_zones',
       'return_records', 'return_items',
       'store_orders', 'store_order_events',
       'storefront_products', 'storefront_categories',
       'branches', 'carrier_settlements', 'shipment_notifications',
       'audit_events', 'installment_schedules'
     )) AS existing_tables_count,
  30 AS expected_tables_count;
