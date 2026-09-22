import { Link } from "@/lib/router-compat";
import { Users, Truck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { MetricLabel } from "@/components/MetricCard";
import { useDashboard } from "./context";

export function SecondaryKPIsSection() {
  const {
    activeCustomers,
    frozenCustomers,
    data,
    privacy,
    money,
    shippingStats,
    reconciliationSummary,
  } = useDashboard();

  return (
    <section className="mb-14">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Reveal delay={320}>
          <BezelCard variant="flat" className="h-full" innerClassName="p-4 flex items-center justify-between">
            <div className="space-y-1 text-right">
              <MetricLabel>العملاء والنشاط</MetricLabel>
              <div className={cn("text-xl font-extrabold text-foreground", privacy && "privacy-blur")}>
                {activeCustomers} نشط <span className="text-xs text-muted-foreground font-normal">/ {data.customers.length} إجمالي</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {frozenCustomers} مجمد | {data.customers.filter(c => c.status === "committed").length} ملتزم بالدفع
              </div>
            </div>
            <Link
              to="/customers"
              className="p-2.5 rounded-xl bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground transition-colors"
              title="إدارة العملاء"
            >
              <Users className="h-5 w-5" />
            </Link>
          </BezelCard>
        </Reveal>

        <Reveal delay={340}>
          <BezelCard variant="flat" className="h-full" innerClassName="p-4 flex items-center justify-between">
            <div className="space-y-1 text-right">
              <MetricLabel>شحنات COD المعلقة</MetricLabel>
              <div className={cn("text-xl font-extrabold text-foreground", privacy && "privacy-blur")}>
                {money(shippingStats.pendingCodAmount)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {shippingStats.unsettledCount} شحنة مسلّمة تنتظر التوريد للخزينة
              </div>
              <div className="text-[11px] text-muted-foreground">
                {shippingStats.collectedCount} محصّلة باليد ({money(shippingStats.collectedCodAmount)}) • {shippingStats.uncollectedCount} عند العملاء ({money(shippingStats.uncollectedCodAmount)})
              </div>
            </div>
            <Link
              to="/shipping"
              className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              title="متابعة الشحن"
            >
              <Truck className="h-5 w-5" />
            </Link>
          </BezelCard>
        </Reveal>

        <Reveal delay={360}>
          <BezelCard variant="flat" className="h-full" innerClassName="p-4 flex items-center justify-between">
            <div className="space-y-1 text-right">
              <MetricLabel>مؤشر الرقابة المحاسبية</MetricLabel>
              <div className={cn("text-xl font-extrabold flex items-center gap-1.5", reconciliationSummary.healthScore >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                <span>{reconciliationSummary.healthScore}%</span>
                <span className="text-xs font-medium text-muted-foreground">
                  ({reconciliationSummary.healthScore >= 90 ? "مطابق" : "ملاحظات معلقة"})
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {reconciliationSummary.criticalCount} حرج | {reconciliationSummary.autoFixableCount} قابل للإصلاح الآلي
              </div>
            </div>
            <Link
              to="/reconciliation"
              className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
              title="فتح مركز المطابقة"
            >
              <ShieldCheck className="h-5 w-5" />
            </Link>
          </BezelCard>
        </Reveal>
      </div>
    </section>
  );
}
