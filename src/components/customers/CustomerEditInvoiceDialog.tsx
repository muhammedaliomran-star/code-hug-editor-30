import { useState } from "react";
import { db, type Invoice } from "@/lib/store";
import { isoToDDMMYYYY, ddmmyyyyToIso } from "@/lib/date-utils";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

export function CustomerEditInvoiceDialog({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(String(invoice.total));
  const [down, setDown] = useState(String(invoice.downPayment));
  const [monthly, setMonthly] = useState(String(invoice.monthlyInstallment));
  const [dateInput, setDateInput] = useState(isoToDDMMYYYY(invoice.firstDueDate));
  const [notes, setNotes] = useState(invoice.notes ?? "");

  const submit = async () => {
    const t = Number(total),
      d = Number(down),
      mo = Number(monthly);
    if (!t || !mo || !dateInput) return toast.error("املأ كل البيانات");
    const iso = ddmmyyyyToIso(dateInput);
    if (!iso) return toast.error("صيغة التاريخ يجب أن تكون DD/MM/YYYY");
    try {
      await db.updateInvoice(invoice.id, {
        total: t,
        downPayment: d,
        monthlyInstallment: mo,
        firstDueDate: iso,
        notes,
      });
      toast.success("تم تحديث الفاتورة");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "تعذّر التحديث");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-success hover:bg-success/10 action-btn"
          aria-label="تعديل"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل الفاتورة</DialogTitle>
          <DialogDescription className="text-right">
            سيُعاد احتساب الرصيد المتبقي تلقائياً.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>سعر المنتج (ج.م)</Label>
              <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <Label>المقدم (ج.م)</Label>
              <Input type="number" value={down} onChange={(e) => setDown(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>القسط الشهري (ج.م)</Label>
              <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div>
              <Label>تاريخ أول قسط</Label>
              <Input
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                placeholder="DD/MM/YYYY"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
