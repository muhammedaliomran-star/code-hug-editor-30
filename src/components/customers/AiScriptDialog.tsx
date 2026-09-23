import { type Customer, type Invoice, aiScript, fmt } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { toArabicDigits } from "@/lib/arabic-digits";
import { customerMetrics } from "./customer-helpers";

interface AiScriptDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
}

export function AiScriptDialog({
  customer,
  open,
  onOpenChange,
  invoices,
}: AiScriptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            المساعد الذكي
            <Sparkles className="w-5 h-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right">
            رسالة مقترحة بناءً على حالة العميل ومدة التأخر.
          </DialogDescription>
        </DialogHeader>
        {customer &&
          (() => {
            const m = customerMetrics(invoices, customer);
            const msg = aiScript(customer, m.balance, m.worstLate);
            const tone =
              m.worstLate <= 0
                ? { label: "ودود", cls: "bg-success/15 text-success border-success/30" }
                : m.worstLate < 7
                  ? { label: "تذكير لطيف", cls: "bg-success/15 text-success border-success/30" }
                  : m.worstLate <= 30
                    ? {
                        label: "متابعة جادة",
                        cls: "bg-warning/15 text-warning border-warning/30",
                      }
                    : { label: "إنذار حازم", cls: "bg-danger/15 text-danger border-danger/30" };
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {m.worstLate > 0 && (
                    <Badge className="bg-danger text-danger-foreground border-0">
                      متأخر {m.worstLate} يوم
                    </Badge>
                  )}
                  <Badge variant="outline" className={tone.cls}>
                    نبرة: {tone.label}
                  </Badge>
                </div>
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-right leading-loose">
                  {msg}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(toArabicDigits(msg));
                      toast.success("تم النسخ");
                    }}
                  >
                    نسخ النص
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      const phone = customer.phone.replace(/^0/, "20");
                      window.open(
                        `https://wa.me/${phone}?text=${encodeURIComponent(toArabicDigits(msg))}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    إرسال واتساب
                  </Button>
                </div>
              </div>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
}
