import { cn } from "@/lib/utils";

export interface InvoiceStepsBarProps {
  step: number;
  productCount: number;
  onStepChange: (n: number) => void;
}

export function InvoiceStepsBar({ step, productCount, onStepChange }: InvoiceStepsBarProps) {
  return (
          <div className="plate flex items-center gap-1.5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-1.5">
            {[
              { n: 1, label: "العميل والنوع" },
              { n: 2, label: `المنتجات والباركود (${productCount})` },
              { n: 3, label: "الشحن" },
              { n: 4, label: "الدفع والأقساط" },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => onStepChange(s.n)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  step === s.n
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-foreground/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black",
                    step === s.n ? "bg-foreground text-background" : "bg-foreground/10",
                  )}
                >
                  {s.n}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
  );
}
