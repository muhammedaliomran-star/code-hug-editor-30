import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { SectionHead } from "./shared";
import { useDashboard } from "./context";

export function InsightsSection() {
  const { insights } = useDashboard();

  return (
    <Reveal className="mb-14 block">
      <section>
        <SectionHead
          title="توصيات وتنبيهات الإدارة الذكية"
          icon={<Sparkles className="h-5 w-5 text-muted-foreground" />}
          aside={<span className="text-[11px] text-muted-foreground">تحديث لحظي</span>}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.map((ins, i) => {
            const rail =
              ins.tone === "success"
                ? "bg-success"
                : ins.tone === "warning"
                  ? "bg-warning"
                  : ins.tone === "danger"
                    ? "bg-danger"
                    : "bg-primary";
            const spans = insights.length % 2 === 1 && i === insights.length - 1;
            return (
              <div
                key={i}
                className={cn(
                  "group/insight relative overflow-hidden rounded-[1.5rem] bg-foreground/[0.02] p-5 pe-6 text-right text-sm font-medium leading-relaxed border border-border/50 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition-[transform,background-color,border-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-foreground/[0.04] hover:border-border",
                  spans && "sm:col-span-2",
                )}
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <span
                  className={cn(
                    "absolute inset-y-4 end-0 w-[3px] rounded-full opacity-70 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/insight:inset-y-3 group-hover/insight:opacity-100",
                    rail,
                  )}
                />
                {ins.text}
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}
