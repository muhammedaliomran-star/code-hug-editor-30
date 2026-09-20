import { Link } from "@/lib/router-compat";
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./context";

export function QuickActionsSection() {
  const { treasuryLiquidityResult, treasuryLiquidity, money } = useDashboard();

  return (
    <section className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/invoices/new"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-primary/50 transition-all group hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
            </span>
            <div className="text-right">
              <div className="text-xs font-bold text-foreground">فاتورة جديدة</div>
              <div className="text-[10px] text-muted-foreground">بيع / قسط / كاش</div>
            </div>
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </Link>

        <Link
          to="/payments?create=receipt"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-emerald-500/50 transition-all group hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
              <ArrowDownLeft className="h-4 w-4" />
            </span>
            <div className="text-right">
              <div className="text-xs font-bold text-foreground">سند تحصيل</div>
              <div className="text-[10px] text-muted-foreground">توريد للخزينة</div>
            </div>
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600 transition-colors" />
        </Link>

        <Link
          to="/expenses?create=expense"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-rose-500/50 transition-all group hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 group-hover:scale-105 transition-transform">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <div className="text-right">
              <div className="text-xs font-bold text-foreground">إذن صرف مصروف</div>
              <div className="text-[10px] text-muted-foreground">تشغيلي / إيجار / نثريات</div>
            </div>
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-rose-600 transition-colors" />
        </Link>

        <Link
          to="/cashbox"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/70 hover:border-amber-500/50 transition-all group hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform">
              <Wallet className="h-4 w-4" />
            </span>
            <div className="text-right">
              <div className="text-xs font-bold text-foreground">فحص رصيد الخزينة</div>
              <div className={cn("text-[10px]", treasuryLiquidityResult.error ? "text-danger" : "text-muted-foreground")}>
                {treasuryLiquidityResult.error ?? money(treasuryLiquidity ?? 0)}
              </div>
            </div>
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-amber-600 transition-colors" />
        </Link>
      </div>
    </section>
  );
}
