import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTab<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
  active?: boolean;
  icon?: ReactNode;
  /** Alert dot overlay (e.g. overdue budgets, due recurring items). */
  dot?: "amber" | "danger";
};

/**
 * Unified status-tabs bar (replaces hand-rolled status strips such as the
 * invoices status bar or numbered cashbox tabs). Renders as one connected
 * segmented strip; the active segment is highlighted.
 */
export function StatTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<StatTab<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar flex items-stretch gap-1 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-card/60 p-1.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.active ?? opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "press relative flex min-h-[40px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] transition-colors duration-300",
              active
                ? "bg-primary font-bold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]"
                : "font-medium text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
            )}
          >
            {opt.dot && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-2 top-1.5 h-2 w-2 motion-safe:animate-pulse rounded-full",
                  opt.dot === "amber" ? "bg-amber-500" : "bg-danger",
                )}
              />
            )}
            <span className="flex items-center gap-1.5">
              {opt.icon}
              <span className="truncate">{opt.label}</span>
            </span>
            {typeof opt.count === "number" && (
              <span className={cn("text-xs font-bold tabular-nums", active ? "opacity-85" : "opacity-70")}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
