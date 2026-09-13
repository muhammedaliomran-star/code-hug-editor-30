-- =============================================================
-- فحص صلاحيات الدوال - هل كل حاجة محمية صح؟
-- شغّل في Supabase SQL Editor
-- =============================================================

-- القسم 1: SECURITY DEFINER functions اللي قابلة لـ anon (لازم نعرفهم)
SELECT '--- SECURITY DEFINER functions callable by anon ---' AS info;

SELECT 
  p.proname AS function_name,
  pg_catalog.pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proacl IS NULL  -- No explicit ACL = default PUBLIC access
ORDER BY p.proname;

-- القسم 2: SECURITY DEFINER functions اللي محمية صح (REVOKE exists)
SELECT '--- SECURE functions (REVOKE from public) ---' AS info;

SELECT 
  p.proname AS function_name,
  pg_catalog.pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proacl IS NOT NULL  -- Has explicit ACL
ORDER BY p.proname;

-- القسم 3: ملخص
SELECT '--- SUMMARY ---' AS info;

SELECT
  (SELECT COUNT(*)
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.prosecdef = true
     AND p.proacl IS NULL) AS insecure_functions_count,
  (SELECT COUNT(*)
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.prosecdef = true
     AND p.proacl IS NOT NULL) AS secure_functions_count;
