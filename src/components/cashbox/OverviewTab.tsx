import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { deleteTreasuryAccount } from "@/lib/cashbox-system";
import {
  Plus,
  Building2,
  CreditCard,
  Smartphone,
  Coins,
  Trash2,
  Banknote,
  Sparkles,
} from "lucide-react";

export function OverviewTab() {
  const {
    cur,
    accounts,
    accountBalances,
    periodStats,
    selectedAccountId,
    setSelectedAccountId,
    setActiveTab,
    setIsAccountManageOpen,
    setIsTransferOpen,
    setTransferFrom,
    refreshAll,
  } = useCashbox();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">الخزائن، المحافظ والحسابات البنكية المعتمدة</h3>
          <p className="text-xs text-muted-foreground">
            تتبع دقيق لأرصدة ومقبوضات ومدفوعات كل قناة مالية بشكل منفصل
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAccountManageOpen(true)}
          className="rounded-full px-4 text-xs font-semibold gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة خزينة / محفظة جديدة
        </Button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => {
          const bal = accountBalances[acc.id] || { initial: 0, inflows: 0, outflows: 0, currentBalance: 0 };
          const isNegative = bal.currentBalance < 0;

          const typeIcon = {
            cash: <Banknote className="h-5 w-5 text-emerald-500" />,
            ewallet: <Smartphone className="h-5 w-5 text-indigo-500" />,
            bank: <Building2 className="h-5 w-5 text-blue-500" />,
            pos: <CreditCard className="h-5 w-5 text-purple-500" />,
            petty: <Coins className="h-5 w-5 text-amber-500" />,
          }[acc.type];

          const typeLabel = {
            cash: "خزينة نقدية (كاش)",
            ewallet: "محفظة إلكترونية",
            bank: "حساب بنكي",
            pos: "ماكينة POS",
            petty: "عهدة فرعية",
          }[acc.type];

          return (
            <div
              key={acc.id}
              className={cn(
                "rounded-2xl border p-5 bg-card/80 transition-all shadow-sm hover:shadow-md flex flex-col justify-between gap-4",
                selectedAccountId === acc.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-foreground/10"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                      {typeIcon}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm leading-tight">{acc.name}</h4>
                      <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                        {typeLabel}
                      </span>
                    </div>
                  </div>

                  {acc.isDefault && (
                    <Badge variant="secondary" className="text-[9px] font-bold bg-primary/10 text-primary">
                      الافتراضي
                    </Badge>
                  )}
                </div>

                {/* Balance */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-foreground/5 mb-3">
                  <span className="text-[10px] text-muted-foreground font-semibold block">الرصيد الفعلي الحالي</span>
                  <div className={cn("text-xl font-black tabular-nums mt-0.5", isNegative ? "text-danger" : "text-foreground")}>
                    {fmt(bal.currentBalance)} <span className="text-xs font-normal text-muted-foreground">{cur}</span>
                  </div>
                </div>

                {/* Inflows & Outflows stats */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="text-[10px] text-muted-foreground block font-normal">إجمالي الوارد</span>
                    +{fmt(bal.inflows)} {cur}
                  </div>
                  <div className="text-rose-600 dark:text-rose-400 font-semibold">
                    <span className="text-[10px] text-muted-foreground block font-normal">إجمالي المنصرف</span>
                    -{fmt(bal.outflows)} {cur}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--hairline)]">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 rounded-xl text-[11px] h-7 font-bold"
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setActiveTab("ledger");
                  }}
                >
                  كشف الحساب
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-[11px] h-7 px-2.5"
                  onClick={() => {
                    setTransferFrom(acc.id);
                    setIsTransferOpen(true);
                  }}
                >
                  تحويل
                </Button>

                {!acc.isDefault && accounts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-xl text-danger hover:bg-danger/10"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف الحساب "${acc.name}"؟`)) {
                        deleteTreasuryAccount(acc.id);
                        refreshAll();
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Period Summary Bar */}
      <div className="p-5 rounded-2xl border border-foreground/10 bg-card/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">صافي حركة السيولة للشهر الحالي</h4>
            <p className="text-xs text-muted-foreground">
              مقارنة مباشرة بين التدفقات النقدية الواردة والمدفوعات والمصروفات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px]">المقبوضات الواردة</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
              +{fmt(periodStats.inflow)} {cur}
            </span>
          </div>
          <div className="h-7 w-[1px] bg-foreground/10" />
          <div>
            <span className="text-muted-foreground block text-[10px]">المدفوعات والمنصرفات</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
              -{fmt(periodStats.outflow)} {cur}
            </span>
          </div>
          <div className="h-7 w-[1px] bg-foreground/10" />
          <div>
            <span className="text-muted-foreground block text-[10px]">صافي التدفق المالي</span>
            <span
              className={cn(
                "font-black text-sm tabular-nums",
                periodStats.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-danger"
              )}
            >
              {periodStats.net >= 0 ? "+" : ""}{fmt(periodStats.net)} {cur}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
