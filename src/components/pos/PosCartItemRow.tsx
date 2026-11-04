import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface PosCartItem {
  id: string;
  stockId?: string;
  name: string;
  cost: number;
  price: number;
  quantity: number;
  maxStock?: number;
  barcode?: string;
}

export interface PosCartItemRowProps {
  item: PosCartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onSetQty: (quantity: string) => void;
  onRemove: () => void;
}

export function PosCartItemRow({ item, onIncrease, onDecrease, onSetQty, onRemove }: PosCartItemRowProps) {
  const itemTotal = item.price * item.quantity;
  const isShortage = item.maxStock !== undefined && item.quantity > item.maxStock;

  return (
    <div
      className={cn(
        "p-2.5 rounded-xl border bg-background space-y-1.5 transition-colors",
        isShortage ? "border-danger/60 bg-danger/[0.02]" : "border-border/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-xs text-foreground truncate">{item.name}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {fmt(item.price)} ج.م للقطعة
          </div>
        </div>
        <div className="font-black text-xs font-mono text-primary shrink-0">
          {fmt(itemTotal)} ج.م
        </div>
      </div>

      {isShortage && (
        <div className="text-[11px] text-danger font-bold flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          الكمية المطلوبة تتجاوز المخزون ({item.maxStock} متاح)
        </div>
      )}

      {/* Quantity & Delete Controls */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDecrease}
            className="h-10 w-10 rounded-lg bg-foreground/[0.06] text-foreground hover:bg-foreground/10 grid place-items-center transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onSetQty(e.target.value)}
            className="h-10 w-14 text-center rounded-lg border border-border/50 text-xs font-black font-mono bg-background"
          />
          <button
            type="button"
            onClick={onIncrease}
            className="h-10 w-10 rounded-lg bg-foreground/[0.06] text-foreground hover:bg-foreground/10 grid place-items-center transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-danger h-10 w-10 grid place-items-center rounded-lg transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
