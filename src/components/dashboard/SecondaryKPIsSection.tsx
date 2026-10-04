import { Link } from "@/lib/router-compat";
import { Users, Truck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { MetricCard } from "@/components/MetricCard";
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
          <MetricCard
            icon={Users}
            label="العملاء والنشاط"
            value={activeCustomers}
            format={(n) => String(Math.round(n))}
            tone="neutral"
            sub={frozenCustomers > 0 ? `${frozenCustomers} مجمد | ${data.customers.filter(c => c.status === "committed").length} ملتزم بالدفع` : `${data.customers.filter(c => c.status === "committed").length} ملتزم بالدفع`}
          />
        </Reveal>

        <Reveal delay={340}>
          <MetricCard
            icon={Truck}
            label="شحنات COD المعلقة"
            value={money(shippingStats.pendingCodAmount)}
            tone="neutral"
            sub={`${shippingStats.unsettledCount} شحنة مسلّمة تنتظر التوريد للخزينة} ${shippingStats.collectedCount} محصّلة باليد ($${money(shippingStats.collectedCodAmount)}) • ${shippingStats.uncollectedCount} عند العملاء ($${money(shippingStats.uncollectedCodAmount)})`}
          />
        </Reveal>

        <Reveal delay={360}>
          <MetricCard
            icon={ShieldCheck}
            label="مؤشر الرقابة المحاسبية"
            value={reconciliationSummary.healthScore}
            tone={reconciliationSummary.healthScore >= 90 ? "positive" : reconciliationSummary.healthScore >= 70 ? "neutral" : "danger"}
            sub={`${reconciliationSummary.criticalCount} حرج | ${reconciliationSummary.autoFixableCount} قابل للإصلاح الآلي`}
          />
        </Reveal>
      </div>
    </section>
  );
}
