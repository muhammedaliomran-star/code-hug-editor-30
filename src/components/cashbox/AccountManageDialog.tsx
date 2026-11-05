import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCashbox } from "./context";

export function AccountManageDialog() {
  const {
    cur,
    isAccountManageOpen,
    setIsAccountManageOpen,
    newAccName,
    setNewAccName,
    newAccType,
    setNewAccType,
    newAccInitial,
    setNewAccInitial,
    newAccNumber,
    setNewAccNumber,
    newAccBank,
    setNewAccBank,
    handleCreateAccount,
  } = useCashbox();

  return (
    <Dialog open={isAccountManageOpen} onOpenChange={setIsAccountManageOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">إضافة قناة / خزينة مالية جديدة</DialogTitle>
          <DialogDescription className="text-xs">
            إضافة حساب بنكي، محفظة إلكترونية (Vodafone / InstaPay)، أو عهدة جديدة
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateAccount} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">اسم الحساب / الخزينة *</Label>
            <Input
              placeholder="مثال: محفظة أورانج كاش، أو بنك CIB"
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              className="h-9 rounded-xl text-xs font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نوع الحساب</Label>
              <Select value={newAccType} onValueChange={(v: any) => setNewAccType(v)}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash" className="text-xs">خزينة نقدية (درج)</SelectItem>
                  <SelectItem value="ewallet" className="text-xs">محفظة إلكترونية</SelectItem>
                  <SelectItem value="bank" className="text-xs">حساب بنكي</SelectItem>
                  <SelectItem value="pos" className="text-xs">ماكينة POS / فيزا</SelectItem>
                  <SelectItem value="petty" className="text-xs">عهدة فرعية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الرصيد الافتتاحي ({cur})</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={newAccInitial}
                onChange={(e) => setNewAccInitial(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رقم الحساب / الهاتف</Label>
              <Input
                placeholder="010XXXXXXXX"
                value={newAccNumber}
                onChange={(e) => setNewAccNumber(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">اسم البنك / الخدمة</Label>
              <Input
                placeholder="مثال: فودافون كاش"
                value={newAccBank}
                onChange={(e) => setNewAccBank(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => setIsAccountManageOpen(false)} className="rounded-xl text-xs">
              إلغاء
            </Button>
            <Button type="submit" className="rounded-xl text-xs font-bold px-5">
              حفظ وإضافة الحساب
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
