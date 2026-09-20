import { useState } from "react";
import { db, fmt, type Invoice } from "@/lib/store";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

export function QuickAddPayment({ invoices }: { invoices: Invoice[] }) {
  const open_invoices = invoices.filter((i) => i.paid < i.total);
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");

  const inv = open_invoices.find((i) => i.id === invoiceId);
  const max = inv ? inv.total - inv.paid : 0;

  const submit = () => {
    if (!invoiceId) return toast.error("اختر فاتورة");
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("أدخل مبلغ صحيح");
    db.recordPayment(invoiceId, Math.min(n, max));
    toast.success("تم تسجيل الدفعة");
    setOpen(false);
    setInvoiceId("");
    setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 text-success border-success/30 hover:bg-success/10"
          aria-label="تسجيل دفعة"
          disabled={open_invoices.length === 0}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل دفعة</DialogTitle>
          <DialogDescription className="text-right">اختر الفاتورة وأدخل المبلغ.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div>
            <Label>الفاتورة</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر فاتورة" />
              </SelectTrigger>
              <SelectContent>
                {open_invoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.notes || "فاتورة"} — متبقي {fmt(i.total - i.paid)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المبلغ (ج.م) — أقصى {fmt(max)}</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full gap-2">
            <Wallet className="w-4 h-4" /> تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
