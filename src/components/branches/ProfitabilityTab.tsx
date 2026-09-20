import { useBranches } from "./context";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/store";
import { getExpensesForBranch, calculateBranchProfitability } from "@/lib/branch-system";

export default function ProfitabilityTab() {
  const { activeBranch, invoices, expenses, cur } = useBranches();

  if (!activeBranch) return null;

  const pl = calculateBranchProfitability(activeBranch, invoices, expenses);
  const branchExpensesList = getExpensesForBranch(activeBranch.id, expenses);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-foreground/10 bg-card">
          <span className="text-xs text-muted-foreground font-bold block">إجمالي إيرادات الفرع</span>
          <span className="text-2xl font-black text-primary tabular-nums mt-1 block">
            {fmt(pl.totalRevenue)} {cur}
          </span>
          <span className="text-[10px] text-muted-foreground">({pl.invoicesCount} فاتورة مسجلة)</span>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-card">
          <span className="text-xs text-muted-foreground font-bold block">تكلفة البضاعة المباعة (COGS)</span>
          <span className="text-2xl font-black text-muted-foreground tabular-nums mt-1 block">
            {fmt(pl.totalCogs)} {cur}
          </span>
          <span className="text-[10px] text-muted-foreground">مجمل الربح: {fmt(pl.grossProfit)} {cur}</span>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-card">
          <span className="text-xs text-muted-foreground font-bold block">المصروفات التشغيلية للفرع</span>
          <span className="text-2xl font-black text-danger tabular-nums mt-1 block">
            {fmt(pl.operatingExpenses)} {cur}
          </span>
          <span className="text-[10px] text-muted-foreground">إيجار، رواتب، كهرباء ونثريات</span>
        </div>

        <div className={cn(
          "p-5 rounded-2xl border flex flex-col justify-between",
          pl.netProfit >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-danger/30 bg-danger/10"
        )}>
          <span className="text-xs font-bold block text-foreground">صافي ربح الفرع (Net Profit)</span>
          <div className={cn("text-2xl sm:text-3xl font-black tabular-nums mt-1", pl.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-danger")}>
            {fmt(pl.netProfit)} {cur}
          </div>
          <span className="text-[11px] font-bold text-foreground/80">
            هامش الربح الصافي: {pl.netMarginPct}%
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm">المصروفات التشغيلية المسجلة لفرع "{activeBranch.name}"</h4>
          <span className="text-xs text-muted-foreground">
            المجموع: <strong className="text-danger">{fmt(pl.operatingExpenses)} {cur}</strong>
          </span>
        </div>

        <div className="divide-y divide-[var(--hairline)]">
          {branchExpensesList.map((exp) => (
            <div key={exp.id} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold">{exp.category}</span>
                <span className="text-muted-foreground block text-[11px]">{exp.notes || "بدون ملاحظات"}</span>
              </div>
              <div className="text-left font-black text-danger tabular-nums">
                {fmt(exp.amount)} {cur}
              </div>
            </div>
          ))}

          {branchExpensesList.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              لم يتم تسجيل مصروفات خاصة بهذا الفرع بعد.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
