import { fmt, daysLate, type Customer, type Invoice, type Payment } from "@/lib/store";
import { isoToDDMMYYYY } from "@/lib/date-utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import { toArabicDigits } from "@/lib/arabic-digits";

export type SortKey = "name" | "balance";
export type SortDir = "asc" | "desc";
export type FilterTab =
  | "all"
  | "installment"
  | "dueToday"
  | "overdue"
  | "cash"
  | "frozen"
  | "bajah"
  | "settled";

export function SortChip({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-[transform,color,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
        active
          ? "bg-foreground text-background ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

export function customerMetrics(invoices: Invoice[], c: Customer) {
  const mine = invoices.filter((i) => i.customerId === c.id);
  const totalCharged = mine.reduce((s, i) => s + i.total, 0) + (c.openingBalance || 0);
  const totalPaid = mine.reduce((s, i) => s + i.paid, 0);
  const balance = totalCharged - totalPaid;
  const worstLate = Math.max(0, ...mine.map(daysLate));
  const paidPct =
    totalCharged > 0 ? Math.min(100, Math.round((totalPaid / totalCharged) * 100)) : 0;
  return { balance, worstLate, paidPct, totalCharged, totalPaid };
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.86 11.86 0 0012.06 0C5.5 0 .17 5.33.17 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.32-1.65a11.9 11.9 0 005.74 1.46h.01c6.55 0 11.88-5.33 11.88-11.9 0-3.18-1.24-6.16-3.43-8.43zM12.07 21.8h-.01a9.9 9.9 0 01-5.05-1.38l-.36-.21-3.75.98 1-3.65-.24-.38a9.86 9.86 0 01-1.51-5.26c0-5.46 4.45-9.9 9.92-9.9 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 012.9 7c0 5.47-4.44 9.89-9.91 9.89zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
    </svg>
  );
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export type TimelineEntry = {
  id: string;
  date: string;
  kind: "opening" | "purchase" | "payment";
  description: string;
  amount: number;
  runningBalance: number;
};

export function buildTimeline(c: Customer, invoices: Invoice[], payments: Payment[]): TimelineEntry[] {
  type Raw = {
    id: string;
    date: string;
    kind: TimelineEntry["kind"];
    description: string;
    amount: number;
  };
  const raw: Raw[] = [];

  if (c.openingBalance && c.openingBalance > 0) {
    raw.push({
      id: `opening-${c.id}`,
      date: `${c.joiningDate}T00:00:00`,
      kind: "opening",
      description: "رصيد افتتاحي عند الانضمام",
      amount: c.openingBalance,
    });
  }
  for (const inv of invoices) {
    raw.push({
      id: `inv-${inv.id}`,
      date: inv.createdAt,
      kind: "purchase",
      description: inv.notes?.trim()
        ? inv.notes
        : `فاتورة بتاريخ استحقاق ${isoToDDMMYYYY(inv.firstDueDate)}`,
      amount: inv.total,
    });
    if (inv.downPayment > 0) {
      raw.push({
        id: `down-${inv.id}`,
        date: inv.createdAt,
        kind: "payment",
        description: `مقدم على فاتورة (${(inv.notes || "").trim() || "بدون وصف"})`,
        amount: inv.downPayment,
      });
    }
  }
  for (const p of payments) {
    const inv = invoices.find((i) => i.id === p.invoiceId);
    raw.push({
      id: `pay-${p.id}`,
      date: p.paidAt,
      kind: "payment",
      description: `سداد على فاتورة ${inv?.notes ? `«${inv.notes}»` : `#${p.invoiceId.slice(0, 6)}`}`,
      amount: p.amount,
    });
  }

  raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let bal = 0;
  const ascending: TimelineEntry[] = raw.map((r) => {
    bal += r.kind === "payment" ? -r.amount : r.amount;
    return { ...r, runningBalance: bal };
  });
  return ascending.reverse();
}

export function exportStatementPDF(
  c: Customer,
  m: { balance: number; totalCharged: number; totalPaid: number; worstLate: number },
  invoices: Invoice[],
  payments: Payment[],
  autoPrint: boolean,
) {
  const timelineDesc = buildTimeline(c, invoices, payments);
  const timeline = [...timelineDesc].reverse();
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const joining = isoToDDMMYYYY(c.joiningDate);

  const rows = timeline
    .map((t, i) => {
      const isPay = t.kind === "payment";
      const typeLabel =
        t.kind === "purchase" ? "مشترى" : t.kind === "opening" ? "رصيد افتتاحي" : "سداد";
      return `
      <tr>
        <td>${i + 1}</td>
        <td dir="ltr">${escapeHtml(isoToDDMMYYYY(t.date.slice(0, 10)))}</td>
        <td><span class="tag ${t.kind}">${typeLabel}</span></td>
        <td>${escapeHtml(t.description)}</td>
        <td class="num ${isPay ? "pay" : "buy"}">${isPay ? "−" : "+"} ${fmt(t.amount)}</td>
        <td class="num ${t.runningBalance > 0 ? "due" : "ok"}">${fmt(t.runningBalance)}</td>
      </tr>`;
    })
    .join("");

  const body = `
<div class="info">
  <div class="box"><b>اسم العميل</b> ${escapeHtml(c.name)}</div>
  <div class="box"><b>رقم الهاتف</b> <span dir="ltr">${escapeHtml(c.phone)}</span></div>
  <div class="box"><b>العنوان</b> ${escapeHtml(c.address || "—")}</div>
  <div class="box"><b>تاريخ الانضمام</b> <span dir="ltr">${escapeHtml(joining)}</span></div>
</div>
<h2 class="sec">حركة الحساب</h2>
<div class="t-wrap"><table>
  <thead><tr>
    <th>م</th><th>التاريخ</th><th>نوع الحركة</th><th>البيان</th><th class="num">المبلغ (ج.م)</th><th class="num">الرصيد المتبقي (ج.م)</th>
  </tr></thead>
  <tbody>${rows || `<tr><td colspan="6" class="empty">لا توجد حركات منذ تاريخ الانضمام</td></tr>`}</tbody>
  <tfoot><tr>
    <td colspan="4">الرصيد النهائي المستحق على العميل</td>
    <td class="num" colspan="2">${fmt(m.balance)} ج.م</td>
  </tr></tfoot>
</table></div>
<div class="total-bar"><span>الرصيد المستحق حالياً</span><span class="v">${fmt(m.balance)} ج.م</span></div>
<div class="sig"><div>توقيع المسؤول</div><div>توقيع العميل</div><div>الختم الرسمي</div></div>`;

  const html = pdfDocument({
    docTitle: `كشف حساب — ${escapeHtml(c.name)} — سِجلّي`,
    badge: "مستند رسمي",
    title: "كشف حساب تاريخي للعميل",
    lede: `يشمل كل الحركات منذ ${escapeHtml(joining)}.`,
    brandSub: "نظام إدارة العملاء والأقساط — كشف حساب رسمي",
    meta: [
      { label: "تاريخ الإصدار", value: today },
      { label: "رقم الكشف", value: `SG-${c.id.slice(0, 8).toUpperCase()}` },
    ],
    kpis: [
      { label: "عدد الحركات", value: String(timeline.length) },
      { label: "إجمالي المستحق", value: `${fmt(m.totalCharged)} ج.م`, tone: "danger" },
      { label: "إجمالي المسدد", value: `${fmt(m.totalPaid)} ج.م`, tone: "brand" },
      {
        label: "الرصيد المتبقي",
        value: `${fmt(m.balance)} ج.م`,
        tone: m.balance > 0 ? "danger" : "brand",
      },
    ],
    body,
    page: "A4",
  });

  if (!openPdfDocument(html, { autoPrint, features: "width=1000,height=800" })) {
    toast.error("الرجاء السماح بفتح النوافذ المنبثقة لتصدير PDF");
    return;
  }
  toast.success(autoPrint ? "جاري تجهيز الطباعة..." : "تم تجهيز كشف الحساب التاريخي");
}

export function shareStatement(
  c: Customer,
  m: { balance: number; totalCharged: number; totalPaid: number; worstLate: number },
  invoices: Invoice[],
  payments: { id: string; invoiceId: string; amount: number; paidAt: string }[],
) {
  const lines: string[] = [];
  lines.push(`📋 كشف حساب — ${c.name}`);
  lines.push(`📞 ${c.phone}`);
  lines.push(`📅 ${new Date().toLocaleDateString("en-US")}`);
  lines.push("―――――――――――――");
  lines.push(`💰 إجمالي المعاملات: ${fmt(m.totalCharged)} ج.م`);
  lines.push(`✅ إجمالي المسدد: ${fmt(m.totalPaid)} ج.م`);
  lines.push(`🔴 المتبقي: ${fmt(m.balance)} ج.م`);
  if (m.worstLate > 0) lines.push(`⏰ أقصى تأخير: ${m.worstLate} يوم`);
  lines.push("");
  if (invoices.length) {
    lines.push("🧾 الفواتير:");
    invoices.forEach((inv, i) => {
      const rem = inv.total - inv.paid;
      lines.push(
        `${i + 1}) ${fmt(inv.total)} ج.م — متبقي ${fmt(rem)} — استحقاق ${inv.firstDueDate}`,
      );
    });
    lines.push("");
  }
  if (payments.length) {
    lines.push("💵 آخر المدفوعات:");
    payments.slice(0, 5).forEach((p) => {
      lines.push(`• ${fmt(p.amount)} ج.م — ${new Date(p.paidAt).toLocaleDateString("en-US")}`);
    });
  }
  lines.push("");
  lines.push("— سِجلّي");
  const text = lines.join("\n");
  const phone = c.phone.replace(/^0/, "20");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(toArabicDigits(text))}`, "_blank");
  toast.success("جاري فتح واتساب لمشاركة الكشف");
}
