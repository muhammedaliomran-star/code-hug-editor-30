import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export function StatCard({ icon, label, value, tone, trend, valueClassName }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "danger" | "neutral"; trend?: "up" | "down"; valueClassName?: string }) {
  const toneCls = tone === "primary" ? "bg-primary/10 text-primary border-primary/30" : tone === "success" ? "bg-success/10 text-success border-success/30" : tone === "danger" ? "bg-danger/10 text-danger border-danger/30" : "bg-foreground/[0.06] text-foreground border-border";
  const valueCls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className={cn("rounded-[1.25rem] bg-card/70 p-4 flex items-center gap-3 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] animate-[fade-in_0.4s_ease-out]", tone === "success" ? "border-success/30 hover:border-success/60" : tone === "danger" ? "border-danger/30 hover:border-danger/60" : "border-border hover:border-primary/40")}>
      <div className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0", toneCls)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {label}
          {trend === "up" && <TrendingUp className="w-3 h-3 text-success" />}
          {trend === "down" && <TrendingUp className="w-3 h-3 text-danger rotate-180" />}
        </div>
        <div className={cn("text-lg font-extrabold tabular-nums truncate", valueCls, valueClassName)}>{value}</div>
      </div>
    </div>
  );
}
