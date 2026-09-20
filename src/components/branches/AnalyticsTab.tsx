import { useBranches } from "./context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt, calculateBranchProfitability, calculateBranchStockValuation } from "@/lib/store";
import { Award } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export default function AnalyticsTab() {
  const { branches, invoices, expenses, stockItems, cur } = useBranches();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-foreground/10 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              لوحة متصدري الفروع (Branches Leaderboard)
            </h3>
            <p className="text-xs text-muted-foreground">ترتيب الفروع حسب الإيرادات، صافي الأرباح ومعدل السلة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {branches
            .map((b) => calculateBranchProfitability(b, invoices, expenses))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .map((item, idx) => (
              <div
                key={item.branchId}
                className={cn(
                  "relative rounded-2xl border p-4 flex flex-col justify-between gap-3",
                  idx === 0
                    ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                    : "border-foreground/10 bg-card/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-black",
                        idx === 0
                          ? "bg-amber-500 text-black"
                          : idx === 1
                          ? "bg-slate-300 text-black"
                          : "bg-amber-700/40 text-amber-200"
                      )}
                    >
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-sm">{item.branchName}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    هامش {item.netMarginPct}%
                  </Badge>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبيعات:</span>
                    <strong className="text-primary tabular-nums">{fmt(item.totalRevenue)} {cur}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">صافي الربح:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(item.netProfit)} {cur}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متوسط الفاتورة:</span>
                    <strong className="tabular-nums">{fmt(item.averageTicketSize)} {cur}</strong>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-4">
          <h4 className="font-bold text-sm">مقارنة الإيرادات بين الفروع</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={branches.map((b) => {
                  const pl = calculateBranchProfitability(b, invoices, expenses);
                  return { name: b.name, revenue: pl.totalRevenue, profit: pl.netProfit };
                })}
              >
                <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="الإيرادات" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" name="صافي الربح" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-card p-5 space-y-4">
          <h4 className="font-bold text-sm">توزيع قيمة المخزون عبر الفروع</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={branches.map((b) => {
                    const val = calculateBranchStockValuation(b.id, stockItems);
                    return { name: b.name, value: val.totalCostValue || 100 };
                  })}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {branches.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={["#0ea5e9", "#10b981", "#f59e0b", "#6366f1"][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
