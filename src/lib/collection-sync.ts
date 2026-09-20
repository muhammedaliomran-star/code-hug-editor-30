/**
 * مزامنة بيانات التحصيل (الوعود ومكالمات التحصيل) مع قاعدة البيانات السحابية.
 */

import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/retry";
import { enqueueOffline } from "@/lib/offline-queue";
import type { PromiseToPay, CollectionCallLog } from "@/lib/collection-store";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function pushPromise(p: PromiseToPay): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: p.invoiceId, user_id, invoice_id: p.invoiceId, customer_id: p.customerId, promised_date: p.promisedDate, promised_amount: p.promisedAmount, note: p.note || null, status: p.status || "pending" };
  try { await withRetry(() => table("collection_promises").upsert(payload)); } catch { enqueueOffline({ tableName: "collection_promises", operation: "upsert", payload }); }
}

export async function removePromise(invoiceId: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  try { await withRetry(() => table("collection_promises").delete().eq("user_id", user_id).eq("invoice_id", invoiceId)); } catch { enqueueOffline({ tableName: "collection_promises", operation: "delete", payload: { invoice_id: invoiceId, user_id } }); }
}

export async function pushCallLog(log: CollectionCallLog): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: log.id, user_id, invoice_id: log.invoiceId, customer_id: log.customerId, outcome: log.outcome, outcome_label: log.outcomeLabel, notes: log.notes || null, promised_date: log.promisedDate || null, promised_amount: log.promisedAmount || null };
  try { await withRetry(() => table("collection_call_logs").upsert(payload)); } catch { enqueueOffline({ tableName: "collection_call_logs", operation: "upsert", payload }); }
}

export async function pullCollectionFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const [promiseRes, logRes] = await Promise.all([
    table("collection_promises").select("*").eq("user_id", user_id),
    table("collection_call_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(200),
  ]);

  const mod = await import("@/lib/collection-store");

  // Restore promises
  if (!promiseRes.error && Array.isArray(promiseRes.data)) {
    const promises: Record<string, PromiseToPay> = {};
    promiseRes.data.forEach((r: any) => {
      promises[r.invoice_id] = {
        invoiceId: r.invoice_id,
        customerId: r.customer_id,
        promisedDate: r.promised_date,
        promisedAmount: Number(r.promised_amount || 0),
        note: r.note,
        createdAt: new Date(r.created_at).getTime(),
        status: r.status || "pending",
      };
    });
    localStorage.setItem("segilly:alerts:promises_v2", JSON.stringify(promises));
  }

  // Restore call logs
  if (!logRes.error && Array.isArray(logRes.data)) {
    const logs: CollectionCallLog[] = logRes.data.map((r: any) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      customerId: r.customer_id,
      date: new Date(r.created_at).getTime(),
      outcome: r.outcome,
      outcomeLabel: r.outcome_label,
      notes: r.notes,
      promisedDate: r.promised_date,
      promisedAmount: r.promised_amount ? Number(r.promised_amount) : undefined,
    }));
    localStorage.setItem("segilly:alerts:call_logs_v2", JSON.stringify(logs));
  }

  return true;
}
