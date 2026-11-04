import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, PackagePlus } from "lucide-react";
import {
  db,
  fmt,
  WAREHOUSE_SEASONS,
  WAREHOUSE_CATEGORIES,
  type WarehouseSeason,
  type StockItem,
} from "@/lib/store";
import { posNum, NUM_CLS } from "@/components/ProductForm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** نقل جزء من كمية منتج إلى المخزن (warehouse_items) مع خصمها من المنتجات. */
export function MoveToWarehouseDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [qty, setQty] = useState("1");
  const [season, setSeason] = useState<WarehouseSeason>("all");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setQty(String(Math.max(1, item.quantity)));
      setSeason("all");
      setCategory("other");
      setNotes("");
    }
  }, [item]);

  const nQty = Math.max(0, Number(qty) || 0);
  const over = !!item && nQty > item.quantity;

  const submit = async () => {
    if (!item) return;
    if (nQty <= 0) {
      toast.error("اكتب كمية أكبر من صفر");
      return;
    }
    if (over) {
      toast.error("الكمية أكبر من المتاح في المنتجات");
      return;
    }
    setBusy(true);
    try {
      await db.addWarehouseItem({
        name: item.name,
        quantity: nQty,
        unitCost: item.lastUnitCost,
        salePrice: item.salePrice,
        season,
        category,
        notes: notes.trim() || null,
      });
      const remaining = item.quantity - nQty;
      if (remaining <= 0) {
        // نقل كل الكمية → المنتج يختفي من قسم المنتجات
        await db.removeStockItem(item.id);
        toast.success("تم نقل المنتج للمخزن وحذفه من المنتجات");
      } else {
        await db.updateStockItem(
          item.id,
          { quantity: remaining },
          { delta: -nQty, reason: "نقل للمخزن", notes: notes.trim() || undefined },
        );
        toast.success(`تم نقل ${fmt(nQty)} وحدة للمخزن`);
      }

      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر النقل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">نقل للمخزن</DialogTitle>
          <DialogDescription className="text-right">
            {item?.name} — المتاح: {fmt(item?.quantity ?? 0)} وحدة. الكمية المنقولة تُخصم من
            المنتجات.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>الكمية المنقولة</Label>
            <Input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(posNum(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              className={cn("rounded-2xl", NUM_CLS)}
            />
            {over && (
              <div className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> الكمية أكبر من المتاح.
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>الموسم</Label>
              <Select value={season} onValueChange={(v) => setSeason(v as WarehouseSeason)}>
                <SelectTrigger className="rounded-2xl text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-2xl text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="سبب النقل أو مكان التخزين..."
              className="rounded-2xl text-right"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            إلغاء
          </Button>
          <Button className="rounded-full" onClick={submit} disabled={busy || nQty <= 0 || over}>
            {busy ? (
              <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="me-1.5 h-4 w-4" />
            )}
            نقل للمخزن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
