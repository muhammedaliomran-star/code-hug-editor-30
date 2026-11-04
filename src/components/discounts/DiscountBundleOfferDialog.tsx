import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackagePlus } from "lucide-react";

export interface DiscountBundleOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  keywords: string;
  onKeywordsChange: (v: string) => void;
  discount: string;
  onDiscountChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onSave: () => void;
}

export function DiscountBundleOfferDialog({
  open, onOpenChange, editing, title, onTitleChange, keywords, onKeywordsChange,
  discount, onDiscountChange, notes, onNotesChange, onSave,
}: DiscountBundleOfferDialogProps) {
  return (
        <Dialog open={isOpenBundleModal} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-primary" />
                {editing ? "تعديل باقة العرض" : "إضافة باقة مجمعة جديدة"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الباقة</Label>
                <Input
                  value={bundleTitle}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="مثال: باقة الهاتف + الشاحن السريع"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">الكلمات المفتاحية للأصناف المطلوبة (مفصولة بفاصلة)</Label>
                <Input
                  value={bundleKeywords}
                  onChange={(e) => onKeywordsChange(e.target.value)}
                  placeholder="مثال: هاتف, شاحن"
                />
                <p className="text-[11px] text-muted-foreground">
                  عند وجود صنف يحتوي الكلمة الأولى وصنف يحتوي الكلمة الثانية في نفس الفاتورة، يُطبق الخصم تلقائياً.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">مبلغ الخصم الإجمالي للباقة (ج.م)</Label>
                <Input
                  type="number"
                  min="1"
                  value={bundleDiscount}
                  onChange={(e) => onDiscountChange(e.target.value)}
                  className="font-mono text-center font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات (اختياري)</Label>
                <Input
                  value={bundleNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="ملاحظات..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                إلغاء
              </Button>
              <Button onClick={onSave} className="text-xs font-bold bg-primary text-primary-foreground">
                حفظ الباقة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );
}
