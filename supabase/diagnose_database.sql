-- =============================================================
-- diagnose_database.sql
-- عرض كل الجداول وال functions الموجودة فعلياً في القاعدة
-- شغّل ده في Supabase Dashboard > SQL Editor
-- =============================================================

-- كل الجداول في public schema
SELECT '--- ALL TABLES IN PUBLIC SCHEMA ---' AS info;

SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- كل الـ functions في public schema
SELECT '--- ALL FUNCTIONS IN PUBLIC SCHEMA ---' AS info;

SELECT
  p.proname AS function_name,
  pg_catalog.pg_get_function_result(p.oid) AS return_type,
  pg_catalog.pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- كل الـ enums
SELECT '--- ALL ENUMS ---' AS info;

SELECT t.typname AS enum_name,
       ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname;

-- كل الـ RLS policies
SELECT '--- RLS POLICIES ---' AS info;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
