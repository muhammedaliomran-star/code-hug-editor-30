import { useState } from "react";
import { fmt, daysLate, customerBalance, type Invoice, type Customer, type InvoiceItem, type Payment } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil, Wallet, Eye } from "lucide-react";
import { EditInvoiceItemDialog } from "./EditInvoiceItemDialog";

export function HistoryDialog({ customer, onClose, invoices, payments, items, blurCls, onEditInvoice, onViewInvoice }: {
  customer: Customer | null;
  onClose: () => void;
  invoices: Invoice[];
  payments: Payment[];
  items: InvoiceItem[];
  blurCls: string;
  onEditInvoice: (inv: Invoice) => void;
  onViewInvoice?: (inv: Invoice) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<InvoiceItem | null>(null);
  if (!customer) return null;
  const myInvoices = invoices.filter((i) => i.customerId === customer.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const myInvoiceIds = new Set(myInvoices.map((i) => i.id));
  const payList = payments.filter((p) => myInvoiceIds.has(p.invoiceId)).sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  const totalPaid = payList.reduce((s, p) => s + p.amount, 0);
  const balance = customerBalance(invoices, customer.id, customer.openingBalance);

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            سجل الحركات الكامل
            <span className="w-5 h-5 text-primary">📋</span>
          </DialogTitle>
          <DialogDescription className="text-right">كل فواتير ومنتجات ومدفوعات العميل {customer.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-right">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl hairline bg-foreground/[0.035] p-2.5">
              <div className="text-[11px] text-muted-foreground">عدد الفواتير</div>
              <div className="font-bold text-lg">{myInvoices.length}</div>
            </div>
            <div className="rounded-2xl hairline bg-success/10 p-2.5">
              <div className="text-[11px] text-muted-foreground">إجمالي المسدد</div>
              <div className={cn("font-bold text-lg text-success", blurCls)}>{fmt(totalPaid)} ج.م</div>
            </div>
            <div className="rounded-2xl hairline bg-danger/10 p-2.5">
              <div className="text-[11px] text-muted-foreground">المتبقي</div>
              <div className={cn("font-bold text-lg", balance > 0 ? "text-danger" : "text-success", blurCls)}>{fmt(balance)} ج.م</div>
            </div>
          </div>

          <ScrollArea className="max-h-[55vh] rounded-2xl hairline">
            {myInvoices.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">لا توجد فواتير لهذا العميل</div>
            ) : (
              <div className="divide-y divide-border">
                {myInvoices.map((inv) => {
                  const invItems = items.filter((it) => it.invoiceId === inv.id);
                  const isOpen = expanded === inv.id;
                  const remaining = inv.total - inv.paid;
                  return (
                    <div key={inv.id}>
                      <div className="w-full flex items-center justify-between p-3 hover:bg-foreground/[0.035] transition text-right gap-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-warning hover:bg-warning/10" title="تعديل الفاتورة" onClick={(e) => { e.stopPropagation(); onEditInvoice(inv); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {onViewInvoice && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" title="عرض التفاصيل" onClick={(e) => { e.stopPropagation(); onViewInvoice(inv); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {inv.monthlyInstallment > 0 && remaining > 0 && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-success hover:bg-success/10" title="دفع قسط">
                              <Wallet className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <button className="flex-1 text-right" onClick={() => setExpanded(isOpen ? null : inv.id)}>
                          <div className="flex items-center justify-end gap-2">
                            <div>
                              <div className="text-sm font-bold">{inv.notes || "فاتورة مبيعات"}</div>
                              <div className="text-[11px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString("ar-EG")} • #{inv.id.slice(0, 6)}</div>
                            </div>
                            <Badge variant="outline" className={cn(
                              "text-[10px] px-2 py-0.5 shrink-0",
                              remaining === 0 ? "bg-success/15 text-success border-success/30" :
                              daysLate(inv) > 0 ? "bg-danger/15 text-danger border-danger/30" :
                              "bg-primary/15 text-primary border-primary/30"
                            )}>
                              {remaining === 0 ? "مسددة" : daysLate(inv) > 0 ? `متأخرة ${daysLate(inv)} يوم` : "نشطة"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-end gap-3 mt-1">
                            <span className={cn("text-xs font-bold tabular-nums", blurCls)}>{fmt(inv.total)} ج.م</span>
                            {remaining > 0 && <span className="text-[11px] text-danger tabular-nums">متبقي: {fmt(remaining)}</span>}
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
        <EditInvoiceItemDialog item={editing} onClose={() => setEditing(null)} />
      </DialogContent>
    </Dialog>
  );
}
