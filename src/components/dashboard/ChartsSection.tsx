import { Link } from "@/lib/router-compat";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { fmt } from "@/lib/store";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { ChartEmpty } from "@/components/ChartEmpty";
import { SectionHead } from "./shared";
import { EMERALD, MUTED, TOOLTIP_STYLE } from "./shared";
import { useDashboard } from "./context";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export function ChartsSection() {
  const {
    privacy,
    hasTrendData,
    trendData,
    data,
    hasStatusData,
    statusData,
  } = useDashboard();

  return (
    <section className="mb-14 grid gap-4 lg:grid-cols-3">
      <Reveal className="h-full lg:col-span-2" delay={0}>
        <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
          <SectionHead
            title="اتجاه التحصيلات"
            icon={<TrendingUp className="h-5 w-5 text-success" />}
            aside={<span className="text-[11px] text-muted-foreground">آخر 6 شهور + توقع</span>}
          />
          <div className="h-72 flex-1">
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={EMERALD} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.3 0.008 270)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke={MUTED}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={MUTED}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) =>
                      privacy
                        ? "•••"
                        : new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)
                    }
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ stroke: MUTED, strokeDasharray: "3 4" }}
                    formatter={(value: number, name: string) => [
                      privacy ? "•••••" : `${fmt(value)} ج.م`,
                      name === "forecast" ? "متوقع" : "التحصيلات",
                    ]}
                    labelStyle={{ color: "oklch(0.97 0.005 270)" }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="line"
                    formatter={(v) => (
                      <span className="text-[11px] text-muted-foreground">
                        {v === "forecast" ? "متوقع" : "فعلي"}
                      </span>
                    )}
                  />
                  <Line
                    name="actual"
                    type="monotone"
                    dataKey="total"
                    stroke={EMERALD}
                    strokeWidth={3}
                    dot={{ fill: EMERALD, r: 3.5 }}
                    activeDot={{ r: 6 }}
                    fill="url(#gradLine)"
                    connectNulls={false}
                    isAnimationActive
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                  <Line
                    name="forecast"
                    type="monotone"
                    dataKey="forecast"
                    stroke={EMERALD}
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={{
                      fill: "oklch(0.21 0.006 270)",
                      stroke: EMERALD,
                      r: 3.5,
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={1500}
                    animationBegin={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty
                title="لا توجد تحصيلات مسجلة بعد"
                hint="عند تسجيل أول دفعة على فاتورة، سيظهر هنا اتجاه التحصيل والتوقع للشهر القادم."
                ctaLabel="افتح الفواتير"
                ctaTo="/invoices"
              />
            )}
          </div>
        </BezelCard>
      </Reveal>

      <Reveal className="h-full" delay={90}>
        <BezelCard variant="flat" className="h-full" innerClassName="flex h-full flex-col p-6 sm:p-8">
          <SectionHead
            title="حالة ديون العملاء"
            aside={
              <span className="text-[11px] text-muted-foreground">
                {data.customers.length} عميل
              </span>
            }
          />
          <div className="h-72 flex-1">
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="oklch(0.17 0.005 270)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(v) => (
                      <span className="text-[11px] text-muted-foreground">{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty
                variant="ring"
                title="لا يوجد عملاء مسجلين"
                hint="أضف أول عميل لتتمكن من متابعة توزيع الالتزام والتعثر."
                ctaLabel="إضافة عميل"
                ctaTo="/customers"
              />
            )}
          </div>
        </BezelCard>
      </Reveal>
    </section>
  );
}
