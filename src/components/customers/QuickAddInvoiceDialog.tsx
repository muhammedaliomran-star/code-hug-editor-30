import { useState } from "react";
import { db, fmt, type Invoice } from "@/lib/store";
import { ddmmyyyyToIso } from "@/lib/date-utils";
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
import { Plus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuickAddInvoice({ customerId, blocked }: { customerId: string; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [cost, setCost] = useState("");
  const [total, setTotal] = useState("");
  const [down, setDown] = useState("0");
  const [monthly, setMonthly] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [notes, setNotes] = useState("");

  const remaining = Math.max(0, Number(total || 0) - Number(down || 0));
  const installmentsCount = Number(monthly) > 0 ? Math.ceil(remaining / Number(monthly)) : 0;
  const costNum = Number(cost || 0);
  const totalNum = Number(total || 0);
  const profit = totalNum - costNum;
  const profitPct = costNum > 0 ? (profit / costNum) * 100 : 0;

  const submit = () => {
    if (blocked) return toast.error("هذا العميل محظور من فتح فواتير جديدة");
    if (!productName.trim()) return toast.error("أدخل اسم المنتج");
    const t = Number(total),
      d = Number(down),
      mo = Number(monthly);
    if (!t || !mo || !dateInput) return toast.error("املأ كل البيانات");
    const iso = ddmmyyyyToIso(dateInput);
    if (!iso) return toast.error("صيغة التاريخ يجب أن تكون DD/MM/YYYY");
    const productNotes = `${productName}${notes ? ` — ${notes}` : ""}`;
    db.addInvoice({
      customerId,
      total: t,
      downPayment: d,
      monthlyInstallment: mo,
      firstDueDate: iso,
      notes: productNotes,
    });
    toast.success("تمت إضافة الفاتورة");
    setOpen(false);
    setProductName("");
    setCost("");
    setTotal("");
    setDown("0");
    setMonthly("");
    setDateInput("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 text-primary border-primary/30 hover:bg-primary/10"
          aria-label="إضافة فاتورة"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">إنشاء فاتورة جديدة</DialogTitle>
          <DialogDescription className="text-right">
            إضافة عملية بيع جديدة بالتقسيط.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>اسم المنتج</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="اسم المنتج..."
                maxLength={100}
              />
            </div>
            <div>
              <Label>تكلفة المنتج (ج.م)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
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
          <div className="rounded-2xl bg-foreground/[0.035] p-3 flex items-center justify-between">
            <span className="text-primary font-bold">{fmt(remaining)} ج.م</span>
            <span className="text-sm text-muted-foreground">المبلغ المتبقي للتقسيط:</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>القسط الشهري (ج.م)</Label>
              <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div>
              <Label>عدد الأقساط</Label>
              <Input
                type="number"
                value={installmentsCount || ""}
                readOnly
                className="bg-foreground/[0.04]"
              />
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
            <Label>ملاحظات السلعة</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="وصف المنتج..."
              maxLength={200}
            />
          </div>
          <div className="rounded-2xl hairline bg-foreground/[0.03] p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{fmt(costNum)} ج.م</span>
              <span className="text-muted-foreground">تكلفة الفاتورة:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{fmt(totalNum)} ج.م</span>
              <span className="text-muted-foreground">المبلغ المباع به:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={cn("font-bold", profit >= 0 ? "text-success" : "text-danger")}>
                {fmt(profit)} ج.م
              </span>
              <span className="text-muted-foreground">صافي الربح:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={cn("font-bold", profit >= 0 ? "text-success" : "text-danger")}>
                {profitPct.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">نسبة الربح:</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="w-full" disabled={blocked}>
            إنشاء الفاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
