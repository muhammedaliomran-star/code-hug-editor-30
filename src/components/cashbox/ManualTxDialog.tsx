import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function ManualTxDialog() {
  const {
    cur,
    accounts,
    accountBalances,
    isManualTxOpen,
    setIsManualTxOpen,
    editingTxId,
    manualTxType,
    setManualTxType,
    manualAmount,
    setManualAmount,
    manualTitle,
    setManualTitle,
    manualCategory,
    setManualCategory,
    manualAccountId,
    setManualAccountId,
    manualNotes,
    setManualNotes,
    manualDate,
    setManualDate,
    resetManualForm,
    handleSaveManualTx,
  } = useCashbox();

  return (
    <Dialog
      open={isManualTxOpen}
      onOpenChange={(open) => {
        setIsManualTxOpen(open);
        if (!open) resetManualForm();
      }}
    >
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {editingTxId ? "تعديل الحركة المالية اليدوية" : "تسجيل حركة مالية مباشرة بالصندوق"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            إيداع رأس مال، إيرادات خدمات، أو سحب مسحوبات شخصية ومصاريف نثرية
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveManualTx} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={manualTxType === "in" ? "default" : "outline"}
              className={cn(
                "rounded-xl text-xs font-bold h-10",
                manualTxType === "in" && "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
              onClick={() => {
                setManualTxType("in");
                setManualCategory("إيراد إضافي");
              }}
            >
              <ArrowDownLeft className="ml-1.5 h-4 w-4" />
              إيداع نقدي (وارد +)
            </Button>
            <Button
              type="button"
              variant={manualTxType === "out" ? "default" : "outline"}
              className={cn(
                "rounded-xl text-xs font-bold h-10",
                manualTxType === "out" && "bg-rose-600 hover:bg-rose-700 text-white"
              )}
              onClick={() => {
                setManualTxType("out");
                setManualCategory("مسحوبات شخصية");
              }}
            >
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
              سحب نقدي (منصرف -)
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الخزينة / القناة المستهدفة</Label>
            <Select value={manualAccountId} onValueChange={setManualAccountId}>
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.name} ({fmt(accountBalances[a.id]?.currentBalance || 0)} {cur})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">المبلغ ({cur}) *</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="h-9 rounded-xl text-xs font-bold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">التاريخ</Label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">بيان المعاملة *</Label>
              <Input
                placeholder="مثال: إيداع رأس مال شريك"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="h-9 rounded-xl text-xs font-semibold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">التصنيف</Label>
              <Select value={manualCategory} onValueChange={setManualCategory}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {manualTxType === "in" ? (
                    <>
                      <SelectItem value="إيراد إضافي" className="text-xs">إيراد إضافي</SelectItem>
                      <SelectItem value="إيداع رأس مال" className="text-xs">إيداع رأس مال</SelectItem>
                      <SelectItem value="سداد سلفة موظف" className="text-xs">سداد سلفة موظف</SelectItem>
                      <SelectItem value="إيراد خدمات وصيانة" className="text-xs">إيراد خدمات وصيانة</SelectItem>
                      <SelectItem value="تسوية رصيد" className="text-xs">تسوية رصيد</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="مسحوبات شخصية" className="text-xs">مسحوبات شخصية (أرباح)</SelectItem>
                      <SelectItem value="سلفة موظف" className="text-xs">سلفة موظف</SelectItem>
                      <SelectItem value="مصاريف صيانة ونثرية" className="text-xs">مصاريف صيانة ونثرية</SelectItem>
                      <SelectItem value="مصاريف ضيافة وبوفيه" className="text-xs">مصاريف ضيافة وبوفيه</SelectItem>
                      <SelectItem value="تسوية عجز" className="text-xs">تسوية عجز</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ملاحظات إضافية</Label>
            <Input
              placeholder="أي تفاصيل أو رقم مرجعي..."
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsManualTxOpen(false);
                resetManualForm();
              }}
              className="rounded-xl text-xs"
            >
              إلغاء
            </Button>
            <Button type="submit" className="rounded-xl text-xs font-bold px-5">
              {editingTxId ? "حفظ التعديلات" : "تأكيد وحفظ الحركة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
