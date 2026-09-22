/**
 * Conflict Resolution Engine
 *
 * Strategy: Optimistic locking with updated_at timestamp.
 * - Before UPDATE, check if updated_at matches the expected value.
 * - If mismatch → conflict detected.
 * - Resolution: last-write-wins (server timestamp wins), or user chooses.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Dynamic table names can't be statically typed against the generated schema.
const client = supabase as unknown as { from: (table: string) => any };

export interface ConflictInfo {
  table: string;
  id: string;
  localUpdated: string;  // our stale updated_at
  serverUpdated: string; // current updated_at on server
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
}

export interface ConflictResolution {
  useServer: boolean; // true = last-write-wins (server), false = keep local (force push)
}

/**
 * Check if a row has been modified since we last read it.
 * Returns the current server updated_at if conflict exists, null otherwise.
 */
export async function detectConflict(
  table: string,
  id: string,
  expectedUpdatedAt: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("updated_at")
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const serverUpdatedAt = (data as { updated_at: string }).updated_at;
    // If server timestamp is newer than what we expected, conflict exists
    if (new Date(serverUpdatedAt).getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
      return serverUpdatedAt;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safe update with conflict detection.
 * Calls detectConflict before updating. If conflict exists, calls onConflict.
 */
export async function safeUpdate<T extends Record<string, unknown>>(
  table: string,
  id: string,
  updates: T,
  expectedUpdatedAt: string,
  onConflict?: (info: ConflictInfo) => Promise<ConflictResolution>
): Promise<{ success: boolean; conflict?: ConflictInfo }> {
  const serverTime = await detectConflict(table, id, expectedUpdatedAt);

  if (serverTime) {
    // Fetch full server data for the conflict dialog
    const { data: serverData } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    const conflict: ConflictInfo = {
      table,
      id,
      localUpdated: expectedUpdatedAt,
      serverUpdated: serverTime,
      localData: { id, ...updates } as Record<string, unknown>,
      serverData: (serverData as Record<string, unknown>) ?? {},
    };

    if (onConflict) {
      const resolution = await onConflict(conflict);
      if (resolution.useServer) {
        // User chose server — discard local changes
        toast.info("تم تجاهل التغييرات — البيانات الأحدث من السيرفر اتحفظت");
        return { success: true, conflict };
      }
      // User chose local — force push with updated updated_at
    } else {
      // No dialog provided — default to last-write-wins (server wins)
      toast.warning("السجل اتعدّل من جهاز تاني — التغييرات الأحدث اتحفظت");
      return { success: false, conflict };
    }
  }

  // No conflict — proceed with update
  const { error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Safe insert — no conflict check needed (new record).
 */
export async function safeInsert<T extends Record<string, unknown>>(
  table: string,
  data: T
): Promise<{ id: string | null; error?: string }> {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: (result as { id: string })?.id ?? null };
}
