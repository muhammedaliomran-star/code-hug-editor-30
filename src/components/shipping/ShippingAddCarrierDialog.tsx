import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export interface ShippingAddCarrierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCarrier: boolean;
  name: string;
  onNameChange: (v: string) => void;
  contact: string;
  onContactChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  baseCost: string;
  onBaseCostChange: (v: string) => void;
  onSave: () => void;
}

export function ShippingAddCarrierDialog({
  open, onOpenChange, editCarrier, name, onNameChange, contact, onContactChange,
  phone, onPhoneChange, baseCost, onBaseCostChange, onSave,
}: ShippingAddCarrierDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="group flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-dashed border-hairline p-8 transition-all hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="rounded-full bg-muted p-4 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Plus className="h-6 w-6" />
          </span>
          <span className="font-bold text-muted-foreground transition-colors group-hover:text-primary">
            إضافة مندوب / شركة شحن
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editCarrier ? "تعديل شركة الشحن" : "إضافة شركة شحن جديدة"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>اسم الشركة</Label>
            <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="مثلاً: ارامكس، مندوب خاص..." className="text-right" />
          </div>
          <div className="space-y-2">
            <Label>المسئول</Label>
            <Input value={contact} onChange={(e) => onContactChange(e.target.value)} placeholder="اسم الشخص المسئول" className="text-right" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="رقم الموبايل للتواصل" className="text-right" />
          </div>
          <div className="space-y-2">
            <Label>التكلفة الأساسية (ج.م)</Label>
            <Input type="number" value={baseCost} onChange={(e) => onBaseCostChange(e.target.value)} className="text-right" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void onSave()} className="h-12 w-full rounded-xl font-bold">
            حفظ البيانات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
