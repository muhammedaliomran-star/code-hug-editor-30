import { useState } from "react";
import { db, fmt, type Invoice, type Customer, type InvoiceItem } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function InvoiceReturnDialog({
  inv,
  customer,
  items,
  onClose,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  onClose: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<{ [itemId: string]: { selected: boolean; quantity: number } }>({});
  const [reason, setReason] = useState("رغبة العميل");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const invItems = items.filter((it) => it.invoiceId === (inv?.id ?? ""));

  const returnPayload = invItems
    .filter((it) => selectedItems[it.id]?.selected && (selectedItems[it.id]?.quantity || 0) > 0)
    .map((it) => ({
      name: it.name,
      unitPrice: it.price,
      quantity: Math.min(it.quantity || 1, selectedItems[it.id]?.quantity || 1),
    }));

  const totalReturnValue = returnPayload.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  const handleSubmitReturn = async () => {
    if (!inv) return;
    if (returnPayload.length === 0) {
      toast.error("حدد صنفاً واحداً على الأقل لإرجاعه");
      return;
    }
    setLoading(true);
    try {
      await db.addReturn({
        invoiceId: inv.id,
        type: "sale",
        totalAmount: totalReturnValue,
        reason: notes ? `${reason} - ${notes}` : reason,
        notes: notes || null,
        items: returnPayload,
      });
      toast.success(`تم تسجيل مرتجع بقيمة ${fmt(totalReturnValue)} ج.م وإعادة الأصناف للمخزن بنجاح`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "تعذر تسجيل المرتجع");
    } finally {
      setLoading(false);
    }
  };

  if (!inv) return null;

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-right">
            مرتجع بضاعة — فاتورة #{inv.id.slice(0, 6)}
            <Undo2 className="w-5 h-5 text-warning" />
          </DialogTitle>
          <DialogDescription className="text-right">
            حدد الأصناف والكميات المراد إرجاعها إلى المخزن وتسوية حساب الفاتورة مع العميل {customer?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground">أصناف الفاتورة المتاحة للإرجاع</Label>
            {invItems.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 border rounded-xl text-center">
                لا توجد أصناف مفصلة لهذه الفاتورة.
              </div>
            ) : (
              <div className="border rounded-2xl divide-y overflow-hidden max-h-56 overflow-y-auto">
                {invItems.map((it) => {
                  const state = selectedItems[it.id] || { selected: false, quantity: it.quantity || 1 };
                  return (
                    <div key={it.id} className={cn("p-3 flex items-center justify-between gap-3 transition-colors", state.selected ? "bg-warning/10" : "bg-card")}>
                      <div className="flex items-center gap-2">
                        {state.selected && (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={it.quantity || 1}
                              value={state.quantity}
                              onChange={(e) => {
                                const q = Math.max(1, Math.min(it.quantity || 1, Number(e.target.value) || 1));
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [it.id]: { ...prev[it.id], quantity: q },
                                }));
                              }}
                              className="w-16 h-8 text-center text-xs"
                            />
                            <span className="text-[11px] text-muted-foreground">من {it.quantity || 1}</span>
                          </div>
                        )}
                        <span className="font-bold text-xs tabular-nums text-muted-foreground">
                          {fmt(it.price * (state.selected ? state.quantity : (it.quantity || 1)))} ج.م
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer flex-1 justify-end">
                        <span className="text-sm font-medium">{it.name}</span>
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={(e) => {
                            setSelectedItems((prev) => ({
                              ...prev,
                              [it.id]: { ...prev[it.id], selected: e.target.checked },
                            }));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-warning focus:ring-warning"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">سبب الإرجاع</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="رغبة العميل">رغبة العميل (استرجاع عادي)</SelectItem>
                  <SelectItem value="عيب صناعة / تالف">عيب صناعة / تالف</SelectItem>
                  <SelectItem value="تبديل مقاس / لون">تبديل مقاس أو مواصفات</SelectItem>
                  <SelectItem value="خطأ في الطلب">خطأ في الطلب أو الشحن</SelectItem>
                  <SelectItem value="أخرى">أسباب أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ملاحظات إضافية</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل العيب أو المرتجع..."
                className="text-xs"
                maxLength={100}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-warning/10 border border-warning/30 p-3 flex items-center justify-between">
            <span className="font-extrabold text-warning text-lg tabular-nums">{fmt(totalReturnValue)} ج.م</span>
            <span className="text-xs font-bold text-warning-foreground">إجمالي قيمة المرتجع المسترد:</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmitReturn}
            disabled={loading || returnPayload.length === 0}
            className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90 font-bold"
          >
            <Undo2 className="w-4 h-4" /> تأكيد المرتجع واسترداد للمخزن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
