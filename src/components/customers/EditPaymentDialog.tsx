import { useState } from "react";
import { db, type Payment, type Invoice } from "@/lib/store";
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

export function EditPaymentDialog({ payment, invoices }: { payment: Payment; invoices: Invoice[] }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const inv = invoices.find((i) => i.id === payment.invoiceId);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("أدخل مبلغ صحيح");
    try {
      await db.updatePayment(payment.id, n);
      toast.success("تم تحديث الدفعة");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تعديل الدفعة</DialogTitle>
          <DialogDescription className="text-right">
            {inv ? `على فاتورة: ${inv.notes || "بدون وصف"}` : "دفعة"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div>
            <Label>المبلغ (ج.م)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full">
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
