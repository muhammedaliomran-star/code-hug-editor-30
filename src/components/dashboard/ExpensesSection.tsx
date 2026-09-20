import { Link } from "@/lib/router-compat";
import { Receipt, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { ChartEmpty } from "@/components/ChartEmpty";
import { SectionHead } from "./shared";
import { MetricLabel } from "@/components/MetricCard";
import { useDashboard } from "./context";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { TOOLTIP_STYLE } from "./shared";

export function ExpensesSection() {
  const {
    expenseBreakdown,
    rangeLabel,
    totalRangeExpenses,
    privacy,
    money,
  } = useDashboard();

  return (
    <Reveal className="mb-14 block">
      <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
        <SectionHead
          title={`توزيع المصروفات (${rangeLabel})`}
          icon={<Receipt className="h-5 w-5 text-muted-foreground" />}
          aside={
            <Link
              to="/expenses"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-[11px] font-bold text-foreground ring-1 ring-border transition-[background-color,color,transform] hover:bg-foreground/[0.10] active:scale-[0.98]"
            >
              إدارة المصروفات <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {expenseBreakdown.length === 0 ? (
          <div className="h-56">
            <ChartEmpty
              variant="ring"
              title={`لا توجد مصروفات مسجلة خلال ${rangeLabel}`}
              hint="سجّل الإيجار والكهرباء والمرتبات لحساب الأرباح بدقة."
              ctaLabel="تسجيل مصروف"
              ctaTo="/expenses"
            />
          </div>
        ) : (
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="oklch(0.17 0.005 270)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {expenseBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [money(value), "المصروف"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3.5">
              {expenseBreakdown
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((row) => {
                  const pct = totalRangeExpenses > 0 ? (row.value / totalRangeExpenses) * 100 : 0;
                  return (
                    <div key={row.name}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className={cn("text-numeric font-bold", privacy && "privacy-blur")}>
                          {money(row.value)}
                          <span className="ms-1.5 text-muted-foreground">{Math.round(pct)}%</span>
                        </span>
                        <span className="flex items-center gap-2 font-medium">
                          {row.name}
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: row.color }}
                          />
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                        <div
                          className="h-full rounded-full transition-[width] duration-1000"
                          style={{
                            width: `${pct}%`,
                            background: row.color,
                            transitionTimingFunction: "var(--ease-fluid)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              <div className="flex items-center justify-between border-t border-border/60 pt-3.5">
                <span
                  className={cn(
                    "text-numeric text-base font-extrabold text-danger",
                    privacy && "privacy-blur",
                  )}
                >
                  {money(totalRangeExpenses)}
                </span>
                <MetricLabel>إجمالي المصروفات ({rangeLabel})</MetricLabel>
              </div>
            </div>
          </div>
        )}
      </BezelCard>
    </Reveal>
  );
}