import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tag } from "lucide-react";

export interface DiscountCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  formCode: string;
  onFormCodeChange: (v: string) => void;
  formTitle: string;
  onFormTitleChange: (v: string) => void;
  formType: string;
  onFormTypeChange: (v: any) => void;
  formValue: string;
  onFormValueChange: (v: string) => void;
  formMinOrder: string;
  onFormMinOrderChange: (v: string) => void;
  formCustomerEligibility: string;
  onFormCustomerEligibilityChange: (v: any) => void;
  formHasMaxUsage: boolean;
  onFormHasMaxUsageChange: (v: boolean) => void;
  formMaxUsage: string;
  onFormMaxUsageChange: (v: string) => void;
  formStartsAt: string;
  onFormStartsAtChange: (v: string) => void;
  formEndsAt: string;
  onFormEndsAtChange: (v: string) => void;
  formNotes: string;
  onFormNotesChange: (v: string) => void;
  onSave: () => void;
}

export function DiscountCouponDialog({
  open, onOpenChange, editing, formCode, onFormCodeChange, formTitle, onFormTitleChange,
  formType, onFormTypeChange, formValue, onFormValueChange, formMinOrder, onFormMinOrderChange,
  formCustomerEligibility, onFormCustomerEligibilityChange, formHasMaxUsage, onFormHasMaxUsageChange,
  formMaxUsage, onFormMaxUsageChange, formStartsAt, onFormStartsAtChange, formEndsAt, onFormEndsAtChange,
  formNotes, onFormNotesChange, onSave,
}: DiscountCouponDialogProps) {
  return (
        <Dialog open={isOpenCouponModal} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                {editing ? "تعديل كود الخصم" : "إنشاء كود خصم جديد"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">كود الخصم (Promo Code)</Label>
                <div className="flex gap-2">
                  <Input
                    value={formCode}
                    onChange={(e) => onFormCodeChange(e.target.value.toUpperCase())}
                    placeholder="مثال: SUMMER20"
                    className="font-mono uppercase font-bold text-center tracking-wider text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const random = `SALE${Math.floor(10 + Math.random() * 90)}`;
                      onFormCodeChange(random);
                    }}
                    className="text-xs px-3 font-medium shrink-0"
                  >
                    توليد كود
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">اسم أو عنوان العرض</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => onFormTitleChange(e.target.value)}
                  placeholder="مثال: خصم الصيف 20%"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">نوع الخصم</Label>
                  <Select value={formType} onValueChange={(v: any) => onFormTypeChange(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                      <SelectItem value="fixed">مبلغ ثابت (ج.م)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    القيمة {formType === "percentage" ? "(%)" : "(ج.م)"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formValue}
                    onChange={(e) => onFormValueChange(e.target.value)}
                    className="font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الحد الأدنى للفاتورة (ج.م)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formMinOrder}
                    onChange={(e) => onFormMinOrderChange(e.target.value)}
                    className="font-mono text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">الفئة المستهدفة</Label>
                  <Select
                    value={formCustomerEligibility}
                    onValueChange={(v: any) => onFormCustomerEligibilityChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع العملاء</SelectItem>
                      <SelectItem value="cash">الدفع الفوري فقط</SelectItem>
                      <SelectItem value="installment">عملاء الأقساط</SelectItem>
                      <SelectItem value="vip">كبار العملاء (VIP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/30 pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">تحديد سقف لمرات الاستخدام؟</Label>
                  <Switch checked={formHasMaxUsage} onCheckedChange={onFormHasMaxUsageChange} />
                </div>
                {formHasMaxUsage && (
                  <Input
                    type="number"
                    min="1"
                    value={formMaxUsage}
                    onChange={(e) => onFormMaxUsageChange(e.target.value)}
                    placeholder="مثال: 50 مرة"
                    className="font-mono text-center"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border/30 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">تاريخ البدء</Label>
                  <Input
                    type="date"
                    value={formStartsAt}
                    onChange={(e) => onFormStartsAtChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تاريخ الانتهاء (اختياري)</Label>
                  <Input
                    type="date"
                    value={formEndsAt}
                    onChange={(e) => onFormEndsAtChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات داخلية (اختياري)</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => onFormNotesChange(e.target.value)}
                  placeholder="ملاحظات لإدارة المحل..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                إلغاء
              </Button>
              <Button onClick={onSave} className="text-xs font-bold bg-primary text-primary-foreground">
                {editing ? "حفظ التعديلات" : "إنشاء الكوبون"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );
}
