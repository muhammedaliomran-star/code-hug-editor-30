import { type Customer, type Invoice, type Payment, fmt } from "@/lib/store";
import { isoToDDMMYYYY } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  User,
  FileDown,
  Share2,
  History,
  ShoppingBag,
  Receipt,
  AlertTriangle,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { QuickAddInvoice } from "@/components/customers/QuickAddInvoiceDialog";
import { QuickAddPayment } from "@/components/customers/QuickAddPaymentDialog";
import { CustomerEditInvoiceDialog } from "@/components/customers/CustomerEditInvoiceDialog";
import { EditPaymentDialog } from "@/components/customers/EditPaymentDialog";
import { DeleteTimelineEntry } from "@/components/customers/DeleteTimelineEntry";
import {
  customerMetrics,
  buildTimeline,
  exportStatementPDF,
  shareStatement,
} from "./customer-helpers";

interface CustomerViewDrawerProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  payments: Payment[];
  privacy: boolean;
}

export function CustomerViewDrawer({
  customer,
  open,
  onOpenChange,
  invoices,
  payments,
  privacy,
}: CustomerViewDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="ml-auto h-full w-full max-w-md rounded-none">
        {customer &&
          (() => {
            const c = customer;
            const m = customerMetrics(invoices, c);
            const myInvoices = invoices
              .filter((i) => i.customerId === c.id)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const myPayments = payments
              .filter((p) => myInvoices.some((i) => i.id === p.invoiceId))
              .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
            const initials = c.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((s) => s[0])
              .join("");
            return (
              <>
                <DrawerHeader className="border-b border-[var(--hairline)]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 hairline">
                      <AvatarFallback className="bg-primary/15 text-primary font-bold">
                        {initials || <User className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-right flex-1">
                      <DrawerTitle className="text-lg">{c.name}</DrawerTitle>
                      <DrawerDescription dir="ltr" className="text-right">
                        {c.phone}
                      </DrawerDescription>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 col-span-2"
                      onClick={() =>
                        exportStatementPDF(c, m, myInvoices, myPayments, false)
                      }
                    >
                      <FileDown className="w-4 h-4" />
                      كشف حساب تاريخي (PDF)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        exportStatementPDF(c, m, myInvoices, myPayments, true)
                      }
                      aria-label="طباعة"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="col-span-3 gap-2 border-success/40 text-success hover:bg-success/10"
                      onClick={() => shareStatement(c, m, myInvoices, myPayments)}
                    >
                      <Share2 className="w-4 h-4" />
                      مشاركة عبر واتساب
                    </Button>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-right">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
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
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">إجمالي المعاملات</div>
                      <div className={cn("font-bold text-lg", privacy && "privacy-blur")}>
                        {fmt(m.totalCharged)} ج.م
                      </div>
                    </div>
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">المسدد</div>
                      <div
                        className={cn(
                          "font-bold text-lg text-success",
                          privacy && "privacy-blur",
                        )}
                      >
                        {fmt(m.totalPaid)} ج.م
                      </div>
                    </div>
                    <div className="rounded-2xl hairline bg-foreground/[0.035] p-3">
                      <div className="text-[11px] text-muted-foreground">أقصى تأخير</div>
                      <div
                        className={cn(
                          "font-bold text-lg",
                          m.worstLate > 30 ? "text-danger" : "text-foreground",
                        )}
                      >
                        {m.worstLate > 0 ? `${m.worstLate} يوم` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="rounded-2xl hairline p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">العنوان</span>
                      <span className="font-medium">{c.address || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الانضمام</span>
                      <span className="font-medium" dir="ltr">
                        {isoToDDMMYYYY(c.joiningDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">سقف المديونية</span>
                      <span className={cn("font-medium", privacy && "privacy-blur")}>
                        {c.creditLimit > 0 ? `${fmt(c.creditLimit)} ج.م` : "بدون حد"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">يوم القسط</span>
                      <span className="font-medium">يوم {c.dueDay} من الشهر</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">نوع العميل</span>
                      <CustomerTypeBadge type={c.customerType} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">الحالة</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">التقييم</span>
                      <StarRating value={c.rating} />
                    </div>
                    {c.frozen && (
                      <Badge
                        variant="outline"
                        className="bg-warning/15 text-warning border-warning/30"
                      >
                        حساب مجمّد
                      </Badge>
                    )}
                  </div>

                  {/* Unified Transaction Timeline */}
                  <div>
                    <h3 className="font-bold mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QuickAddInvoice
                          customerId={c.id}
                          blocked={c.frozen || c.status === "defaulter"}
                        />
                        <QuickAddPayment invoices={myInvoices} />
                      </div>
                      <span className="flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        سجل الحركات الكامل
                      </span>
                    </h3>
                    {(() => {
                      const timeline = buildTimeline(c, myInvoices, myPayments);
                      if (timeline.length === 0) {
                        return (
                          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-2xl">
                            لا توجد حركات منذ تاريخ الانضمام
                          </div>
                        );
                      }
                      return (
                        <div className="relative space-y-2 pr-4 border-r-2 border-border/60">
                          {timeline.map((t) => {
                            const isPurchase = t.kind === "purchase";
                            const isOpening = t.kind === "opening";
                            const entityId =
                              t.id.startsWith("inv-") || t.id.startsWith("down-")
                                ? t.id.replace(/^(inv|down)-/, "")
                                : t.id.startsWith("pay-")
                                  ? t.id.replace(/^pay-/, "")
                                  : null;
                            const editableInvoice =
                              (t.id.startsWith("inv-") || t.id.startsWith("down-")) && entityId
                                ? myInvoices.find((i) => i.id === entityId)
                                : null;
                            const editablePayment =
                              t.id.startsWith("pay-") && entityId
                                ? myPayments.find((p) => p.id === entityId)
                                : null;
                            const canEdit = !!editableInvoice || !!editablePayment;
                            return (
                              <div
                                key={t.id}
                                className="relative animate-[fade-in_0.3s_ease-out_both]"
                              >
                                <span
                                  className={cn(
                                    "absolute -right-[22px] top-2 h-3.5 w-3.5 rounded-full border-2 border-background",
                                    isPurchase
                                      ? "bg-danger"
                                      : isOpening
                                        ? "bg-warning"
                                        : "bg-success",
                                  )}
                                />
                                <div
                                  className={cn(
                                    "rounded-2xl border p-2.5 text-sm",
                                    isPurchase
                                      ? "border-danger/30 bg-danger/5"
                                      : isOpening
                                        ? "border-warning/30 bg-warning/5"
                                        : "border-success/30 bg-success/5",
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "gap-1 text-[10px] font-bold",
                                        isPurchase
                                          ? "bg-danger/15 text-danger border-danger/40"
                                          : isOpening
                                            ? "bg-warning/15 text-warning border-warning/40"
                                            : "bg-success/15 text-success border-success/40",
                                      )}
                                    >
                                      {isPurchase ? (
                                        <ShoppingBag className="w-3 h-3" />
                                      ) : isOpening ? (
                                        <AlertTriangle className="w-3 h-3" />
                                      ) : (
                                        <Receipt className="w-3 h-3" />
                                      )}
                                      {isPurchase ? "مشترى" : isOpening ? "رصيد افتتاحي" : "سداد"}
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                      {canEdit && (
                                        <>
                                          {editableInvoice && (
                                            <CustomerEditInvoiceDialog invoice={editableInvoice} />
                                          )}
                                          {editablePayment && (
                                            <EditPaymentDialog
                                              payment={editablePayment}
                                              invoices={myInvoices}
                                            />
                                          )}
                                          <DeleteTimelineEntry
                                            kind={editableInvoice ? "invoice" : "payment"}
                                            id={(editableInvoice ?? editablePayment)!.id}
                                          />
                                        </>
                                      )}
                                      <span
                                        className="text-[11px] text-muted-foreground mr-1"
                                        dir="ltr"
                                      >
                                        {isoToDDMMYYYY(t.date.slice(0, 10))}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-xs text-muted-foreground flex-1">
                                      {t.description}
                                    </div>
                                    <div
                                      className={cn(
                                        "font-bold whitespace-nowrap",
                                        isPurchase || isOpening ? "text-danger" : "text-success",
                                        privacy && "privacy-blur",
                                      )}
                                    >
                                      {isPurchase || isOpening ? "+" : "−"} {fmt(t.amount)} ج.م
                                    </div>
                                  </div>
                                  <div className="mt-1.5 pt-1.5 border-t border-[var(--hairline)] flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">الرصيد المتبقي:</span>
                                    <span
                                      className={cn(
                                        "font-bold tabular-nums",
                                        t.runningBalance > 0 ? "text-danger" : "text-success",
                                        privacy && "privacy-blur",
                                      )}
                                    >
                                      {fmt(t.runningBalance)} ج.م
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <DrawerFooter className="border-t border-[var(--hairline)]">
                  <DrawerClose asChild>
                    <Button variant="outline" className="w-full">
                      إغلاق
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </>
            );
          })()}
      </DrawerContent>
    </Drawer>
  );
}
