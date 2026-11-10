import type { ReactNode } from "react";
import { fmt } from "@/lib/store";
import { MetricCard } from "@/components/MetricCard";
import { Reveal } from "@/components/Reveal";
import { AlertCircle, Calendar, Handshake, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertsKpiStripProps {
  totalOverdueAmount: number;
  overdueCount: number;
  dueSoonAmount: number;
  dueSoonCount: number;
  promisesCount: number;
  promisesAmount: number;
  criticalCount: number;
  criticalAmount: number;
  masked?: boolean;
  onSelect?: (tab: "all" | "due_today" | "promises" | "critical") => void;
}

export function AlertsKpiStrip({
  totalOverdueAmount,
  overdueCount,
  dueSoonAmount,
  dueSoonCount,
  promisesCount,
  promisesAmount,
  criticalCount,
  criticalAmount,
  masked = false,
  onSelect,
}: AlertsKpiStripProps) {
  const card = (tab: "all" | "due_today" | "promises" | "critical", content: ReactNode) => (
    <button type="button" onClick={() => onSelect?.(tab)} className={cn("w-full text-right", onSelect && "cursor-pointer rounded-2xl text-inherit transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:scale-[0.99]")}>{content}</button>
  );
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
      <Reveal delay={0} className="h-full">
        {card("all", <MetricCard
          className="h-full"
          icon={AlertCircle}
          label="إجمالي المتأخرات"
          value={totalOverdueAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="danger"
          masked={masked}
          sub={`${overdueCount} فاتورة / قسط متأخر`}
        />)}
      </Reveal>
      <Reveal delay={70} className="h-full">
        {card("due_today", <MetricCard
          className="h-full"
          icon={Calendar}
          label="مستحق اليوم أو قريباً"
          value={dueSoonAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="warning"
          masked={masked}
          sub={`${dueSoonCount} عميل مطلوب تحصيله`}
        />)}
      </Reveal>
      <Reveal delay={140} className="h-full">
        {card("promises", <MetricCard
          className="h-full"
          icon={Handshake}
          label="وعود سداد مجدولة"
          value={promisesAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="info"
          masked={masked}
          sub={`${promisesCount} عميل موعود بسداده`}
        />)}
      </Reveal>
      <Reveal delay={210} className="h-full">
        {card("critical", <MetricCard
          className="h-full"
          icon={ShieldAlert}
          label="ديون حرجة ومتعثرة (>30 يوم)"
          value={criticalAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="danger"
          masked={masked}
          sub={`${criticalCount} حالة تحتاج إجراء قانوني`}
        />)}
      </Reveal>
    </div>
  );
}
