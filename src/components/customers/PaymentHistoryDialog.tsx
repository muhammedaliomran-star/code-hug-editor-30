import { type Customer, type Invoice, type Payment, fmt } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { customerMetrics } from "./customer-helpers";

interface PaymentHistoryDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  payments: Payment[];
  privacy: boolean;
}

export function PaymentHistoryDialog({
  customer,
  open,
  onOpenChange,
  invoices,
  payments,
  privacy,
}: PaymentHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            سجل المدفوعات
            <History className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right">
            {customer ? `كل عمليات السداد المسجلة للعميل ${customer.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        {customer &&
          (() => {
            const myInvoiceIds = new Set(
              invoices.filter((i) => i.customerId === customer.id).map((i) => i.id),
            );
            const filteredPayments = payments
              .filter((p) => myInvoiceIds.has(p.invoiceId))
              .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
            const total = filteredPayments.reduce((s, p) => s + p.amount, 0);
            const m = customerMetrics(invoices, customer);
            return (
              <div className="space-y-3 text-right">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl hairline bg-foreground/[0.035] p-2.5">
                    <div className="text-[11px] text-muted-foreground">عدد العمليات</div>
                    <div className="font-bold text-lg">{filteredPayments.length}</div>
                  </div>
                  <div className="rounded-2xl hairline bg-success/10 p-2.5">
                    <div className="text-[11px] text-muted-foreground">إجمالي المسدد</div>
                    <div
                      className={cn("font-bold text-lg text-success", privacy && "privacy-blur")}
                    >
                      {fmt(total)} ج.م
                    </div>
                  </div>
                  <div className="rounded-2xl hairline bg-danger/10 p-2.5">
                    <div className="text-[11px] text-muted-foreground">المتبقي</div>
                    <div
                      className={cn(
                        "font-bold text-lg",
                        m.balance > 0 ? "text-danger" : "text-success",
                        privacy && "privacy-blur",
                      )}
                    >
                      {fmt(m.balance)} ج.م
                    </div>
                  </div>
                </div>
                <ScrollArea className="max-h-[50vh] rounded-2xl hairline">
                  {filteredPayments.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-10">
                      لا توجد مدفوعات مسجلة بعد
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-foreground/[0.04] text-muted-foreground sticky top-0">
                        <tr>
                          <th className="text-right p-2.5 font-medium">#</th>
                          <th className="text-right p-2.5 font-medium">التاريخ</th>
                          <th className="text-right p-2.5 font-medium">الوقت</th>
                          <th className="text-right p-2.5 font-medium">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((p, i) => {
                          const d = new Date(p.paidAt);
                          return (
                            <tr
                              key={p.id}
                              className="border-t border-[var(--hairline)] hover:bg-foreground/[0.035]"
                            >
                              <td className="p-2.5 text-muted-foreground">
                                {filteredPayments.length - i}
                              </td>
                              <td className="p-2.5" dir="ltr">
                                {d.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                })}
                              </td>
                              <td className="p-2.5 text-muted-foreground" dir="ltr">
                                {d.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td
                                className={cn(
                                  "p-2.5 font-bold text-success",
                                  privacy && "privacy-blur",
                                )}
                              >
                                + {fmt(p.amount)} ج.م
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </div>
            );
          })()}
        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
