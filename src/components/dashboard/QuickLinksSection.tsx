import { Wallet, Boxes, ShieldCheck, Truck, AlertCircle } from "lucide-react";
import { daysLate } from "@/lib/store";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { SectionHead, QuickLink } from "./shared";
import { useDashboard } from "./context";

export function QuickLinksSection() {
  const {
    treasuryLiquidityResult,
    treasuryLiquidity,
    money,
    inventoryStats,
    reconciliationSummary,
    shippingStats,
    data,
  } = useDashboard();

  return (
    <section className="mb-14">
      <Reveal className="h-full" delay={90}>
        <BezelCard variant="flat" className="h-full" innerClassName="h-full p-6 sm:p-8">
          <SectionHead title="الأقسام والمراكز الحيوية" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickLink
              to="/cashbox"
              icon={<Wallet className="h-4 w-4" />}
              title="الخزائن والحسابات البنكية"
              sub={treasuryLiquidityResult.error ?? `الرصيد: ${money(treasuryLiquidity ?? 0)}`}
            />
            <QuickLink
              to="/inventory"
              icon={<Boxes className="h-4 w-4" />}
              title="إدارة المخزون والمنتجات"
              sub={`قيمة المخزن: ${money(inventoryStats.totalCostValuation)}`}
            />
            <QuickLink
              to="/reconciliation"
              icon={<ShieldCheck className="h-4 w-4" />}
              title="مركز المطابقة والرقابة"
              sub={`مؤشر السلامة: ${reconciliationSummary.healthScore}%`}
            />
            <QuickLink
              to="/shipping"
              icon={<Truck className="h-4 w-4" />}
              title="شحن الطرود ومتحصلات COD"
              sub={`${shippingStats.unsettledCount} شحنة معلقة`}
            />
            <QuickLink
              to="/alerts"
              icon={<AlertCircle className="h-4 w-4" />}
              title="التنبيهات والأقساط"
              sub={`${data.invoices.filter((i) => daysLate(i) > 0 && i.paid < i.total).length} فاتورة متأخرة`}
              tone="danger"
            />
          </div>
        </BezelCard>
      </Reveal>
    </section>
  );
}