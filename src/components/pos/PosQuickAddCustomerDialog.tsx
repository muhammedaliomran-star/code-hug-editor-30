import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

export interface PosQuickAddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  onSubmit: () => void;
}

export function PosQuickAddCustomerDialog({
  open, onOpenChange, name, onNameChange, phone, onPhoneChange, address, onAddressChange, onSubmit,
}: PosQuickAddCustomerDialogProps) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              تسجيل عميل جديد سريع
            </DialogTitle>
            <DialogDescription className="text-xs">
              أدخل بيانات العميل ليتم اختياره فورياً للفاتورة الحالية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">اسم العميل *</Label>
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="مثال: محمد أحمد"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">رقم الهاتف</Label>
              <Input
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="h-10 rounded-xl font-mono text-right"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">العنوان أو المنطقة</Label>
              <Input
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                placeholder="مثال: وسط البلد"
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            >
              حفظ واختيار العميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
