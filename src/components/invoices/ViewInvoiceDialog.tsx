import { fmt, daysLate, type Invoice, type Customer, type InvoiceItem, type Payment } from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { useShopSettings } from "@/lib/store";
import { isoToDDMMYYYY } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { InstallmentScheduleMatrix } from "@/components/InstallmentScheduleMatrix";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Printer, Truck, MessageCircle, Undo2, Copy, Pencil, CreditCard, Wallet } from "lucide-react";
import { format } from "date-fns";

export function ViewInvoiceDialog({
  inv,
  customer,
  items,
  payments,
  onClose,
  onOpenReturn,
  onOpenShare,
  onOpenCustomPrint,
  onOpenShipment,
  onClone,
  onEdit,
  onDirectPay,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  payments: Payment[];
  onClose: () => void;
  onOpenReturn?: (i: Invoice) => void;
  onOpenShare?: (i: Invoice) => void;
  onOpenCustomPrint?: (i: Invoice) => void;
  onOpenShipment?: (i: Invoice) => void;
  onClone?: (i: Invoice) => void;
  onEdit?: (i: Invoice) => void;
  onDirectPay?: (i: Invoice, amount: number) => void;
}) {
  const { privacy } = usePrivacy();
  const { settings: shop } = useShopSettings();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  if (!inv) return null;

  const remaining = inv.total - inv.paid;
  const late = daysLate(inv);
  const isOverdue = remaining > 0 && late > 0;
  const invItems = items.filter((it) => it.invoiceId === inv.id);
  const invPayments = payments.filter((p) => p.invoiceId === inv.id);

  const totalCost = invItems.reduce((acc, it) => acc + ((it.cost || 0) * (it.quantity || 1)), 0);
  const totalProfit = inv.total - totalCost;
  const paidPct = Math.min(100, Math.round((inv.paid / Math.max(1, inv.total)) * 100));

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(
                "font-bold text-xs px-2.5 py-0.5",
                remaining === 0 ? "bg-success/15 text-success border-success/30" :
                isOverdue ? "bg-danger/15 text-danger border-danger/30" :
                "bg-primary/15 text-primary border-primary/30"
              )}>
                {remaining === 0 ? "مسددة بالكامل" : isOverdue ? `متأخرة ${late} يوم` : "نشطة وجارية"}
              </Badge>
            </div>
            <div className="text-right">
              <DialogTitle className="text-lg font-bold">فاتورة #{inv.id.slice(0, 6)}</DialogTitle>
              <DialogDescription className="text-xs">{customer?.name ?? "عميل محذوف"} {customer?.phone ? `• ${customer.phone}` : ""}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-end gap-2 bg-foreground/[0.03] p-2.5 rounded-2xl border border-border/50">
          <Button size="sm" variant="outline" onClick={() => onOpenCustomPrint?.(inv)} className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 font-bold">
            <Printer className="w-3.5 h-3.5" /> تخصيص وطباعة
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenShipment?.(inv)} className="gap-1.5 text-xs text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/10 font-bold">
            <Truck className="w-3.5 h-3.5" /> تحويل لشحنة
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenShare?.(inv)} className="gap-1.5 text-xs text-success border-success/30 hover:bg-success/10 font-bold">
            <MessageCircle className="w-3.5 h-3.5" /> مشاركة واتساب
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenReturn?.(inv)} className="gap-1.5 text-xs text-warning border-warning/30 hover:bg-warning/10 font-bold">
            <Undo2 className="w-3.5 h-3.5" /> مرتجع بضاعة
          </Button>
          <Button size="sm" variant="outline" onClick={() => onClone?.(inv)} className="gap-1.5 text-xs text-blue-500 border-blue-500/30 hover:bg-blue-500/10 font-bold">
            <Copy className="w-3.5 h-3.5" /> استنساخ
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit?.(inv)} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-right">
          <div className="p-3 rounded-2xl bg-card border border-border/60">
            <div className="text-[11px] text-muted-foreground font-medium mb-1">إجمالي الفاتورة</div>
            <div className={cn("text-base font-extrabold tabular-nums", blurCls)}>{fmt(inv.total)} ج.م</div>
          </div>
          <div className="p-3 rounded-2xl bg-success/5 border border-success/20">
            <div className="text-[11px] text-success font-medium mb-1">المسدد</div>
            <div className={cn("text-base font-extrabold text-success tabular-nums", blurCls)}>{fmt(inv.paid)} ج.م</div>
          </div>
          <div className={cn("p-3 rounded-2xl border", remaining > 0 ? "bg-danger/5 border-danger/20" : "bg-card border-border/60")}>
            <div className={cn("text-[11px] font-medium mb-1", remaining > 0 ? "text-danger" : "text-muted-foreground")}>المتبقي المستحق</div>
            <div className={cn("text-base font-extrabold tabular-nums", remaining > 0 ? "text-danger" : "text-success", blurCls)}>{fmt(remaining)} ج.م</div>
          </div>
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="text-[11px] text-primary font-medium mb-1">صافي الربح التقديري</div>
            <div className={cn("text-base font-extrabold text-primary tabular-nums", blurCls)}>{fmt(totalProfit)} ج.م</div>
          </div>
        </div>

        <div className="space-y-1.5 text-right">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tabular-nums text-muted-foreground">{paidPct}% مسدد</span>
            <span className="text-muted-foreground font-medium">نسبة سداد الفاتورة</span>
          </div>
          <div className="h-2 w-full rounded-full bg-foreground/[0.08] overflow-hidden">
            <div className={cn("h-full transition-all duration-500 rounded-full", remaining === 0 ? "bg-success" : "bg-primary")} style={{ width: `${paidPct}%` }} />
          </div>
        </div>

        <div className="space-y-2 text-right">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">{invItems.length} صنف</Badge>
            <Label className="text-xs font-bold">بنود ومنتجات الفاتورة</Label>
          </div>
          {invItems.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 border rounded-xl text-center">
              لا توجد منتجات مفصلة مسجلة في الفاتورة (مبيعات عامة).
            </div>
          ) : (
            <div className="border border-border/60 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-foreground/[0.035] text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-right p-2 font-bold">المنتج</th>
                    <th className="text-center p-2 font-bold w-16">الكمية</th>
                    <th className="text-right p-2 font-bold">سعر البيع</th>
                    <th className="text-right p-2 font-bold">التكلفة</th>
                    <th className="text-right p-2 font-bold">الإجمالي</th>
                    <th className="text-right p-2 font-bold text-success">الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invItems.map((it) => {
                    const q = it.quantity || 1;
                    const rowTotal = it.lineTotal || it.price * q;
                    const rowCost = (it.cost || 0) * q;
                    const rowProfit = rowTotal - rowCost;
                    return (
                      <tr key={it.id} className="hover:bg-foreground/[0.02]">
                        <td className="p-2 font-medium text-foreground">
                          {it.name}
                          {it.serialNumbers.length > 0 && <div className="mt-1 font-mono text-[10px] text-muted-foreground" dir="ltr">IMEI/SN: {it.serialNumbers.join(" • ")}</div>}
                          {(it.discountPct > 0 || it.taxPct > 0) && <div className="mt-1 text-[10px] text-muted-foreground">خصم {fmt(it.discountPct)}% • ضريبة {fmt(it.taxPct)}%</div>}
                        </td>
                        <td className="p-2 text-center tabular-nums font-bold">{q}</td>
                        <td className={cn("p-2 tabular-nums", blurCls)}>{fmt(it.price)} ج.م</td>
                        <td className={cn("p-2 tabular-nums text-muted-foreground", blurCls)}>{fmt(it.cost || 0)} ج.م</td>
                        <td className={cn("p-2 tabular-nums font-bold", blurCls)}>{fmt(rowTotal)} ج.م</td>
                        <td className={cn("p-2 tabular-nums font-bold text-success", blurCls)}>+{fmt(rowProfit)} ج.م</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {inv.monthlyInstallment > 0 && (
          <div className="pt-2">
            <InstallmentScheduleMatrix inv={inv} customer={customer} payments={payments} onPayInstallment={(amt) => onDirectPay?.(inv, amt)} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right text-xs">
          <div className="p-3 rounded-2xl border border-border/60 space-y-2">
            <div className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center justify-end gap-1.5">
              بيانات الدفع والتقسيط
              <CreditCard className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums">{fmt(inv.downPayment)} ج.م</span>
              <span className="text-muted-foreground">الدفعة المقدمة:</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums">{fmt(inv.monthlyInstallment)} ج.م</span>
              <span className="text-muted-foreground">القسط الشهري:</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums" dir="ltr">{isoToDDMMYYYY(inv.firstDueDate)}</span>
              <span className="text-muted-foreground">تاريخ أول قسط:</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-bold tabular-nums" dir="ltr">{format(new Date(inv.createdAt), "dd/MM/yyyy")}</span>
              <span className="text-muted-foreground">تاريخ إنشاء الفاتورة:</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl border border-border/60 space-y-2">
            <div className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center justify-end gap-1.5">
              سجل سدادات الفاتورة ({invPayments.length})
              <Wallet className="w-3.5 h-3.5 text-success" />
            </div>
            {invPayments.length === 0 ? (
              <div className="text-muted-foreground text-center py-3 text-[11px]">
                لم يتم تسجيل دفعات بعد على هذه الفاتورة.
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto divide-y divide-border/40">
                {invPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1 text-[11px]">
                    <span className="font-bold text-success tabular-nums">+{fmt(p.amount)} ج.م</span>
                    <span className="text-muted-foreground tabular-nums" dir="ltr">{format(new Date(p.paidAt), "dd/MM/yyyy")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {inv.notes && (
          <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-border/50 text-right text-xs">
            <span className="text-muted-foreground font-bold ml-1">ملاحظات:</span>
            <span className="text-foreground">{inv.notes}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
