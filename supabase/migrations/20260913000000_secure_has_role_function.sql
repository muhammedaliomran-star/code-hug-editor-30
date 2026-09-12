-- Migration: Secure has_role() function
-- Revoke public EXECUTE to prevent anon users from querying user roles
-- This closes a security gap where SECURITY DEFINER + no REVOKE = anon access

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
