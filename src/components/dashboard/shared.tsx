import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const EMERALD = "oklch(0.68 0.11 162)";
export const DANGER = "oklch(0.65 0.18 28)";
export const WARNING = "oklch(0.75 0.16 70)";
export const MUTED = "oklch(0.55 0.01 270)";
export const PRIMARY = "oklch(0.62 0.18 250)";

export const TOOLTIP_STYLE = {
  background: "oklch(0.21 0.006 270)",
  border: "1px solid oklch(0.3 0.008 270)",
  borderRadius: "0.85rem",
  direction: "rtl" as const,
  boxShadow: "0 18px 45px -22px rgba(0,0,0,0.8)",
};

export type TimeRange = "today" | "7d" | "30d" | "month" | "all";
export type TopProductsSort = "quantity" | "revenue";

export function SectionHead({
  title,
  icon,
  aside,
}: {
  title: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0 order-2 text-right">
        <h2 className="text-display flex items-center justify-end gap-2 text-xl font-extrabold sm:text-2xl">
          <span className="truncate">{title}</span>
          {icon && <span className="shrink-0">{icon}</span>}
        </h2>
      </div>
      <div className="order-1 shrink-0">{aside}</div>
    </div>
  );
}

export function QuickLink({
  to,
  icon,
  title,
  sub,
  tone = "neutral",
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <Link
      to={to as never}
      className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-transparent p-3.5 transition-[background-color,transform] duration-500 hover:bg-foreground/[0.04] hover:border-border/40 active:scale-[0.99]"
      style={{ transitionTimingFunction: "var(--ease-fluid)" }}
    >
      <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-500 group-hover:-translate-x-1" />
      <div className="flex min-w-0 items-center justify-end gap-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-sm font-bold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1",
            tone === "danger"
              ? "bg-danger/10 text-danger ring-danger/25"
              : "bg-foreground/[0.06] text-muted-foreground ring-foreground/10",
          )}
        >
          {icon}
        </span>
      </div>
    </Link>
  );
}
