import { motion } from "framer-motion";
import { Layers, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProductRow, StockItem } from "@/types";
import { calculateLineFinancials } from "@/lib/financial-engine";
import { StockProductPicker } from "@/components/invoices";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/shop-settings";

export interface InvoiceProductRowProps {
  product: ProductRow;
  index: number;
  stockItems: StockItem[];
  canRemove: boolean;
  hideProfits: boolean;
  costBlurClass: string;
  onUpdate: (id: string, patch: Partial<ProductRow>) => void;
  onRemove: (id: string) => void;
}

export function InvoiceProductRow({
  product,
  index,
  stockItems,
  canRemove,
  hideProfits,
  costBlurClass,
  onUpdate,
  onRemove,
}: InvoiceProductRowProps) {
  const stock = product.stockId ? stockItems.find((x) => x.id === product.stockId) : undefined;
  const qty = Number(product.quantity || 0);
  const metrics = calculateLineFinancials({
    price: Number(product.price || 0),
    quantity: Number(product.quantity || 1),
    discountPct: Number(product.discount || 0),
    taxPct: Number(product.taxPct || 0),
  });
  const hasVariants = Boolean(stock?.variants?.length);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="divide-y divide-border/30 px-3 py-2.5 rounded-2xl bg-foreground/[0.015] border border-foreground/5"
    >
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_76px_96px_96px_32px]">
        <div className="min-w-0">
          {index === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">اسم المنتج</Label>}
          <StockProductPicker
            value={product.stockId}
            name={product.name}
            stockItems={stockItems}
            onPick={(item) =>
              onUpdate(product.id, {
                stockId: item.id,
                name: item.name,
                cost: String(item.lastUnitCost || 0),
                price: product.price || (item.salePrice ? String(item.salePrice) : ""),
              })
            }
            onClear={() => onUpdate(product.id, { stockId: undefined, name: "" })}
          />
        </div>

        <div>
          {index === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">الكمية</Label>}
          <Input
            type="number"
            min="1"
            value={product.quantity}
            onChange={(e) => onUpdate(product.id, { quantity: e.target.value })}
            className="h-9 bg-white/5 border-white/10 text-center font-bold"
          />
        </div>

        <div>
          {index === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">التكلفة</Label>}
          <Input
            type="number"
            value={product.cost}
            onChange={(e) => onUpdate(product.id, { cost: e.target.value })}
            className={cn(costBlurClass, "h-9 bg-white/5 border-white/10 text-center font-bold")}
            disabled={hideProfits}
          />
        </div>

        <div>
          {index === 0 && <Label className="mb-1 block text-[10px] text-muted-foreground">سعر البيع</Label>}
          <Input
            type="number"
            value={product.price}
            onChange={(e) => onUpdate(product.id, { price: e.target.value })}
            className="h-9 bg-white/5 border-white/10 text-center font-bold"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onRemove(product.id)}
            disabled={!canRemove}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hasVariants && stock && (
        <div className="mt-2 pt-2 flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-primary" /> المقاس / اللون:
          </span>
          <Select
            value={product.variantId || ""}
            onValueChange={(val) => {
              const matchedVar = stock.variants?.find((v) => v.id === val);
              if (matchedVar) {
                onUpdate(product.id, {
                  variantId: matchedVar.id,
                  name: `${stock.name} (${[matchedVar.size, matchedVar.color].filter(Boolean).join(" - ")})`,
                  price: String(matchedVar.salePrice || stock.salePrice || 0),
                  cost: String(matchedVar.costPrice || stock.lastUnitCost || 0),
                });
                toast.success(`تم اختيار تنوع: ${matchedVar.size || ""} ${matchedVar.color || ""}`);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs max-w-[220px]">
              <SelectValue placeholder="اختر المقاس / اللون..." />
            </SelectTrigger>
            <SelectContent>
              {stock.variants?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {[v.size, v.color].filter(Boolean).join(" / ")} — {v.salePrice} ج.م (متوفر: {v.quantity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 border-t border-border/30 pt-3 sm:grid-cols-[110px_110px_minmax(0,1fr)]">
        <div>
          <Label className="mb-1 block text-[10px] text-muted-foreground">خصم البند %</Label>
          <Input type="number" min="0" max="100" value={product.discount || ""} onChange={(e) => onUpdate(product.id, { discount: e.target.value })} className="h-9 text-center" placeholder="0" />
        </div>
        <div>
          <Label className="mb-1 block text-[10px] text-muted-foreground">ضريبة البند %</Label>
          <Input type="number" min="0" value={product.taxPct || ""} onChange={(e) => onUpdate(product.id, { taxPct: e.target.value })} className="h-9 text-center" placeholder="0" />
        </div>
        <div>
          <Label className="mb-1 block text-[10px] text-muted-foreground">السيريال / IMEI (افصل بفاصلة)</Label>
          <Input value={product.serialNumbers || ""} onChange={(e) => onUpdate(product.id, { serialNumbers: e.target.value })} className="h-9 font-mono text-xs" dir="ltr" placeholder="3569… , 3569…" />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-muted-foreground">
          الصافي: {fmt(metrics.lineTotal)} ج.م
          {(metrics.discountAmount > 0 || metrics.taxAmount > 0) && (
            <span className="mr-2 font-normal">(خصم {fmt(metrics.discountAmount)} • ضريبة {fmt(metrics.taxAmount)})</span>
          )}
        </span>
        {stock && (
          <span className={cn("flex items-center gap-1", stock.quantity >= qty && qty > 0 ? "text-success" : "text-danger")}>
            <Package className="h-3 w-3" /> المتوفر: {stock.quantity}
          </span>
        )}
      </div>
    </motion.div>
  );
}
