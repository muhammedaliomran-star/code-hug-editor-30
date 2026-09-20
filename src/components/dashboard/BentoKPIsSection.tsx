import { Wallet, Boxes, PiggyBank, Banknote, Truck } from "lucide-react";
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
    monthBuckets,
    data,
  } = useDashboard();

  return (
    <section className="mb-14">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-fr">
        <Reveal className="col-span-2 h-full lg:row-span-2" delay={0}>
          <MetricCard
            hero
            className="h-full"
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

        <Reveal className="h-full" delay={70}>
          <MetricCard
            className="h-full"
            label="السيولة النقدية (الخزائن)"
            value={treasuryLiquidity ?? 0}
            format={treasuryLiquidity === null ? () => "غير متاح" : money}
            masked={privacy}
            tone={treasuryLiquidity === null || treasuryLiquidity < 0 ? "danger" : "positive"}
            icon={Wallet}
            sub={treasuryLiquidityResult.error ?? "رصيد لحظي موثّق من جميع الخزائن والحسابات"}
          />
        </Reveal>

        <Reveal className="h-full" delay={140}>
          <MetricCard
            className="h-full"
            label="قيمة المخزون بسعر التكلفة"
            value={inventoryStats.totalCostValuation}
            format={money}
            masked={privacy}
            tone="neutral"
            icon={Boxes}
            series={monthBuckets.cashPurchases}
            sub={
              inventoryStats.lowStockCount > 0 || inventoryStats.outOfStockCount > 0
                ? ${inventoryStats.outOfStockCount} نافد +  حرج
                : ${inventoryStats.totalUnits} قطعة إجمالي الرصيد
            }
          />
        </Reveal>

        <Reveal className="h-full" delay={210}>
          <MetricCard
            className="h-full"
            label={صافي الأرباح ()}
            value={netProfit}
            format={money}
            masked={privacy}
            tone={netProfit > 0 ? "positive" : netProfit < 0 ? "danger" : "neutral"}
            icon={PiggyBank}
            series={monthBuckets.profitTrend}
            sub={incompleteCostCount > 0 ? ${incompleteCostCount} فاتورة بيانات تكلفتها غير مكتملة : أرباح  − مصروفات }
          />
        </Reveal>

        <Reveal className="h-full" delay={245}>
          <MetricCard
            className="h-full"
            label={التحصيلات ()}
            value={rangeCollected}
            format={money}
            masked={privacy}
            tone={rangeCollected > 0 ? "positive" : "neutral"}
            icon={Banknote}
            series={monthBuckets.payments}
            sub="إجمالي الدفعات المحصلة خلال الفترة المختارة"
          />
        </Reveal>

        <Reveal className="h-full" delay={280}>
          <MetricCard
            className="h-full"
            label="ديون الموردين (المستحقة علينا)"
            value={totalSupplierDebt}
            format={money}
            masked={privacy}
            tone={totalSupplierDebt > 0 ? "danger" : "neutral"}
            icon={Truck}
            series={monthBuckets.supplierTrend}
            sub={${data.suppliers.length} مورد مسجل}
          />
        </Reveal>
      </div>
    </section>
  );
}
