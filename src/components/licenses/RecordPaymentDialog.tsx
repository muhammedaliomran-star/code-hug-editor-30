import type { FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LicenseRecord } from "@/lib/licensing";

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  license: LicenseRecord | null;
  onSubmit: (e: FormEvent) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  receipt: string;
  onReceiptChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  license,
  onSubmit,
  amount,
  onAmountChange,
  receipt,
  onReceiptChange,
  notes,
  onNotesChange,
}: RecordPaymentDialogProps) {
  return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            {license && license.installments && (
              <DialogContent className="max-w-md text-right rounded-3xl p-6">
                <DialogHeader className="text-right pb-3 border-b border-foreground/10">
                  <DialogTitle className="text-base font-black text-foreground">
                    سند تحصيل قسط — {license.shopName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    المتبقي الكلي:{" "}
                    <strong>{license.installments.remainingBalance.toLocaleString()} ج.م</strong>
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4 py-2">
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">المبلغ المحصل (ج.م) *</Label>
                    <Input
                      type="number"
                      required
                      placeholder="مثال: 1000"
                      value={amount}
                      onChange={(e) => onAmountChange(e.target.value)}
                      className="h-11 rounded-2xl text-base font-bold mt-1 bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">رقم سند القبض / الإيصال</Label>
                    <Input
                      placeholder="مثال: REC-4091"
                      value={receipt}
                      onChange={(e) => onReceiptChange(e.target.value)}
                      className="h-10 rounded-2xl text-xs mt-1 bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">ملاحظات التحصيل</Label>
                    <Input
                      placeholder="مثال: تحويل محفظة فودافون كاش أو نقداً"
                      value={notes}
                      onChange={(e) => onNotesChange(e.target.value)}
                      className="h-10 rounded-2xl text-xs mt-1 bg-background"
                    />
                  </div>

                  <DialogFooter className="pt-3 border-t border-foreground/10">
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-2xl text-xs font-black bg-primary text-black hover:bg-primary/90"
                    >
                      تأكيد وحفظ السند
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            )}
          </Dialog>
  );
}
