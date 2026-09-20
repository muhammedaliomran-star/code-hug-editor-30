import { useState, useEffect, useMemo } from "react";
import { db, fmt, addManualTransaction, type Invoice, type ProductRow } from "@/lib/store";
import { getTreasuryAccounts } from "@/lib/cashbox-system";
import { useDB } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export function PaymentDialog({
  invoiceId,
  max,
  invoiceNo,
  customerName,
  controlledOpen,
  onControlledClose,
  initialAmount,
}: {
  invoiceId: string;
  max: number;
  invoiceNo?: string;
  customerName?: string;
  controlledOpen?: boolean;
  onControlledClose?: () => void;
  initialAmount?: number;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (o: boolean) => {
    if (isControlled) {
      if (!o) onControlledClose?.();
    } else {
      setInternalOpen(o);
    }
  };

  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const accounts = useMemo(() => getTreasuryAccounts().filter((a) => a.active), [open]);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "acc-cash-main");

  useEffect(() => {
    if (open && initialAmount) {
      setAmount(String(initialAmount));
    }
  }, [open, initialAmount]);

  const handleConfirm = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const payAmount = Math.min(n, max);
    await db.recordPayment(invoiceId, payAmount);

    const selectedAcc = accounts.find((a) => a.id === accountId);
    if (selectedAcc) {
      addManualTransaction({
        accountId: selectedAcc.id,
        type: "in",
        category: "سداد فاتورة",
        amount: payAmount,
        title: `تحصيل قسط فاتورة #${invoiceNo || invoiceId.slice(0, 6)} - ${customerName || "عميل"}`,
        date: format(new Date(), "yyyy-MM-dd"),
        notes: `دفعة محصلة للفاتورة #${invoiceNo || invoiceId.slice(0, 6)}`,
        performedBy: "النظام",
      });
    }

    toast.success(`تم تسجيل تحصيل ${fmt(payAmount)} ج.م وإيداعها في «${selectedAcc?.name || "الخزينة"}»`);
    setOpen(false);
    setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 border-success/40 text-success hover:bg-success/10 font-bold">
            <Wallet className="w-3.5 h-3.5" /> دفع
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل دفعة للفاتورة</DialogTitle>
          <DialogDescription className="text-right">
            المتبقي على الفاتورة: <span className="font-bold text-danger">{fmt(max)} ج.م</span> {customerName ? `— العميل: ${customerName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div>
            <Label className="text-xs font-bold">المبلغ المدفوع (ج.م)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`أقصى مبلغ: ${max}`}
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs font-bold">إيداع الدفعة في الخزينة / الحساب</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="text-right">
                <SelectValue placeholder="اختر الخزينة..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === "cash" ? "درج نقدية" : acc.type === "ewallet" ? "محفظة إلكترونية" : "بنك"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              سيتم تسجيل حركة الإيداع تلقائياً في كشف حساب الخزينة المحددة.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full bg-success hover:bg-success/90 text-success-foreground font-bold" onClick={handleConfirm}>
            تأكيد استلام الدفعة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
