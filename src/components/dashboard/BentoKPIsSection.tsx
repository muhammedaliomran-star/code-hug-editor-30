import { Wallet, Boxes, PiggyBank, Banknote, Truck, Users, ShieldCheck, TrendingUp, Receipt, FileText } from "lucide-react";
import { fmt } from "@/lib/store";
import { Reveal } from "@/components/Reveal";
import { MetricCard } from "@/components/MetricCard";
import { useDashboard } from "./context";

export function BentoKPIsSection() {
  const {
    privacy,
    money,
    m,
    totalDebt,
    treasuryLiquidity,
    treasuryLiquidityResult,
    inventoryStats,
    netProfit,
    rangeLabel,
    grossProfit,
    expensesTotal,
    incompleteCostCount,
    rangeCollected,
    totalSupplierDebt,
    activeCustomers,
    frozenCustomers,
    shippingStats,
    reconciliationSummary,
    monthBuckets,
    data,
  } = useDashboard();

  return (
    <section className="mb-14">
      <div className="grid auto-rows-fr grid-cols-2 gap-0 lg:grid-cols-4">
        <Reveal className="h-full ring-0" delay={0}>
          <MetricCard
            className="h-full ring-0"
            label="إجمالي الديون الخارجية (لدى العملاء)"
            value={totalDebt}
            format={money}
            masked={privacy}
            tone="neutral"
            icon={Wallet}
            series={monthBuckets.debtTrend}
            sub={
              <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                <span>موزعة على {data.customers.length} عميل</span>
                <span className="h-3 w-px bg-border" />
                <span>{data.invoices.length} فاتورة مسجلة</span>
              </span>
            }
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={70}>
          <MetricCard
            className="h-full ring-0"
            label="السيولة النقدية (الخزائن)"
            value={treasuryLiquidity ?? 0}
            format={treasuryLiquidity === null ? () => "غير متاح" : money}
            masked={privacy}
            tone={treasuryLiquidity === null || treasuryLiquidity < 0 ? "danger" : "positive"}
            icon={Wallet}
            sub={treasuryLiquidityResult.error ?? "رصيد لحظي موثّق من جميع الخزائن والحسابات"}
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={140}>
          <MetricCard
            className="h-full ring-0"
            label="قيمة المخزون بسعر التكلفة"
            value={inventoryStats.totalCostValuation}
            format={money}
            masked={privacy}
            tone="neutral"
            icon={Boxes}
            series={monthBuckets.cashPurchases}
            sub={
              inventoryStats.lowStockCount > 0 || inventoryStats.outOfStockCount > 0
                ? `${inventoryStats.outOfStockCount} نافد + ${inventoryStats.lowStockCount} حرج`
                : `${inventoryStats.totalUnits} قطعة إجمالي الرصيد`
            }
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={210}>
          <MetricCard
            className="h-full ring-0"
            label={`صافي الأرباح (${rangeLabel})`}
            value={netProfit}
            format={money}
            masked={privacy}
            tone={netProfit > 0 ? "positive" : netProfit < 0 ? "danger" : "neutral"}
            icon={PiggyBank}
            series={monthBuckets.profitTrend}
            sub={
              incompleteCostCount > 0
                ? `${incompleteCostCount} فاتورة بيانات تكلفتها غير مكتملة`
                : `أرباح ${fmt(grossProfit)} − مصروفات ${fmt(expensesTotal)}`
            }
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={245}>
          <MetricCard
            className="h-full ring-0"
            label={`التحصيلات (${rangeLabel})`}
            value={rangeCollected}
            format={money}
            masked={privacy}
            tone={rangeCollected > 0 ? "positive" : "neutral"}
            icon={Banknote}
            series={monthBuckets.payments}
            sub="إجمالي الدفعات المحصلة خلال الفترة المختارة"
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={280}>
          <MetricCard
            className="h-full ring-0"
            label="ديون الموردين (المستحقة علينا)"
            value={totalSupplierDebt}
            format={money}
            masked={privacy}
            tone={totalSupplierDebt > 0 ? "danger" : "neutral"}
            icon={Truck}
            series={monthBuckets.supplierTrend}
            sub={`${data.suppliers.length} مورد مسجل`}
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={320}>
          <MetricCard
            className="h-full ring-0"
            icon={Users}
            label="العملاء والنشاط"
            value={activeCustomers}
            format={(n) => String(Math.round(n))}
            tone="neutral"
            sub={frozenCustomers > 0 ? `${frozenCustomers} مجمد | ${data.customers.filter((c) => c.status === "committed").length} ملتزم بالدفع` : `${data.customers.filter((c) => c.status === "committed").length} ملتزم بالدفع`}
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={340}>
          <MetricCard
            className="h-full ring-0"
            icon={Truck}
            label="شحنات COD المعلقة"
            value={shippingStats.pendingCodAmount}
            format={(n) => money(n)}
            tone="neutral"
            sub={`${shippingStats.unsettledCount} شحنة مسلّمة تنتظر التوريد للخزينة • ${shippingStats.collectedCount} محصّلة باليد (${money(shippingStats.collectedCodAmount)}) • ${shippingStats.uncollectedCount} عند العملاء (${money(shippingStats.uncollectedCodAmount)})`}
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={360}>
          <MetricCard
            className="h-full ring-0"
            icon={ShieldCheck}
            label="مؤشر الرقابة المحاسبية"
            value={reconciliationSummary.healthScore}
            format={(n) => `${Math.round(n)}%`}
            tone={reconciliationSummary.healthScore >= 90 ? "positive" : reconciliationSummary.healthScore >= 70 ? "neutral" : "danger"}
            sub={`${reconciliationSummary.criticalCount} حرج | ${reconciliationSummary.autoFixableCount} قابل للإصلاح الآلي`}
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={395}>
          <MetricCard
            className="h-full ring-0"
            icon={TrendingUp}
            label="إجمالي الأرباح (قبل المصروفات)"
            value={grossProfit}
            format={money}
            masked={privacy}
            tone={grossProfit > 0 ? "positive" : "neutral"}
            sub="إجمالي الإيرادات قبل خصم المصروفات"
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={430}>
          <MetricCard
            className="h-full ring-0"
            icon={Receipt}
            label="إجمالي المصروفات"
            value={expensesTotal}
            format={money}
            masked={privacy}
            tone="neutral"
            sub="إجمالي مصروفات الفترة المختارة"
          />
        </Reveal>

        <Reveal className="h-full ring-0" delay={465}>
          <MetricCard
            className="h-full ring-0"
            icon={FileText}
            label="عدد الفواتير المسجلة"
            value={data.invoices.length}
            format={(n) => String(Math.round(n))}
            tone="neutral"
            sub={`${data.customers.length} عميل مسجل`}
          />
        </Reveal>
      </div>
    </section>
  );
}
