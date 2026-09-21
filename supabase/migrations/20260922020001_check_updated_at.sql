-- Check which tables have updated_at and which don't
SELECT
  t.table_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as has_updated_at
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
  ON c.table_schema = t.table_schema
  AND c.table_name = t.table_name
  AND c.column_name = 'updated_at'
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'customers', 'invoices', 'invoice_items', 'payments', 'expenses',
    'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
    'stock_items', 'return_records', 'return_items',
    'shipping_carriers', 'shipping_zones', 'shipments',
    'branches', 'payment_vouchers'
  )
ORDER BY t.table_name;
