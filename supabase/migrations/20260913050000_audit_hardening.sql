-- =============================================================
-- Audit System Hardening
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================

-- ==================== Stage 1: Fix RLS on audit_logs ====================
-- Remove DELETE and UPDATE permissions — audit logs must be immutable

DROP POLICY IF EXISTS "Users manage own audit logs" ON public.audit_logs;

CREATE POLICY "Users read own audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Revoke dangerous permissions
REVOKE DELETE, UPDATE ON public.audit_logs FROM authenticated;

-- ==================== Stage 3: Add triggers for missing tables ====================
-- Cover customers, expenses, branches, staff_members, suppliers

do $$
declare
  v_table text;
begin
  foreach v_table in array array['customers', 'expenses', 'branches', 'staff_members', 'suppliers'] loop
    execute format('drop trigger if exists audit_%I on public.%I', v_table, v_table);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', v_table, v_table);
  end loop;
end $$;
