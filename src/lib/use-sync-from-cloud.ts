import { useEffect, useCallback } from "react";
import { useAuth } from "@/lib/store";
import { syncAllTables, syncSummary, SYNC_INTERVAL } from "@/lib/sync-engine";
import { invalidateCache } from "@/lib/db";
import { drainOfflineQueue, getOfflineQueueCount } from "@/lib/offline-queue";
import { syncOfflinePayments } from "@/lib/offline-sync";
import { toast } from "sonner";

/**
 * Background sync hook.
 * Pulls changed records from Supabase every SYNC_INTERVAL and flushes the
 * offline write queues so nothing stays stranded on the device.
 */
export function useSyncFromCloud() {
  const { user } = useAuth();

  /**
   * Replay everything that failed to reach Supabase while offline.
   * Two independent queues exist (generic writes + pending payments);
   * both are flushed here because this hook is the only thing mounted
   * app-wide (`__root.tsx`).
   */
  const flushOfflineQueues = useCallback(async () => {
    try {
      const queued = getOfflineQueueCount();
      const replayed = await drainOfflineQueue();
      if (replayed > 0) {
        toast.success(`تمت مزامنة ${replayed} عملية كانت محفوظة بدون إنترنت`, {
          description: queued > replayed ? `${queued - replayed} عملية لم تنجح وستُعاد المحاولة` : undefined,
        });
      }
    } catch (e) {
      console.error("[OfflineQueue] replay failed:", e);
    }

    try {
      await syncOfflinePayments();
    } catch (e) {
      console.error("[OfflinePayments] replay failed:", e);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    // 1. Push what is still waiting on this device.
    await flushOfflineQueues();

    try {
      const results = await syncAllTables(
        // onRecord / onDeleted: the sync engine only pulls. Rather than
        // merging row-by-row (and having to reconcile deletions), we refresh
        // the whole cache when anything actually changed. Without this the
        // engine advanced `lastSync` and threw the downloaded rows away,
        // leaving the UI permanently stale.
        () => {},
        () => {},
      );

      const summary = syncSummary(results);
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      if (total > 0) {
        if (import.meta.env.DEV) console.log(`[CloudSync] ${summary}`);
        await invalidateCache();
      }
    } catch (e) {
      console.error("[CloudSync] Background sync failed:", e);
    }
  }, [user, flushOfflineQueues]);

  // Initial sync modules (pull from cloud)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function pullAll() {
      try {
        const [
          pullCashbox,
          pullExpenses,
          pullStaff,
          pullCollection,
          pullHeld,
          pullDiscounts,
          pullBranch,
        ] = await Promise.all([
          import("@/lib/cashbox-sync"),
          import("@/lib/expenses-sync"),
          import("@/lib/staff-sync"),
          import("@/lib/collection-sync"),
          import("@/lib/held-invoices-sync"),
          import("@/lib/discounts-sync"),
          import("@/lib/branch-sync"),
        ]);

        if (cancelled) return;

        await Promise.allSettled([
          pullCashbox.pullCashboxFromCloud().catch(() => {}),
          pullExpenses.pullExpensesFromCloud().catch(() => {}),
          pullStaff.pullStaffFromCloud().catch(() => {}),
          pullCollection.pullCollectionFromCloud().catch(() => {}),
          pullHeld.pullHeldInvoicesFromCloud().catch(() => {}),
          pullDiscounts.pullDiscountsFromCloud().catch(() => {}),
          pullBranch.pullBranchDataFromCloud().catch(() => {}),
        ]);

        // Re-sync offline audit queue
        try {
          const auditMod = await import("@/lib/audit");
          await auditMod.syncOfflineAuditQueue();
        } catch {
          // ignore
        }
      } catch (e) {
        console.error("[CloudSync] pull failed:", e);
      }
    }

    pullAll();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Periodic background sync (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      void runSync();
    }, SYNC_INTERVAL);

    // Run once immediately
    void runSync();

    return () => clearInterval(interval);
  }, [user, runSync]);

  // Flush the offline queues the moment connectivity comes back, instead of
  // waiting up to 5 minutes for the next tick.
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const handleOnline = () => {
      void runSync();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user, runSync]);
}
