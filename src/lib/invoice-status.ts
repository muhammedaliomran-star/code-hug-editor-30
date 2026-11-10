import type { Invoice, InvoicePaymentStatus, InvoiceStatus } from "@/types";

export function getInvoicePaymentStatus(invoice: Pick<Invoice, "total" | "paid" | "firstDueDate" | "status">): InvoicePaymentStatus {
  const remaining = Math.max(0, invoice.total - invoice.paid);
  if (remaining <= 0.005) return "paid";
  if (invoice.status !== "cancelled" && invoice.firstDueDate && new Date(`${invoice.firstDueDate}T23:59:59`).getTime() < Date.now()) return "overdue";
  if (invoice.paid > 0) return "partial";
  return "unpaid";
}

export function getInvoiceStatusMeta(status: InvoiceStatus | string | undefined) {
  switch (status) {
    case "draft": return { label: "مسودة", className: "bg-primary/10 text-primary border-primary/30" };
    case "held": return { label: "معلقة", className: "bg-warning/10 text-warning border-warning/30" };
    case "cancelled": return { label: "ملغاة", className: "bg-danger/10 text-danger border-danger/30" };
    case "returned_partial": return { label: "مرتجع جزئي", className: "bg-info/10 text-info border-info/30" };
    case "returned_full": return { label: "مرتجع بالكامل", className: "bg-info/10 text-info border-info/30" };
    case "paid": return { label: "مكتملة", className: "bg-primary/10 text-primary border-primary/30" };
    default: return { label: "مكتملة", className: "bg-primary/10 text-primary border-primary/30" };
  }
}

export function getPaymentStatusMeta(status: InvoicePaymentStatus) {
  switch (status) {
    case "paid": return { label: "مدفوعة بالكامل", className: "bg-success/10 text-success border-success/30" };
    case "partial": return { label: "مدفوعة جزئيًا", className: "bg-warning/10 text-warning border-warning/30" };
    case "overdue": return { label: "متأخرة", className: "bg-danger/10 text-danger border-danger/30" };
    default: return { label: "غير مدفوعة", className: "bg-danger/10 text-danger border-danger/30" };
  }
}
