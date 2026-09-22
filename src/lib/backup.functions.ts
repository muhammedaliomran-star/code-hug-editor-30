import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 1 (#15): server-side gate for backup restore / full wipe.
 *
 * Client-side tab hiding is UI affordance only — this function is the real
 * enforcement. Follows the product's role spec (roles.ts ABILITIES):
 * "التقارير والنسخ الاحتياطي" is granted to owner + manager.
 */
async function assertDataManager(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
): Promise<void> {
  const { data: isOwner } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "owner",
  });
  if (isOwner === true) return;

  const { data: isManager } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "manager",
  });
  if (isManager === true) return;

  throw new Error("النسخ الاحتياطي والمسح للمالك أو المدير فقط");
}

/** Throws unless the caller is owner or manager. Call before restore/wipe. */
export const assertBackupAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertDataManager(supabase as never, userId);
    return { ok: true as const };
  });
