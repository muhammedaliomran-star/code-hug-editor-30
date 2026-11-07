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
  variant = "chips",
}: {
  options: Array<FilterChip<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: "chips" | "segmented";
}) {
  const segmented = variant === "segmented";
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar flex items-center overflow-x-auto pb-1",
        segmented
          ? "rounded-full bg-foreground/[0.05] p-1 ring-1 ring-inset ring-[var(--hairline)]"
          : "gap-2",
        className,
      )}
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
              "press shrink-0 items-center gap-1.5 transition-colors duration-300",
              segmented
                ? cn(
                    "flex h-8 rounded-full px-3.5 text-xs",
                    active
                      ? "bg-primary font-bold text-primary-foreground shadow-[0_2px_8px_-4px_hsl(0_0%_0%/0.4)]"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )
                : cn(
                    "flex min-h-[40px] rounded-full px-4 py-2 text-[13px]",
                    active
                      ? "bg-primary font-bold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]"
                      : "bg-foreground/[0.04] font-medium text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:bg-foreground/[0.08] hover:text-foreground",
                  ),
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
