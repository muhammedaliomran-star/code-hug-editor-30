import { Link } from "@/lib/router-compat";
import { Flame, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { SectionHead } from "./shared";
import type { TopProductsSort } from "./shared";
import { useDashboard } from "./context";

export function TopProductsSection() {
  const { topProducts, topProductsSort, setTopProductsSort, privacy, money } = useDashboard();

  if (topProducts.length === 0) return null;

  return (
    <Reveal className="mb-14 block" delay={380}>
      <BezelCard variant="flat" innerClassName="p-6 sm:p-8">
        <SectionHead
          title="الأصناف الأكثر مبيعاً وتحقيقاً للإيراد"
          icon={<Flame className="h-5 w-5 text-amber-500" />}
          aside={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-foreground/[0.05] p-1 text-[11px] ring-1 ring-border">
                {(["quantity", "revenue"] as TopProductsSort[]).map((sort) => (
                  <button
                    key={sort}
                    type="button"
                    onClick={() => setTopProductsSort(sort)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-bold transition",
                      topProductsSort === sort ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {sort === "quantity" ? "الكمية" : "الإيراد"}
                  </button>
                ))}
              </div>
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-[11px] font-bold text-foreground ring-1 ring-border transition hover:bg-foreground/[0.10]"
              >
                إدارة المخزون <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {topProducts.map((p, idx) => (
            <div
              key={p.name + idx}
              className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-primary">#{idx + 1}</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                  {p.quantity} قطع مباعة
                </span>
              </div>
              <div className="font-bold text-sm truncate" title={p.name}>
                {p.name}
              </div>
              <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">الإيراد:</span>
                <span className={cn("font-bold text-foreground", privacy && "privacy-blur")}>
                  {money(p.revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </BezelCard>
    </Reveal>
  );
}
