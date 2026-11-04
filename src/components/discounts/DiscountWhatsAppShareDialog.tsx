import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, Copy, Share2 } from "lucide-react";
import { generatePromoWhatsAppText } from "@/lib/discounts";
import { toast } from "sonner";

export interface DiscountWhatsAppShareDialogProps {
  open: boolean;
  onClose: () => void;
  coupon: any;
  shopName: string;
  onExecuteSend: (coupon: any) => void;
}

export function DiscountWhatsAppShareDialog({
  open, onClose, coupon, shopName, onExecuteSend,
}: DiscountWhatsAppShareDialogProps) {
  return (
        <Dialog open={!!coupon} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
                <MessageCircle className="w-5 h-5" />
                مشاركة العرض عبر رسالة واتساب
              </DialogTitle>
            </DialogHeader>

            {coupon && (
              <div className="space-y-4 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  تم تجهيز نص دعائي مصمم وجاهز للإرسال للعملاء أو المجموعات للترويج لكود الخصم:
                </p>

                {/* Message Preview Box */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 space-y-2 whitespace-pre-wrap font-sans text-xs text-foreground leading-relaxed">
                  {generatePromoWhatsAppText(coupon, shopName || "سِجلّي")}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        generatePromoWhatsAppText(coupon, shopName || "سِجلّي")
                      );
                      toast.success("تم نسخ نص الرسالة بالكامل بنجاح ✓");
                    }}
                    className="flex-1 text-xs gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    نسخ نص الرسالة
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      onExecuteSend(coupon);
                      onClose();
                    }}
                    className="flex-1 text-xs font-bold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    فتح واتساب وإرسال
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
  );
}
