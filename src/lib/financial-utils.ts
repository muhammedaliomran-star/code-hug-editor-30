import { supabase } from "@/integrations/supabase/client";

import type {
  ExpenseCategory,
  Purchase,
  SupplierPayment,
  Invoice,
  Customer,
  StockItem,
  StockHistoryEntry,
} from "@/types";

import { EXPENSE_CATEGORIES, LOW_STOCK_THRESHOLD, EMPTY_SHOP_SETTINGS } from "@/types/constants";

import { shopCache, fmt } from "./shop-settings";

// ─── Expense helpers ──────────────────────────────────────────────────────────

export function expenseCategoryLabel(c: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

// ─── Balance helpers ──────────────────────────────────────────────────────────

export function supplierBalance(
  purchases: Purchase[],
  payments: SupplierPayment[],
  supplierId: string,
  openingBalance = 0,
) {
  const credit = purchases
    .filter((p) => p.supplierId === supplierId && p.paymentType === "credit")
    .reduce((s, p) => s + p.total, 0);
  const paid = payments
    .filter((p) => p.supplierId === supplierId)
    .reduce((s, p) => s + p.amount, 0);
  return openingBalance + credit - paid;
}

export function customerBalance(invoices: Invoice[], customerId: string, openingBalance = 0) {
  return openingBalance + invoices.filter((i) => i.customerId === customerId).reduce((s, i) => s + (i.total - i.paid), 0);
}

// ─── Invoice helpers ──────────────────────────────────────────────────────────

export function daysLate(inv: Invoice) {
  if (inv.paid >= inv.total) return 0;
  const diff = Math.floor((Date.now() - new Date(inv.firstDueDate).getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function reminderDaysBefore() {
  return shopCache?.reminderDaysBefore ?? EMPTY_SHOP_SETTINGS.reminderDaysBefore;
}

export function isDueSoonOrOverdue(
  inv: { firstDueDate: string; paid: number; total: number },
  daysBefore = reminderDaysBefore(),
) {
  if (inv.paid >= inv.total) return false;
  const due = new Date(inv.firstDueDate); due.setHours(0, 0, 0, 0);
  const limit = new Date(); limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + Math.max(0, daysBefore));
  return due.getTime() <= limit.getTime();
}

export function daysUntilDue(inv: { firstDueDate: string }) {
  const due = new Date(inv.firstDueDate); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/**
 * Phase 1 (#18): single source of truth for "due day" matching.
 * A customer's dueDay matches when it equals the calendar day of month.
 * Use this everywhere instead of inline `dueDay === new Date().getDate()`.
 */
export function isDueDay(
  dueDay: number | null | undefined,
  ref: Date = new Date(),
): boolean {
  return typeof dueDay === "number" && dueDay === ref.getDate();
}

export function invoiceNumber(invoices: Invoice[], invoiceId: string, prefix = shopCache?.invoicePrefix ?? "") {
  const ordered = [...invoices].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const idx = ordered.findIndex((i) => i.id === invoiceId);
  const serial = String(idx >= 0 ? idx + 1 : ordered.length + 1).padStart(4, "0");
  const p = (prefix || "").trim();
  return p ? `${p}-${serial}` : `#${serial}`;
}

// ─── Stock helpers ────────────────────────────────────────────────────────────

export function lowStockThreshold() {
  return shopCache?.lowStockThreshold ?? LOW_STOCK_THRESHOLD;
}

export function lowStockCount(items: StockItem[], threshold = lowStockThreshold()) {
  return items.filter((it) => it.quantity < threshold).length;
}

export function findStockByBarcode(items: StockItem[], code: string): StockItem | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return items.find((it) => (it.barcode ?? "").trim() === c);
}

export async function fetchStockHistory(stockItemId: string, name: string): Promise<StockHistoryEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const [pi, ii, adj] = await Promise.all([
    supabase.from("purchase_items").select("id,name,quantity,created_at,purchase_id").eq("user_id", user.id).eq("name", name),
    supabase.from("invoice_items").select("id,name,created_at,invoice_id").eq("user_id", user.id).eq("name", name),
    supabase.from("stock_adjustments").select("id,delta,reason,notes,created_at").eq("user_id", user.id).eq("stock_item_id", stockItemId),
  ]);
  const out: StockHistoryEntry[] = [];
  for (const r of (pi.data ?? [])) {
    out.push({ id: `p-${r.id}`, date: r.created_at, type: "purchase", qty: Number(r.quantity ?? 0), ref: "فاتورة شراء" });
  }
  for (const r of (ii.data ?? [])) {
    out.push({ id: `i-${r.id}`, date: r.created_at, type: "sale", qty: -1, ref: "فاتورة بيع" });
  }
  for (const r of (adj.data ?? [])) {
    out.push({ id: `a-${r.id}`, date: r.created_at, type: "adjustment", qty: Number(r.delta ?? 0), reason: r.reason, notes: r.notes });
  }
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── AI helper ────────────────────────────────────────────────────────────────

export function aiScript(c: Customer, balance: number, lateDays: number): string {
  if (c.status === "defaulter") {
    const months = Math.max(1, Math.floor(Math.max(lateDays, 30) / 30));
    return `السيد/ ${c.name} المحترم،\nنحيطكم علماً بأن حسابكم لدينا متأخر السداد منذ ${months} شهر، وقد بلغ الرصيد المستحق عليكم مبلغ ${fmt(balance)} ج.م.\nنمنحكم مهلة نهائية للسداد خلال (7) أيام من تاريخه، وفي حال عدم الاستجابة سنضطر آسفين لاتخاذ كافة الإجراءات القانونية اللازمة لاسترداد حقوقنا، وتحميلكم كافة المصاريف القضائية.\nنأمل المبادرة بالسداد تجنباً للإجراءات.\nوتفضلوا بقبول وافر الاحترام.`;
  }
  if (c.status === "committed") {
    return `يا أستاذ ${c.name}، تحية طيبة 🌿\nبنشكرك على التزامك الدائم في السداد، وده اللي خلانا نخصّك بعرض مميز:\n🎁 خصم 10% على مشترياتك الجاية، وسقف ائتماني أعلى من غير مقدم.\nالعرض ساري لمدة أسبوع. تحت أمرك في أي وقت.`;
  }
  if (lateDays <= 0)
    return `يا أستاذ ${c.name}، تحية طيبة. حسابك تمام معانا، وأي وقت محتاج بضاعة جديدة إحنا تحت أمرك.`;
  if (lateDays < 7)
    return `يا أستاذ ${c.name}، تذكير بسيط وعلى راحتك: عليك متبقي ${fmt(balance)} ج.م. لو فيه أي استفسار إحنا تحت أمرك.`;
  if (lateDays <= 30)
    return `يا أستاذ ${c.name}، بقالك ${lateDays} يوم متأخر على القسط. محتاجين نشرفنا في المحل لتحديث الحساب. المتبقي: ${fmt(balance)} ج.م.`;
  const months = Math.max(1, Math.floor(lateDays / 30));
  return `يا أستاذ ${c.name}، الحساب متوقف تماماً وبقالنا ${months} شهر من غير سداد. لازم الحساب يتقفل لتجنب الإجراءات القانونية. المتبقي: ${fmt(balance)} ج.م.`;
}
