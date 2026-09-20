import { fmt, type Invoice, type Customer, type InvoiceItem } from "@/lib/store";
import { isoToDDMMYYYY } from "@/lib/date-utils";
import { toArabicDigits } from "@/lib/arabic-digits";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, Copy, Share2 } from "lucide-react";
import { format } from "date-fns";

export function ShareInvoiceDialog({
  inv,
  customer,
  items,
  shopSettings,
  onClose,
}: {
  inv: Invoice | null;
  customer: Customer | null;
  items: InvoiceItem[];
  shopSettings: any;
  onClose: () => void;
}) {
  if (!inv || !customer) return null;

  const invItems = items.filter((it) => it.invoiceId === inv.id);
  const remaining = inv.total - inv.paid;
  const invNo = inv.id.slice(0, 6);
  const shopName = shopSettings?.shopName || "المتجر";
  const cur = shopSettings?.currency || "ج.م";

  const receiptUrl = inv.receiptToken ? `${window.location.origin}/receipt/${inv.receiptToken}` : "";
  const itemsText = invItems.length > 0
    ? invItems.map((it) => `• ${it.name} (الكمية: ${it.quantity || 1}) - ${fmt(it.lineTotal || it.price * (it.quantity || 1))} ${cur}${it.serialNumbers.length ? `\n  سيريال: ${it.serialNumbers.join("، ")}` : ""}`).join("\n")
    : `• ${inv.notes || "مبيعات عامة"} - ${fmt(inv.total)} ${cur}`;

  const message =
    `🧾 *فاتورة مبيعات رقم #${invNo}*\n` +
    `🏢 *${shopName}*\n` +
    `👤 *العميل:* ${customer.name}\n` +
    `📅 *التاريخ:* ${format(new Date(inv.createdAt), "dd/MM/yyyy")}\n` +
    `──────────────────\n` +
    `📦 *المنتجات:*\n` +
    `${itemsText}\n` +
    `──────────────────\n` +
    `💵 *إجمالي الفاتورة:* ${fmt(inv.total)} ${cur}\n` +
    `💰 *المسدد حتى الآن:* ${fmt(inv.paid)} ${cur}\n` +
    `⏳ *المتبقي المستحق:* ${fmt(remaining)} ${cur}\n` +
    (inv.monthlyInstallment > 0
      ? `📅 *القسط الشهري:* ${fmt(inv.monthlyInstallment)} ${cur} (أول استحقاق: ${isoToDDMMYYYY(inv.firstDueDate)})\n`
      : `✅ *طريقة الدفع:* نقدي (كاش فوري)\n`) +
    (shopSettings?.phone ? `📞 *خدمة العملاء:* ${shopSettings.phone}\n` : "") +
    (receiptUrl ? `🔗 *الإيصال الرقمي:* ${receiptUrl}\n` : "") +
    `\nشكراً لتعاملكم معنا ونرحب بكم دائماً! 🌸`;

  const cleanPhone = (customer.phone || "").replace(/[^\d]/g, "");
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={!!inv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-right">
            مشاركة الفاتورة الرقمية
            <MessageCircle className="w-5 h-5 text-success" />
          </DialogTitle>
          <DialogDescription className="text-right">
            إيصال رقمي منسق جاهز للمشاركة مع العميل {customer.name} عبر واتساب أو الرسائل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-right">
          <div className="bg-foreground/[0.035] p-3.5 rounded-2xl hairline max-h-60 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-line select-all" dir="rtl">
            {message}
          </div>

          <div className="text-[11px] text-muted-foreground text-center">
            رقم الهاتف المسجل: <span dir="ltr" className="font-bold text-foreground">{customer.phone || "غير مسجل"}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {receiptUrl && (
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(receiptUrl); toast.success("تم نسخ رابط الإيصال"); }} className="gap-1.5">
              <Share2 className="w-4 h-4" /> نسخ الرابط
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(toArabicDigits(message));
              toast.success("تم نسخ نص الفاتورة للحافظة بنجاح");
            }}
            className="gap-1.5"
          >
            <Copy className="w-4 h-4" /> نسخ النص
          </Button>
          <Button
            asChild
            className="gap-2 bg-success hover:bg-success/90 text-success-foreground font-bold"
          >
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4" /> إرسال عبر واتساب
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
