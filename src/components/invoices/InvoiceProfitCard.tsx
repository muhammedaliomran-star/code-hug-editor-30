import { cn } from "@/lib/utils";
import { fmt } from "@/lib/store";

export interface InvoiceProfitCardProps {
  hideProfits: boolean;
  blurCls: string;
  totalCost: number;
  totalPrice: number;
  profit: number;
  profitPct: number;
}

export function InvoiceProfitCard({ hideProfits, blurCls, totalCost, totalPrice, profit, profitPct }: InvoiceProfitCardProps) {
  return (
              {!hideProfits && (
                <div className="rounded-[2rem] border border-border/30 p-5 space-y-4 animate-[fade-in_0.2s_ease-out]">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4 divide-y divide-border/30">
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        إجمالي التكلفة
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-xl font-bold tracking-tight", blurCls)}>
                          {fmt(totalCost)}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/40">ج.م</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        إجمالي سعر البيع
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold tracking-tight">{fmt(totalPrice)}</span>
                        <span className="text-[10px] font-bold text-muted-foreground/40">ج.م</span>
                      </div>
                    </div>
                    <div className="space-y-1 pt-4 border-t border-border/30">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        صافي الربح
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={cn(
                            "text-3xl font-black tracking-tighter",
                            blurCls,
                            profit > 0
                              ? "text-success"
                              : profit < 0
                                ? "text-danger"
                                : "text-muted-foreground",
                          )}
                        >
                          {fmt(profit)}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground/40">ج.م</span>
                      </div>
                    </div>
                    <div className="space-y-1 pt-4 border-t border-border/30">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        نسبة الربح
                      </span>
                      <span
                        className={cn(
                          "block text-3xl font-black tracking-tighter",
                          blurCls,
                          profit > 0
                            ? "text-success"
                            : profit < 0
                              ? "text-danger"
                              : "text-muted-foreground",
                        )}
                      >
                        {profitPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
  );
}
