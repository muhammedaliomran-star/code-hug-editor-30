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
import { ArrowDown, ArrowUp } from "lucide-react";
import { db, fmt, type StockItem } from "@/lib/store";
import { toast } from "sonner";
import { REASONS } from "./reasons";

/** Quick manual reconciliation: signed delta + required reason, logged in stock_adjustments. */
export function AdjustDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [mode, setMode] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("correction");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setMode("out");
      setAmount("1");
      setReason("correction");
      setNotes("");
    }
  }, [item]);

  const qty = Math.abs(Number(amount) || 0);
  const delta = mode === "in" ? qty : -qty;
  const next = item ? Math.max(0, item.quantity + delta) : 0;

  const submit = async () => {
    if (!item) return;
    if (qty <= 0) {
      toast.error("أدخل كمية أكبر من صفر");
      return;
    }
    setBusy(true);
    try {
      await db.adjustStock(
        item.id,
        delta,
        REASONS.find((r) => r.value === reason)?.label ?? reason,
        notes.trim() || undefined,
      );
      toast.success("تمت تسوية الكمية");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حفظ التسوية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تسوية كمية — {item?.name}</DialogTitle>
          <DialogDescription className="text-right">
            زوّد أو نقّص الكمية بسبب واضح، والحركة هتتسجل في سجل المنتج.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "in" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setMode("in")}
            >
              <ArrowUp className="w-4 h-4" /> إضافة
            </Button>
            <Button
              type="button"
              variant={mode === "out" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setMode("out")}
            >
              <ArrowDown className="w-4 h-4" /> خصم
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label>الكمية</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              سبب التسوية <span className="text-danger">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تفاصيل إضافية..."
              maxLength={200}
            />
          </div>
          <div className="rounded-2xl border-2 border-border bg-foreground/[0.03] p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">الكمية بعد التسوية</span>
            <span className="font-extrabold tabular-nums">
              {fmt(item?.quantity ?? 0)} ← {fmt(next)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={busy}>
            حفظ التسوية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
