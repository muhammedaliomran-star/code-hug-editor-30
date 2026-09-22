import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

const restoreSchema = z.object({
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  exportedBy: z.string().max(100).nullable().optional(),
  dryRun: z.boolean().optional(),
});

export type ServerRestoreResult = {
  ok: boolean;
  tableCount?: number;
  totalRows?: number;
  inserted: number;
  skipped: number;
  failed: Array<{ table: string; error: string }>;
};

/**
 * Phase 2 (#15): single-transaction restore.
 * The SQL function gates, validates, then inserts — nothing is written
 * unless the whole payload validates (dryRun previews without writing).
 */
export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => restoreSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await (supabase as any).rpc("restore_backup", {
      p_tables: data.tables,
      p_exported_by: data.exportedBy ?? null,
      p_dry_run: data.dryRun ?? false,
    });
    if (error) throw new Error(error.message);
    return result as ServerRestoreResult;
  });

/** Phase 2 (#15): single-transaction wipe with per-table counts. */
export const wipeUserData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: result, error } = await (supabase as any).rpc("wipe_user_data");
    if (error) throw new Error(error.message);
    return result as { ok: boolean; deleted: Record<string, number> };
  });
