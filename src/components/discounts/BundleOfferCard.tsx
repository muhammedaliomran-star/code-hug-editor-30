import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BundleComboOffer } from "@/lib/discounts";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface BundleOfferCardProps {
  bundle: BundleComboOffer;
  onEdit: (bundle: BundleComboOffer) => void;
  onDelete: (id: string) => void;
}

export function BundleOfferCard({ bundle, onEdit, onDelete }: BundleOfferCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col justify-between transition-all bg-background/50",
        bundle.active ? "border-border/60 hover:border-primary/40" : "opacity-60 bg-muted/20",
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground">خصم الباقة:</span>
          <span className="text-base font-black text-warning font-mono">
            − {fmt(bundle.discountAmount)} ج.م
          </span>
        </div>
        <h2 className="font-bold text-sm">{bundle.title}</h2>
        <div className="flex flex-wrap gap-1 mt-2">
          {bundle.itemKeywords.map((kw, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md bg-muted/70 text-[11px] font-bold text-foreground border border-border/30"
            >
              + {kw}
            </span>
          ))}
        </div>
        {bundle.notes && <p className="text-xs text-muted-foreground mt-2">{bundle.notes}</p>}
      </div>

      <div className="flex items-center justify-between mt-4 pt-2 border-t border-border/20 text-xs">
        <span className={bundle.active ? "text-success font-medium" : "text-muted-foreground"}>
          {bundle.active ? "مفعّل تلقائياً" : "معطّل"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(bundle)}
            className="h-7 w-7 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(bundle.id)}
            className="h-7 w-7 text-muted-foreground hover:text-danger"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
