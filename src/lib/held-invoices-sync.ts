/**
 * مزامنة الفواتير المعلّقة مع قاعدة البيانات السحابية.
 */

import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/retry";
import { enqueueOffline } from "@/lib/offline-queue";
import type { HeldInvoice } from "@/lib/held-invoices";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function pushHeldInvoice(invoice: HeldInvoice): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: invoice.id, user_id, source: invoice.source || "pos", customer_id: invoice.customerId || null, customer_name: invoice.customerName || null, customer_phone: invoice.customerPhone || null, sale_type: invoice.saleType || "cash", items: invoice.items, total: invoice.total, down_payment: invoice.downPayment ? Number(invoice.downPayment) : null, monthly_installment: invoice.monthlyInstallment ? Number(invoice.monthlyInstallment) : null, installment_count: invoice.installmentCount ? Number(invoice.installmentCount) : null, notes: invoice.notes || null, discount_pct: invoice.discountPct ? Number(invoice.discountPct) : null, discount_amt: invoice.discountAmt ? Number(invoice.discountAmt) : null, tax_pct: invoice.taxPct ? Number(invoice.taxPct) : null, shipping_address: invoice.shippingAddress || null };
  try { await withRetry(() => table("held_invoices").upsert(payload)); } catch { enqueueOffline({ tableName: "held_invoices", operation: "upsert", payload }); }
}

export async function removeHeldInvoice(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  try { await withRetry(() => table("held_invoices").delete().eq("user_id", user_id).eq("id", id)); } catch { enqueueOffline({ tableName: "held_invoices", operation: "delete", payload: { id, user_id } }); }
}

export async function pullHeldInvoicesFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const { data, error } = await table("held_invoices")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) return false;

  const items: HeldInvoice[] = data.map((r: any) => ({
    id: r.id,
    createdAt: r.created_at,
    source: r.source || "pos",
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    saleType: r.sale_type || "cash",
    items: r.items || [],
    total: Number(r.total || 0),
    downPayment: r.down_payment ? String(r.down_payment) : undefined,
    monthlyInstallment: r.monthly_installment ? String(r.monthly_installment) : undefined,
    installmentCount: r.installment_count ? String(r.installment_count) : undefined,
    notes: r.notes,
    discountPct: r.discount_pct ? String(r.discount_pct) : undefined,
    discountAmt: r.discount_amt ? String(r.discount_amt) : undefined,
    taxPct: r.tax_pct ? String(r.tax_pct) : undefined,
    shippingAddress: r.shipping_address,
  }));

  localStorage.setItem("segilly_held_invoices_v1", JSON.stringify(items));
  return true;
}
