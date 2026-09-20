import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/store";
import { printBranchShiftZReport, calculateBranchCashboxSummary } from "@/lib/branch-system";
import { Wallet, ArrowUpRight, ArrowDownRight, CircleDollarSign, FileText, Printer } from "lucide-react";

export default function CashboxTab() {
  const {
    activeBranch, invoices, payments, expenses, cur,
    remittances, shifts,
    setIsRemittanceOpen, setIsZReportOpen,
    shopSettings,
  } = useBranches();

  if (!activeBranch) return null;

  const cashSummary = calculateBranchCashboxSummary(activeBranch.id, invoices, payments, expenses);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-1">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-between">
            <span>النقدية المتوفرة بدرج الفرع</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
            {fmt(cashSummary.currentCashBalance)} <span className="text-xs font-normal">{cur}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            صافي المقبوضات بعد خصم المصروفات والتوريدات
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-card flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-bold flex items-center justify-between">
            <span>إجمالي المقبوضات النقدية (+)</span>
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </span>
          <div className="text-2xl font-black tabular-nums mt-1">
            {fmt(cashSummary.totalInflow)} <span className="text-xs font-normal">{cur}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            (مبيعات كاش: {fmt(cashSummary.cashSales)} + أقساط: {fmt(cashSummary.installmentsCash)})
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-card flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-bold flex items-center justify-between">
            <span>إجمالي المدفوعات والتوريدات (-)</span>
            <ArrowDownRight className="h-4 w-4 text-danger" />
          </span>
          <div className="text-2xl font-black text-danger tabular-nums mt-1">
            {fmt(cashSummary.totalOutflow)} <span className="text-xs font-normal">{cur}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            (مصروفات: {fmt(cashSummary.pettyExpenses)} + توريدات: {fmt(cashSummary.remittancesOut)})
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <h4 className="font-bold text-sm">عمليات الخزينة وإغلاق الوردية لـ "{activeBranch.name}"</h4>
          <p className="text-xs text-muted-foreground">تسجيل توريدات النقدية للبنك/الخزينة العامة وطباعة تقرير Z-Report</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsRemittanceOpen(true)}
            variant="outline"
            className="rounded-full h-9 px-4 text-xs font-bold"
          >
            <CircleDollarSign className="ml-1.5 h-3.5 w-3.5 text-primary" />
            توريد نقدية للخزينة / البنك
          </Button>
          <Button
            onClick={() => setIsZReportOpen(true)}
            className="rounded-full h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700"
          >
            <FileText className="ml-1.5 h-3.5 w-3.5" />
            تقفيل وردية (Z-Report)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-3">
          <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>سجل توريدات النقدية</span>
            <Badge variant="secondary" className="text-[10px]">
              {remittances.filter((r) => r.branchId === activeBranch.id).length} عملية
            </Badge>
          </h5>

          <div className="divide-y divide-[var(--hairline)] max-h-72 overflow-y-auto no-scrollbar">
            {remittances
              .filter((r) => r.branchId === activeBranch.id)
              .map((rem) => (
                <div key={rem.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold">{rem.destinationName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {rem.remittanceDate} • الرقم المرجعي: {rem.referenceNumber || "—"}
                    </div>
                  </div>
                  <div className="text-left font-black text-sm text-primary tabular-nums">
                    {fmt(rem.amount)} {cur}
                  </div>
                </div>
              ))}

            {remittances.filter((r) => r.branchId === activeBranch.id).length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لا توجد توريدات نقدية مسجلة لهذا الفرع
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-3">
          <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>سجل تقارير الورديات (Z-Reports)</span>
            <Badge variant="secondary" className="text-[10px]">
              {shifts.filter((s) => s.branchId === activeBranch.id).length} إغلاق
            </Badge>
          </h5>

          <div className="divide-y divide-[var(--hairline)] max-h-72 overflow-y-auto no-scrollbar">
            {shifts
              .filter((s) => s.branchId === activeBranch.id)
              .map((sh) => (
                <div key={sh.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{sh.shiftNumber}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold",
                          sh.variance === 0 ? "text-emerald-600" : "text-danger"
                        )}
                      >
                        {sh.variance === 0 ? "متطابق" : `فارق ${fmt(sh.variance)}`}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      الكاشير: {sh.cashierName} • {new Date(sh.closedAt || sh.openedAt).toLocaleDateString("ar-EG")}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm tabular-nums">
                      {fmt(sh.actualCash)} {cur}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => printBranchShiftZReport(sh, activeBranch, shopSettings, "thermal")}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

            {shifts.filter((s) => s.branchId === activeBranch.id).length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لا توجد ورديات مغلقة مسجلة بعد
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
