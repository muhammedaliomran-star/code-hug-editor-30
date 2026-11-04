import { useEffect, useMemo, useState } from "react";
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
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Scale,
  ScanLine,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { db, fmt, PRODUCT_TYPES, type StockItem } from "@/lib/store";
import { posNum, NUM_CLS, GroupLabel } from "@/components/ProductForm";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { generateBarcode } from "@/lib/barcode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { REASONS } from "./reasons";

export function EditDialog({
  item,
  onClose,
  existingBarcodes,
}: {
  item: StockItem | null;
  onClose: () => void;
  existingBarcodes: Array<string | null>;
}) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [itemType, setItemType] = useState<string>(PRODUCT_TYPES[0]);
  const [qty, setQty] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [reason, setReason] = useState<string>("correction");
  const [reasonNotes, setReasonNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setSize(item.size ?? "");
      setItemType(item.itemType || PRODUCT_TYPES[0]);
      setQty(String(item.quantity));
      setCost(String(item.lastUnitCost));
      setPrice(String(item.salePrice));
      setBarcode(item.barcode ?? "");
      setMinStock(String(item.minStock ?? 0));
      setReason("correction");
      setReasonNotes("");
    }
  }, [item]);

  const newQty = Math.max(0, Number(qty) || 0);
  const newCost = Math.max(0, Number(cost) || 0);
  const newPrice = Math.max(0, Number(price) || 0);
  const delta = item ? newQty - item.quantity : 0;
  const profit = newPrice - newCost;
  const margin = newPrice > 0 ? (profit / newPrice) * 100 : 0;
  const reasonRequired = delta !== 0;

  const code = barcode.trim();
  const codeDuplicate = useMemo(() => {
    if (!code) return false;
    const taken = new Set(existingBarcodes.filter(Boolean).map((b) => String(b).trim()));
    if (item?.barcode) taken.delete(item.barcode.trim());
    return taken.has(code);
  }, [code, existingBarcodes, item]);

  const submit = async () => {
    if (!item) return;
    if (!name.trim()) {
      toast.error("اكتب اسم المنتج");
      return;
    }
    if (codeDuplicate) {
      toast.error("الباركود مستخدم بالفعل مع منتج آخر");
      return;
    }
    if (reasonRequired && !reason) {
      toast.error("اختر سبب التعديل");
      return;
    }
    setBusy(true);
    try {
      await db.updateStockItem(
        item.id,
        {
          name: name.trim(),
          size: size.trim() || null,
          itemType,
          quantity: newQty,
          lastUnitCost: newCost,
          salePrice: newPrice,
          barcode: code || null,
          minStock: Math.max(0, Number(minStock) || 0),
        },
        reasonRequired
          ? {
              delta,
              reason: REASONS.find((r) => r.value === reason)?.label ?? reason,
              notes: reasonNotes.trim() || undefined,
            }
          : undefined,
      );
      toast.success("تم تحديث المنتج");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل المنتج</DialogTitle>
          <DialogDescription className="text-right">
            عدّل كل تفاصيل المنتج. أي تغيير في الكمية يحتاج سبب.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="py-2 border-t border-border/40 first:border-t-0">
            <GroupLabel icon={Tag}>هوية المنتج</GroupLabel>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>
                  اسم المنتج <span className="text-danger">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="rounded-2xl text-right"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>المقاس (اختياري)</Label>
                  <Input
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    maxLength={30}
                    placeholder="مثال: L / ٤٢"
                    className="rounded-2xl text-right"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-primary" /> نوع المنتج
                  </Label>
                  <Select value={itemType} onValueChange={setItemType}>
                    <SelectTrigger className="rounded-2xl text-right">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="py-2 border-t border-border/40 first:border-t-0">
            <GroupLabel icon={Wallet}>التسعير والكمية</GroupLabel>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>الكمية</Label>
                <Input
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(posNum(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn("rounded-2xl", NUM_CLS)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>سعر الشراء</Label>
                <Input
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(posNum(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn("rounded-2xl", NUM_CLS)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>سعر البيع</Label>
                <Input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(posNum(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn("rounded-2xl", NUM_CLS)}
                />
              </div>
            </div>

            <div
              className={cn(
                "mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 p-3",
                profit >= 0 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5",
              )}
            >
              <div className="flex items-center gap-2">
                {profit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-danger" />
                )}
                <span className="text-xs text-muted-foreground">الربح المتوقع للوحدة</span>
              </div>
              <div
                className={cn(
                  "font-extrabold tabular-nums",
                  profit >= 0 ? "text-success" : "text-danger",
                )}
              >
                {newPrice > 0 ? (
                  <>{fmt(profit)} ج.م</>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {newPrice > 0 && (
                  <span className="me-2 text-xs font-normal text-muted-foreground">
                    (هامش {fmt(Number(margin.toFixed(1)))}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="py-2 border-t border-border/40 first:border-t-0">
            <GroupLabel icon={ScanLine}>الباركود والمخزون</GroupLabel>
            <div className="grid gap-1.5">
              <Label>الباركود (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="امسح أو اكتب الكود..."
                  dir="ltr"
                  data-latin-digits=""
                  className="rounded-2xl font-mono tabular-nums"
                  maxLength={64}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    setBarcode(generateBarcode(existingBarcodes));
                    toast.success("تم توليد كود فريد");
                  }}
                  title="توليد كود فريد"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => setScanOpen(true)}
                  title="مسح بالكاميرا"
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
              {codeDuplicate && (
                <div className="flex items-center gap-1.5 text-[11px] text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" /> الكود ده مستخدم مع منتج آخر.
                </div>
              )}
            </div>
            <div className="mt-3 grid gap-1.5">
              <Label>الحد الأدنى للمخزون</Label>
              <Input
                inputMode="decimal"
                value={minStock}
                onChange={(e) => setMinStock(posNum(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
                className={cn("rounded-2xl", NUM_CLS)}
              />
              <div className="text-[11px] text-muted-foreground">
                يعتبر المنتج منخفضًا إذا كانت الكمية أقل من هذا الرقم.
              </div>
            </div>
          </div>

          {reasonRequired && (
            <div className="grid gap-2.5 rounded-2xl border-2 border-warning/30 bg-warning/5 p-3 animate-[fade-in_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" />
                تعديل كمية:{" "}
                {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span className="tabular-nums">{fmt(Math.abs(delta))} وحدة</span>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  سبب التعديل <span className="text-danger">*</span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-2xl text-right">
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
                <Label className="text-xs">ملاحظات (اختياري)</Label>
                <Input
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  placeholder="تفاصيل إضافية..."
                  maxLength={200}
                  className="rounded-2xl text-right"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            className="rounded-full"
            onClick={submit}
            disabled={busy || !name.trim() || codeDuplicate}
          >
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={(code) => {
            setBarcode(code);
            setScanOpen(false);
            toast.success("تم التقاط الكود");
          }}
          title="مسح باركود المنتج"
        />
      </DialogContent>
    </Dialog>
  );
}
