import { cn } from "@/lib/utils";

export type FilterChip<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

/**
 * Unified filter chips row (replaces every hand-rolled chip bar).
 * Single-select. RTL-first, horizontally scrollable on mobile.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<FilterChip<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("no-scrollbar flex items-center gap-2 overflow-x-auto pb-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "press flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] transition-colors duration-300",
              active
                ? "bg-primary font-bold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]"
                : "bg-foreground/[0.04] font-medium text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:bg-foreground/[0.08] hover:text-foreground",
            )}
          >
            {opt.label}
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold leading-5",
                  active ? "bg-primary-foreground/20" : "bg-foreground/[0.07]",
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
