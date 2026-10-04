import { fmt } from "@/lib/store";
import { MetricCard } from "@/components/MetricCard";
import { Reveal } from "@/components/Reveal";
import { AlertCircle, Calendar, Handshake, ShieldAlert } from "lucide-react";

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
}: AlertsKpiStripProps) {
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
      <Reveal delay={0} className="h-full">
        <MetricCard
          className="h-full"
          icon={AlertCircle}
          label="إجمالي ديون السوق المتأخرة"
          value={totalOverdueAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="danger"
          masked={masked}
          sub={`${overdueCount} فاتورة / قسط متأخر`}
        />
      </Reveal>
      <Reveal delay={70} className="h-full">
        <MetricCard
          className="h-full"
          icon={Calendar}
          label="مستحق اليوم وقريباً"
          value={dueSoonAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="positive"
          masked={masked}
          sub={`${dueSoonCount} عميل مطلوب تحصيله`}
        />
      </Reveal>
      <Reveal delay={140} className="h-full">
        <MetricCard
          className="h-full"
          icon={Handshake}
          label="وعود سداد مجدولة"
          value={promisesAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="neutral"
          masked={masked}
          sub={`${promisesCount} عميل موعود بسداده`}
        />
      </Reveal>
      <Reveal delay={210} className="h-full">
        <MetricCard
          className="h-full"
          icon={ShieldAlert}
          label="ديون حرجة ومتعثرة (>30 يوم)"
          value={criticalAmount}
          format={(n) => `${fmt(n)} ج.م`}
          tone="danger"
          masked={masked}
          sub={`${criticalCount} حالة تحتاج إجراء قانوني`}
        />
      </Reveal>
    </div>
  );
}
