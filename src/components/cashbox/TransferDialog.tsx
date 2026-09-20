import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";

export function TransferDialog() {
  const {
    cur,
    accounts,
    accountBalances,
    isTransferOpen,
    setIsTransferOpen,
    transferFrom,
    setTransferFrom,
    transferTo,
    setTransferTo,
    transferAmount,
    setTransferAmount,
    transferFee,
    setTransferFee,
    transferNotes,
    setTransferNotes,
    handleCreateTransfer,
  } = useCashbox();

  return (
    <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">تحويل مالي بين الخزن والحسابات</DialogTitle>
          <DialogDescription className="text-xs">
            نقل السيولة بين الدرج الكاش والمحافظ الإلكترونية والحسابات البنكية
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateTransfer} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">من حساب (المصدر)</Label>
              <Select value={transferFrom} onValueChange={setTransferFrom}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-rose-500/20 text-rose-600">
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">إلى حساب (الوجهة)</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-emerald-500/20 text-emerald-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">المبلغ المراد تحويله ({cur}) *</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="h-9 rounded-xl text-xs font-black"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">عمولة / رسوم التحويل ({cur})</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={transferFee}
                onChange={(e) => setTransferFee(e.target.value)}
                className="h-9 rounded-xl text-xs text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">بيان وملاحظات التحويل</Label>
            <Input
              placeholder="مثال: تغذية حساب فودافون كاش للسحب"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)} className="rounded-xl text-xs">
              إلغاء
            </Button>
            <Button type="submit" className="rounded-xl text-xs font-bold px-5 bg-amber-600 hover:bg-amber-700 text-white">
              تنفيذ التحويل المالي
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
