import { useState, useEffect } from "react";
import { db, fmt, useDB, type Invoice, type ProductRow } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, CalendarIcon, Banknote } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function EditInvoiceDialog({ inv, onClose }: { inv: Invoice | null; onClose: () => void }) {
  const data = useDB();
  const { privacy } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [down, setDown] = useState("");
  const [monthly, setMonthly] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (inv) {
      const items = data.invoiceItems.filter((it) => it.invoiceId === inv.id);
      const rows: ProductRow[] = items.length > 0
        ? items.map((it) => ({ id: it.id, name: it.name, cost: String(it.cost), price: String(it.price), quantity: String(it.quantity), discount: String(it.discountPct), taxPct: String(it.taxPct), serialNumbers: it.serialNumbers.join(", ") }))
        : [{ id: crypto.randomUUID(), name: inv.notes || "منتج", cost: "0", price: String(inv.total), quantity: "1" }];
      setProducts(rows);
      setDown(String(inv.downPayment));
      setMonthly(String(inv.monthlyInstallment));
      setDate(new Date(inv.firstDueDate));
      setNotes(inv.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id]);

  if (!inv) return null;

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.quantity || 1), 0);
  const itemNet = (p: ProductRow) => {
    const gross = Number(p.price || 0) * Number(p.quantity || 1);
    const afterDiscount = gross * (1 - Math.min(100, Math.max(0, Number(p.discount || 0))) / 100);
    return Math.max(0, afterDiscount) * (1 + Math.max(0, Number(p.taxPct || 0)) / 100);
  };
  const totalPrice = products.reduce((s, p) => s + itemNet(p), 0);
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = totalPrice - totalCost;
  const isCash = totalPrice > 0 && Number(down) >= totalPrice;

  const addProduct = () => setProducts((p) => [...p, { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
  const removeProduct = (id: string) => setProducts((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));

  const submit = async () => {
    const valid = products.filter((p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0);
    if (valid.length === 0) return toast.error("أضف منتج واحد على الأقل");
    if (!isCash && (!Number(monthly) || !date)) return toast.error("املأ بيانات الأقساط");
    const iso = isCash ? format(new Date(), "yyyy-MM-dd") : format(date as Date, "yyyy-MM-dd");

    await db.updateInvoice(inv.id, {
      total: totalPrice,
      downPayment: isCash ? totalPrice : Number(down || 0),
      monthlyInstallment: isCash ? 0 : Number(monthly),
      firstDueDate: iso,
      notes,
    });

    const existingIds = new Set(data.invoiceItems.filter((it) => it.invoiceId === inv.id).map((it) => it.id));
    const keptIds = new Set(valid.filter((p) => existingIds.has(p.id)).map((p) => p.id));
    for (const oldId of existingIds) if (!keptIds.has(oldId)) await db.removeInvoiceItem(oldId);
    for (const p of valid) {
      const payload = { name: p.name.trim(), cost: Number(p.cost || 0), price: Number(p.price || 0), quantity: Math.max(1, Math.floor(Number(p.quantity || 1))), discountPct: Number(p.discount || 0), taxPct: Number(p.taxPct || 0), serialNumbers: (p.serialNumbers || "").split(/[,\n]+/).map((value) => value.trim()).filter(Boolean) };
      if (existingIds.has(p.id)) await db.updateInvoiceItem(p.id, payload);
      else await db.addInvoiceItem(inv.id, payload);
    }

    toast.success("تم تحديث الفاتورة");
    onClose();
  };

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل الفاتورة #{inv.id.slice(0, 6)}</DialogTitle>
          <DialogDescription className="text-right">تحديث بيانات الفاتورة والمنتجات.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="outline" onClick={addProduct} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4" /> إضافة منتج آخر
              </Button>
              <Label className="text-base font-bold">المنتجات ({products.length})</Label>
            </div>
            <AnimatePresence initial={false}>
              {products.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.98, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                  className="origin-top"
                >
                  <div className="rounded-2xl hairline bg-foreground/[0.03] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeProduct(p.id)} disabled={products.length === 1} className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger/10" title="حذف المنتج">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-bold">منتج #{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div><Label className="text-xs">اسم المنتج</Label><Input value={p.name} onChange={(e) => updateProduct(p.id, { name: e.target.value })} maxLength={100} /></div>
                      <div><Label className="text-xs">التكلفة (ج.م)</Label><Input type="number" value={p.cost} onChange={(e) => updateProduct(p.id, { cost: e.target.value })} className={blurCls} /></div>
                      <div><Label className="text-xs">سعر البيع (ج.م)</Label><Input type="number" value={p.price} onChange={(e) => updateProduct(p.id, { price: e.target.value })} className={blurCls} /></div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[90px_90px_90px_minmax(0,1fr)]">
                      <div><Label className="text-xs">الكمية</Label><Input type="number" min="1" value={p.quantity} onChange={(e) => updateProduct(p.id, { quantity: e.target.value })} /></div>
                      <div><Label className="text-xs">خصم %</Label><Input type="number" min="0" max="100" value={p.discount || ""} onChange={(e) => updateProduct(p.id, { discount: e.target.value })} /></div>
                      <div><Label className="text-xs">ضريبة %</Label><Input type="number" min="0" value={p.taxPct || ""} onChange={(e) => updateProduct(p.id, { taxPct: e.target.value })} /></div>
                      <div><Label className="text-xs">Serial / IMEI</Label><Input dir="ltr" className="font-mono text-xs" value={p.serialNumbers || ""} onChange={(e) => updateProduct(p.id, { serialNumbers: e.target.value })} placeholder="افصل بفاصلة" /></div>
                    </div>
                    <p className="text-[11px] font-bold text-primary">صافي البند: {fmt(itemNet(p))} ج.م</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div><Label>المقدم (ج.م)</Label><Input type="number" value={down} onChange={(e) => setDown(e.target.value)} className={blurCls} /></div>

          <div className="rounded-2xl bg-foreground/[0.035] p-3 flex items-center justify-between">
            <span className={cn("text-primary font-bold", blurCls)}>{fmt(remaining)} ج.م</span>
            <span className="text-sm text-muted-foreground">المبلغ المتبقي للتقسيط:</span>
          </div>

          <AnimatePresence>
            {isCash && (
              <motion.div key="cash" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 400, damping: 14 }} className="flex justify-center">
                <Badge className="gap-1.5 bg-success/15 text-success border border-success/40 text-sm py-1.5 px-3">
                  <Banknote className="w-4 h-4" /> بيع نقدي — لا توجد أقساط
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!isCash && (
              <motion.div key="inst" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} style={{ overflow: "hidden" }} className="origin-top">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>القسط الشهري (ج.م)</Label><Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={blurCls} /></div>
                  <div>
                    <Label>تاريخ أول قسط</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal text-right">
                          {date ? <span dir="ltr">{format(date, "dd/MM/yyyy")}</span> : <span className="text-muted-foreground">DD/MM/YYYY</span>}
                          <CalendarIcon className="h-4 w-4 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>

          <div className={cn("rounded-2xl border p-3 text-sm flex items-center justify-between", profit >= 0 ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5")}>
            <span className={cn("font-extrabold", blurCls, profit >= 0 ? "text-success" : "text-danger")}>{fmt(profit)} ج.م</span>
            <span className="text-muted-foreground">صافي الربح المتوقع:</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">حفظ التعديلات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
