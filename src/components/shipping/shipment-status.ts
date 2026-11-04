import type { ShipmentStatus } from "@/lib/store";

export const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  processing: { label: "جاري التجهيز", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  shipped: { label: "تم الشحن", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  delivered: { label: "تم التوصيل", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  returned: { label: "مرتجع", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  cancelled: { label: "ملغي", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

export const collectionMap: Record<string, { label: string; color: string }> = {
  uncollected: { label: "لم يُحصّل", color: "bg-slate-500/10 text-slate-500" },
  collected: { label: "محصّل مع المندوب", color: "bg-amber-500/10 text-amber-500" },
  settled: { label: "مُسوّى", color: "bg-emerald-500/10 text-emerald-500" },
};

export const egp = (n: number) =>
  `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

export function allowedShipmentStatuses(status: ShipmentStatus): ShipmentStatus[] {
  if (status === "pending") return ["pending", "processing", "cancelled"];
  if (status === "processing") return ["processing", "shipped", "cancelled"];
  if (status === "shipped") return ["shipped", "delivered", "returned"];
  if (status === "delivered") return ["delivered", "returned"];
  return [status];
}
