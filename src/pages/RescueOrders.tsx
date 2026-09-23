import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, useDB, type ShipmentStatus } from "@/lib/store";
import { AlertTriangle, CheckCircle2, ChevronLeft, MessageCircle, Phone, RefreshCw, Search, ShieldAlert, Truck } from "lucide-react";
import { toast } from "sonner";
import { renderRescuePending, waLink, trackUrlFor } from "@/lib/whatsapp-templates";
import { useShopSettings } from "@/lib/store";

type RescueRow = { id: string; invoiceId: string | null; number: string; customer: string; phone: string; address: string; status: string; reason: string; createdAt: string; shipmentId: string | null; priority: "urgent" | "high" | "normal" };

const labels: Record<string, string> = { pending: "الشحنة لم تبدأ", processing: "التجهيز متأخر", shipped: "الشحن متأخر", returned: "الشحنة مرتجعة", cancelled: "ملغي" };
const ageInDays = (date: string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));

export default function RescueOrders() {
  const { shipments } = useDB();
  const { settings } = useShopSettings();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "urgent" | "shipment">("all");

  const rows = useMemo<RescueRow[]>(() => {
    const result: RescueRow[] = [];
    for (const shipment of shipments) {
      const age = ageInDays(shipment.createdAt);
      const risk = shipment.status === "pending" && age >= 1 || shipment.status === "processing" && age >= 1 || shipment.status === "shipped" && age >= 3 || shipment.status === "returned" || shipment.status === "cancelled" || !shipment.trackingNumber && age >= 1;
      if (!risk) continue;
      const reason = !shipment.trackingNumber ? "لم يتم تسجيل رقم تتبع" : `الشحنة في الحالة ${labels[shipment.status] ?? shipment.status} منذ ${age} يوم`;
      result.push({ id: shipment.id, invoiceId: shipment.invoiceId, number: shipment.invoiceId?.slice(0, 8) ?? shipment.id.slice(0, 8), customer: shipment.recipientName ?? "عميل غير معروف", phone: shipment.recipientPhone ?? "", address: shipment.deliveryAddress ?? "", status: shipment.status, reason, createdAt: shipment.createdAt, shipmentId: shipment.id, priority: shipment.status === "returned" || shipment.status === "cancelled" || age >= 3 ? "urgent" : age >= 1 ? "high" : "normal" });
    }
    return result.sort((a, b) => (a.priority === "urgent" ? -1 : b.priority === "urgent" ? 1 : 0));
  }, [shipments]);

  const filtered = useMemo(() => rows.filter((r) => (filter === "all" || r.priority === (filter === "urgent" ? "urgent" : "high")) && `${r.number} ${r.customer} ${r.phone}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, filter, query]);

  const urgentCount = rows.filter((r) => r.priority === "urgent").length;

  const markShipped = async (shipmentId: string) => {
    try {
      await db.updateShipmentStatus(shipmentId, "shipped");
      toast.success("تم تحديث الشحنة");
    } catch { toast.error("تعذر التحديث"); }
  };

  return (
    <AppShell>
      <PageHeader
        title="طلبات الإنقاذ والإ抢救"
        subtitle={`${rows.length} شحنة تحتاج إجراء — ${urgentCount} عاجل`}
        icon={<ShieldAlert className="h-7 w-7" />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <BezelCard variant="flat" className="p-4"><p className="text-xs text-muted-foreground">إجمالي الطلبات</p><p className="mt-2 text-2xl font-black">{rows.length}</p></BezelCard>
        <BezelCard variant="flat" className="p-4"><p className="text-xs text-muted-foreground">عاجل</p><p className="mt-2 text-2xl font-black text-red-600">{urgentCount}</p></BezelCard>
        <BezelCard variant="flat" className="p-4"><p className="text-xs text-muted-foreground">مرتجع</p><p className="mt-2 text-2xl font-black text-orange-600">{rows.filter((r) => r.status === "returned").length}</p></BezelCard>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالرقم أو الاسم أو الهاتف" className="pr-10" /></div>
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>الكل</Button>
        <Button variant={filter === "urgent" ? "default" : "outline"} size="sm" onClick={() => setFilter("urgent")}>عاجل</Button>
      </div>

      {filtered.length === 0 ? <BezelCard className="p-10 text-center text-muted-foreground">مفيش طلبات مطابقة.</BezelCard> : (
        <div className="grid gap-3">
          {filtered.map((row) => (
            <Reveal key={row.id}>
              <BezelCard className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.number} — {row.customer}</p>
                    <p className="text-sm text-muted-foreground">{row.phone} · {labels[row.status] ?? row.status} · {ageInDays(row.createdAt)} يوم</p>
                    <p className="text-sm text-muted-foreground">{row.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    {row.phone && <Button size="sm" variant="outline" onClick={() => window.open(waLink(row.phone, renderRescuePending({ shop: { shopName: settings.shopName }, customer: row.customer, phone: row.phone, number: row.number, statusLabel: labels[row.status] ?? row.status, reason: row.reason, ageDays: ageInDays(row.createdAt), address: row.address })), "_blank", "noopener,noreferrer")} className="gap-1"><MessageCircle className="h-3 w-3" /> واتساب</Button>}
                    {row.shipmentId && row.status !== "shipped" && <Button size="sm" onClick={() => void markShipped(row.shipmentId!)} className="gap-1"><CheckCircle2 className="h-3 w-3" /> تم الشحن</Button>}
                  </div>
                </div>
              </BezelCard>
            </Reveal>
          ))}
        </div>
      )}
    </AppShell>
  );
}
