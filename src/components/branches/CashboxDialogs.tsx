import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleDollarSign, FileText } from "lucide-react";

export function RemittanceDialog() {
  const {
    cur,
    isRemittanceOpen, setIsRemittanceOpen,
    remittanceAmount, setRemittanceAmount,
    remittanceDest, setRemittanceDest,
    remittanceDestName, setRemittanceDestName,
    remittanceRef, setRemittanceRef,
    remittanceNotes, setRemittanceNotes,
    handleAddRemittanceSubmit,
  } = useBranches();

  return (
    <Dialog open={isRemittanceOpen} onOpenChange={setIsRemittanceOpen}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
        <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            توريد نقدية من الفرع للخزينة / البنك
          </DialogTitle>
        </div>
        <form onSubmit={handleAddRemittanceSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ المراد توريده ({cur}) *</Label>
            <Input
              type="number"
              step="any"
              required
              placeholder="0.00"
              value={remittanceAmount}
              onChange={(e) => setRemittanceAmount(e.target.value)}
              className="h-11 rounded-xl text-base font-black text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">الجهة المحول إليها *</Label>
            <Select
              value={remittanceDest}
              onValueChange={(val: any) => {
                setRemittanceDest(val);
                setRemittanceDestName(val === "main_vault" ? "الخزينة المركزية (المقر العام)" : "الحساب البنكي للشركة");
              }}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main_vault" className="text-xs">الخزينة المركزية (المقر الرئيسي)</SelectItem>
                <SelectItem value="bank" className="text-xs">الحساب البنكي / إيداع مباشر</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">رقم إيصال الإيداع / المرجع</Label>
            <Input
              placeholder="مثلاً: REF-9874"
              value={remittanceRef}
              onChange={(e) => setRemittanceRef(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظات التوريد</Label>
            <Input
              placeholder="اسم المندوب أو مستلم النقدية..."
              value={remittanceNotes}
              onChange={(e) => setRemittanceNotes(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 h-10 rounded-xl font-bold text-xs">
              تأكيد التوريد
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsRemittanceOpen(false)} className="h-10 rounded-xl text-xs">
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ZReportDialog() {
  const {
    cur,
    isZReportOpen, setIsZReportOpen,
    zCashierName, setZCashierName,
    zOpeningCash, setZOpeningCash,
    zActualCash, setZActualCash,
    zVarianceReason, setZVarianceReason,
    handleCloseShiftSubmit,
  } = useBranches();

  return (
    <Dialog open={isZReportOpen} onOpenChange={setIsZReportOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
        <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            تقفيل الوردية اليومية (Z-Report)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            جرد النقدية بالدرج ومطابقتها مع المبيعات والمصروفات المسجلة بالنظام
          </DialogDescription>
        </div>
        <form onSubmit={handleCloseShiftSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">اسم الكاشير المسؤول *</Label>
            <Input
              required
              value={zCashierName}
              onChange={(e) => setZCashierName(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">العهدة الافتتاحية ({cur})</Label>
              <Input
                type="number"
                value={zOpeningCash}
                onChange={(e) => setZOpeningCash(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-primary">النقدية الفعلية بالدرج ({cur}) *</Label>
              <Input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={zActualCash}
                onChange={(e) => setZActualCash(e.target.value)}
                className="h-10 rounded-xl text-xs font-black"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">سبب الفارق (إن وجد عجز أو زيادة)</Label>
            <Input
              placeholder="مثلاً: فكة ناقصة، تم تسوية نثريات..."
              value={zVarianceReason}
              onChange={(e) => setZVarianceReason(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 h-10 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700">
              اعتماد الإغلاق وطباعة Z-Report
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsZReportOpen(false)} className="h-10 rounded-xl text-xs">
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
