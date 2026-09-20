/**
 * Generic offline write queue.
 * When a Supabase write fails after retries, enqueue it to localStorage.
 * On next successful `online` event or app mount, re-sync queued items.
 */

export interface OfflineQueueItem {
  id: string;
  tableName: string;
  operation: "upsert" | "delete";
  payload: unknown;
  createdAt: string;
  retries: number;
}

const STORAGE_KEY = "segilly_offline_write_queue_v1";
const MAX_RETRIES = 5;
const MAX_ITEMS = 200;

function readQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // storage full — drop oldest
  }
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
