import type { StockItem } from "@/types";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface PosProductTileProps {
  product: StockItem;
  /** كمية المنتج داخل السلة الحالية (إن وُجد) */
  inCartQuantity?: number;
  privacy: boolean;
  onAdd: (product: StockItem) => void;
}

export function PosProductTile({ product: p, inCartQuantity, privacy, onAdd }: PosProductTileProps) {
  const isOutOfStock = p.quantity <= 0;
  const isLowStock = !isOutOfStock && p.quantity <= (p.minStock || 3);

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={() => onAdd(p)}
      className={cn(
        "relative flex flex-col justify-between text-right p-3 rounded-2xl border transition-[border-color,box-shadow,background-color,transform] duration-150 group",
        isOutOfStock
          ? "bg-muted/30 border-border/30 opacity-50 cursor-not-allowed"
          : inCartQuantity !== undefined
            ? "bg-primary/[0.04] border-primary/40 ring-2 ring-primary/20 shadow-sm"
            : "bg-card border-border/50 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      {/* In-Cart Badge */}
      {inCartQuantity !== undefined && (
        <span className="absolute top-2 left-2 grid h-6 min-w-[24px] place-items-center rounded-full bg-primary text-primary-foreground font-black text-xs px-1 shadow">
          {inCartQuantity}
        </span>
      )}

      {/* Top Info: Name & Barcode */}
      <div>
        <div className="font-bold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {p.name}
        </div>
        {p.size && (
          <span className="inline-block mt-0.5 text-[11px] font-semibold text-muted-foreground bg-foreground/5 px-1.5 py-0.2 rounded">
            مقاس: {p.size}
          </span>
        )}
      </div>

      {/* Bottom Info: Price & Stock Status */}
      <div className="mt-3 pt-2 border-t border-border/30 flex items-end justify-between gap-1">
        <div>
          <div className="font-black text-sm sm:text-base font-mono text-primary">
            {fmt(p.salePrice || 0)}{" "}
            <span className="text-[11px] font-normal text-muted-foreground">ج.م</span>
          </div>
          {!privacy && p.lastUnitCost > 0 && (
            <div className="text-[11px] text-muted-foreground font-mono">
              ت: {fmt(p.lastUnitCost)} ج.م
            </div>
          )}
        </div>

        {/* Live Stock Indicators */}
        <div className="text-left shrink-0">
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded-md">
              نفد
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-warning bg-warning/15 px-1.5 py-0.5 rounded-md">
              باقي {p.quantity}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground font-medium">
              المخزن: <b className="text-foreground">{p.quantity}</b>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
