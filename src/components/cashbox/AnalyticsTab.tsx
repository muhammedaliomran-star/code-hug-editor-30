import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export function AnalyticsTab() {
  const {
    cur,
    trendMode,
    setTrendMode,
    cashFlowTrendData,
    expenseChartData,
    inflowChartData,
  } = useCashbox();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day In/Out Trend Chart */}
        <div className="rounded-2xl border border-foreground/10 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-bold text-sm">
                حركة التدفق النقدي{" "}
                {trendMode === "daily" ? "(آخر 7 أيام)" : trendMode === "weekly" ? "(آخر 8 أسابيع)" : "(آخر 6 شهور)"}
              </h4>
              <p className="text-xs text-muted-foreground">مقارنة المقبوضات بالمدفوعات حسب الفترة</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-muted/30 p-1">
              {([
                { key: "daily", label: "يومي" },
                { key: "weekly", label: "أسبوعي" },
                { key: "monthly", label: "شهري" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTrendMode(opt.key)}
                  className={cn(
                    "px-3 h-7 rounded-lg text-[11px] font-bold transition-colors",
                    trendMode === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-foreground/5"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${fmt(Number(value))} ${cur}`,
                    name === "in" ? "وارد" : "منصرف",
                  ]}
                />
                <Bar dataKey="in" name="وارد" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="منصرف" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Categories Breakdown */}
        <div className="rounded-2xl border border-foreground/10 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm">توزيع المصروفات والمدفوعات</h4>
              <p className="text-xs text-muted-foreground">نسب استهلاك السيولة حسب البنود</p>
            </div>
          </div>

          {expenseChartData.length > 0 ? (
            <div className="h-64 w-full flex items-center" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${fmt(Number(value))} ${cur}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              لا توجد بيانات مصروفات كافية لعرض الرسم البياني
            </div>
          )}
        </div>

        {/* Inflows Breakdown */}
        <div className="col-span-full rounded-2xl border border-foreground/10 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm">مصادر الإيرادات والسيولة الداخلة</h4>
              <p className="text-xs text-muted-foreground">توزيع مصادر المقبوضات بالصندوق</p>
            </div>
          </div>

          {inflowChartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inflowChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={85}
                      paddingAngle={2}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {inflowChartData.map((entry, index) => (
                        <Cell key={`inflow-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${fmt(Number(value))} ${cur}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {inflowChartData.map((item) => (
                  <div key={item.name} className="p-4 rounded-xl border border-foreground/5 bg-muted/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-semibold text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="text-lg font-black tabular-nums">
                      {fmt(item.value)} <span className="text-xs font-normal">{cur}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
              لا توجد مقبوضات مسجلة بعد لعرض توزيع مصادر السيولة
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
