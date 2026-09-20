import { fmt, type Invoice, type Customer } from "@/lib/store";
import { isoToDDMMYYYY } from "@/lib/date-utils";
import { daysLate } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Bell, MessageCircle } from "lucide-react";
import { toArabicDigits } from "@/lib/arabic-digits";
import { toast } from "sonner";

export function ReminderDialog({ inv, customer, onClose }: { inv: Invoice | null; customer: Customer | null; onClose: () => void }) {
  if (!inv || !customer) return null;
  const remaining = inv.total - inv.paid;
  const late = daysLate(inv);
  const overdueAmount = Math.min(inv.monthlyInstallment, remaining);
  const message =
    `مرحباً ${customer.name}،\n` +
    `نود تذكيرك بقسط الفاتورة رقم #${inv.id.slice(0, 6)} المستحق منذ ${late} يوم.\n\n` +
    `• قيمة القسط المتأخر: ${fmt(overdueAmount)} ج.م\n` +
    `• إجمالي المتبقي على الفاتورة: ${fmt(remaining)} ج.م\n` +
    `• تاريخ الاستحقاق: ${isoToDDMMYYYY(inv.firstDueDate)}\n\n` +
    `نرجو سرعة السداد. شكراً لتعاونك.`;

  const phone = customer.phone.replace(/[^\d]/g, "");
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            رسالة تذكير
            <Bell className="w-5 h-5 text-warning" />
          </DialogTitle>
          <DialogDescription className="text-right">رسالة جاهزة للإرسال للعميل {customer.name}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl hairline bg-foreground/[0.035] p-3 text-right whitespace-pre-line text-sm leading-relaxed">
          {message}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(toArabicDigits(message)); toast.success("تم نسخ الرسالة"); }}>نسخ</Button>
          <Button asChild className="gap-2 bg-success hover:bg-success/90 text-success-foreground">
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4" /> إرسال عبر واتساب
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
