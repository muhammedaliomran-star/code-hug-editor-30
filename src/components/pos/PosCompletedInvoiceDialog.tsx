import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, MessageCircle, Printer } from "lucide-react";
import { fmt } from "@/lib/store";

export interface PosCompletedInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  completedInvoice: any;
  onWhatsApp: () => void;
  onPrint: () => void;
}

export function PosCompletedInvoiceDialog({
  open, onClose, completedInvoice, onWhatsApp, onPrint,
}: PosCompletedInvoiceDialogProps) {
  return (
      <Dialog open={!!completedInvoice} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-success">
              <Check className="h-6 w-6 rounded-full bg-success/15 p-1 text-success" />
              تم حفظ فاتورة البيع {completedInvoice?.code} بنجاح!
            </DialogTitle>
            <DialogDescription className="text-xs">
              المبلغ المسدد نقداً: <b className="text-foreground font-mono">{fmt(completedInvoice?.total || 0)} ج.م</b>
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <div className="py-1 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">العميل:</span>
                <span className="font-bold text-foreground">{completedInvoice?.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">عدد الأصناف:</span>
                <span className="font-bold font-mono">{completedInvoice?.items.length}</span>
              </div>
              <div className="flex justify-between font-bold text-primary pt-1 border-t border-border/30">
                <span>الإجمالي المدفوع:</span>
                <span className="font-mono">{fmt(completedInvoice?.total || 0)} ج.م</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* WhatsApp Button */}
            <Button
              type="button"
              variant="outline"
              onClick={onWhatsApp}
              className="rounded-xl border-success/40 text-success hover:bg-success/10 font-bold text-xs gap-1.5 flex-1"
            >
              <MessageCircle className="h-4 w-4" />
              <span>إرسال واتساب</span>
            </Button>

            {/* Print Button */}
            <Button
              type="button"
              onClick={onPrint}
              className="rounded-xl font-bold text-xs gap-1.5 flex-1 bg-primary text-primary-foreground"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة الإيصال</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
