import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Layers } from "lucide-react";

export interface DiscountQtyOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  minCount: string;
  onMinCountChange: (v: string) => void;
  pct: string;
  onPctChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onSave: () => void;
}

export function DiscountQtyOfferDialog({
  open, onOpenChange, editing, title, onTitleChange, minCount, onMinCountChange,
  pct, onPctChange, notes, onNotesChange, onSave,
}: DiscountQtyOfferDialogProps) {
  return (
        <Dialog open={isOpenQtyModal} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                {editing ? "تعديل عرض الكميات" : "إضافة عرض كميات جديد"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان العرض</Label>
                <Input
                  value={qtyTitle}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="مثال: خصم 10% عند شراء 3 قطع فأكثر"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الحد الأدنى للكمية (قطع)</Label>
                  <Input
                    type="number"
                    min="2"
                    value={qtyMinCount}
                    onChange={(e) => onMinCountChange(e.target.value)}
                    className="font-mono text-center font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">نسبة الخصم (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={qtyPct}
                    onChange={(e) => onPctChange(e.target.value)}
                    className="font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات توضيحية</Label>
                <Input
                  value={qtyNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="مثال: يطبق تلقائياً على أي صنف بالكمية المحددة"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                إلغاء
              </Button>
              <Button onClick={onSave} className="text-xs font-bold bg-primary text-primary-foreground">
                حفظ العرض
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );
}
