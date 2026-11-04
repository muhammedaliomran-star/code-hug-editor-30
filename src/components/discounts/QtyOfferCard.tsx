import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuantityTierOffer } from "@/lib/discounts";
import { cn } from "@/lib/utils";

export interface QtyOfferCardProps {
  offer: QuantityTierOffer;
  onEdit: (offer: QuantityTierOffer) => void;
  onDelete: (id: string) => void;
}

export function QtyOfferCard({ offer, onEdit, onDelete }: QtyOfferCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col justify-between transition-all bg-background/50",
        offer.active ? "border-border/60 hover:border-primary/40" : "opacity-60 bg-muted/20",
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
            {offer.minQuantity} قطع فأكثر
          </span>
          <span className="text-base font-black text-foreground font-mono">
            خصم {offer.discountPercentage}%
          </span>
        </div>
        <h2 className="font-bold text-sm">{offer.title}</h2>
        {offer.notes && <p className="text-xs text-muted-foreground mt-1">{offer.notes}</p>}
      </div>

      <div className="flex items-center justify-between mt-4 pt-2 border-t border-border/20 text-xs">
        <span className={offer.active ? "text-success font-medium" : "text-muted-foreground"}>
          {offer.active ? "مفعّل تلقائياً" : "معطّل"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(offer)}
            className="h-7 w-7 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(offer.id)}
            className="h-7 w-7 text-muted-foreground hover:text-danger"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
