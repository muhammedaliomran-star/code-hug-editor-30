import { useEffect } from "react";
import { useAuth } from "@/lib/store";

export function useSyncFromCloud() {
  const { user } = useAuth();

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
      } catch (e) {
        console.error("[CloudSync] pull failed:", e);
      }
    }

    pullAll();

    return () => {
      cancelled = true;
    };
  }, [user]);
}
