/**
 * Generic offline write queue.
 * When a Supabase write fails after retries, enqueue it to localStorage.
 * On next successful `online` event or app mount, re-sync queued items.
 */

import { supabase } from "@/integrations/supabase/client";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

export interface OfflineQueueItem {
  id: string;
  tableName: string;
  operation: "upsert" | "delete" | "update";
  payload: unknown;
  createdAt: string;
  retries: number;
  /** Conflict target for upsert (e.g. "user_id,category"). */
  onConflict?: string;
}

const STORAGE_KEY = "segilly_offline_write_queue_v1";
const MAX_RETRIES = 5;
const MAX_ITEMS = 200;

/**
 * Tables whose rows have no `id` column, so a plain upsert would insert and
 * violate a unique constraint instead of updating. Kept in sync with the
 * `onConflict` options used by the push functions in *-sync.ts.
 * (Older queued items were written before `onConflict` was stored on the
 * item, so the fallback keeps them replayable.)
 */
const CONFLICT_TARGETS: Record<string, string> = {
  category_budgets: "user_id,category",
  expense_settings: "user_id",
  loyalty_config: "user_id",
  daily_notes: "user_id,date_from,date_to",
};


function readQueue(): OfflineQueueItem[] {
  try {
    const raw = safeGetItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

/**
 * Add a failed operation to the offline queue.
 */
export function enqueueOffline(item: Omit<OfflineQueueItem, "id" | "createdAt" | "retries">): void {
  const queue = readQueue();
  queue.unshift({
    ...item,
    id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  writeQueue(queue);
}

/**
 * Get all queued items (for display / debugging).
 */
export function getOfflineQueue(): OfflineQueueItem[] {
  return readQueue();
}

/**
 * Get count of queued items.
 */
export function getOfflineQueueCount(): number {
  return readQueue().length;
}

/**
 * Remove a successfully synced item from the queue.
 */
export function dequeueOffline(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

/**
 * Retry all queued items using a provided sync function.
 * @param syncFn - async function that receives (item) and throws on failure
 * @returns number of successfully synced items
 */
export async function syncOfflineQueue(
  syncFn: (item: OfflineQueueItem) => Promise<void>,
): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: OfflineQueueItem[] = [];

  for (const item of queue) {
    if (item.retries >= MAX_RETRIES) continue; // drop permanently failed
    try {
      await syncFn(item);
      synced++;
    } catch {
      remaining.push({ ...item, retries: item.retries + 1 });
    }
  }

  writeQueue(remaining);
  return synced;
}

/**
 * Clear the entire queue (e.g. after user signs out).
 */
export function clearOfflineQueue(): void {
  writeQueue([]);
}

// ─── Default executor ─────────────────────────────────────────────────────────

const table = (name: string) => (supabase.from as any)(name);

/**
 * Replay a single queued write against Supabase.
 * Throws on failure so `syncOfflineQueue` can bump its retry counter.
 */
export async function applyQueuedItem(item: OfflineQueueItem): Promise<void> {
  if (!item.tableName) throw new Error("queue item without table name");

  if (item.operation === "upsert") {
    const options = item.onConflict ?? CONFLICT_TARGETS[item.tableName];
    const { error } = await table(item.tableName).upsert(
      item.payload as never,
      options ? { onConflict: options } : undefined,
    );
    if (error) throw error;
    return;
  }

  if (item.operation === "update") {
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const id = payload.id;
    if (id === undefined) throw new Error("queue update item without id");
    const { id: _id, ...rest } = payload;
    const { error } = await table(item.tableName).update(rest as never).eq("id", id as never);
    if (error) throw error;
    return;
  }

  const filters = (item.payload ?? {}) as Record<string, unknown>;
  const keys = Object.keys(filters);
  if (keys.length === 0) {
    // Refuse to run an unfiltered DELETE — that would wipe the table.
    throw new Error(`refusing unfiltered delete on ${item.tableName}`);
  }

  let query = table(item.tableName).delete();
  for (const key of keys) query = query.eq(key, filters[key] as never);
  const { error } = await query;
  if (error) throw error;
}

/**
 * Flush the offline write queue to Supabase.
 *
 * This is the missing piece that made the queue a one-way street: writes
 * were enqueued by all *-sync.ts modules and never replayed, so failed
 * writes silently disappeared (and were eventually dropped at 200 items).
 *
 * Concurrent callers share one in-flight run: two listeners (this hook and
 * useNetworkStatus) can both fire on the same `online` event, and two
 * overlapping drains would both read the queue and overwrite each other's
 * result, losing or duplicating items.
 *
 * @returns number of items successfully written
 */
let inFlightDrain: Promise<number> | null = null;

export function drainOfflineQueue(): Promise<number> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return Promise.resolve(0);
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.resolve(0);
  }
  if (inFlightDrain) return inFlightDrain;

  inFlightDrain = syncOfflineQueue(applyQueuedItem).finally(() => {
    inFlightDrain = null;
  });
  return inFlightDrain;
}
