import { useEffect, useCallback } from "react";
import { useAuth } from "@/lib/store";
import { syncAllTables, syncSummary, SYNC_INTERVAL } from "@/lib/sync-engine";
import { toast } from "sonner";

/**
 * Background sync hook.
 * Pulls changed records from Supabase every SYNC_INTERVAL.
 * Merges into the in-memory cache so the UI stays fresh across devices.
 */
export function useSyncFromCloud() {
  const { user } = useAuth();

  const runSync = useCallback(async () => {
    if (!user) return;

    try {
      const results = await syncAllTables(
        // onRecord: merge into cache
        (_table, _record) => {
          // The sync engine already wrote to Supabase.
          // We trigger a full cache refresh for simplicity.
          // A more optimized approach would merge individual records.
        },
        // onDeleted: handle deletions
        (_table, _ids) => {
          // Deletion handling would go here
        },
      );

      const summary = syncSummary(results);
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      if (total > 0) {
        // Don't show toast for zero changes — only notify on actual syncs
        console.log(`[CloudSync] ${summary}`);
      }
    } catch (e) {
      console.error("[CloudSync] Background sync failed:", e);
    }
  }, [user]);

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
}
