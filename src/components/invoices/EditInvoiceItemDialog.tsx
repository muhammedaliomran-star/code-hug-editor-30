import { useState, useEffect } from "react";
import { db, type InvoiceItem } from "@/lib/store";
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
import { toast } from "sonner";

export function EditInvoiceItemDialog({ item, onClose }: { item: InvoiceItem | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  useEffect(() => {
    if (item) { setName(item.name); setCost(String(item.cost)); setPrice(String(item.price)); }
  }, [item]);
  if (!item) return null;
  const submit = async () => {
    if (!name.trim()) return toast.error("أدخل اسم المنتج");
    await db.updateInvoiceItem(item.id, { name: name.trim(), cost: Number(cost || 0), price: Number(price || 0) });
    toast.success("تم تحديث المنتج");
    onClose();
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تعديل المنتج</DialogTitle>
          <DialogDescription className="text-right">تحديث بيانات المنتج داخل الفاتورة.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div><Label>اسم المنتج</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>التكلفة (ج.م)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div><Label>سعر البيع (ج.م)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">حفظ التعديلات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
