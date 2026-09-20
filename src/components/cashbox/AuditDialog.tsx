import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";

export function AuditDialog() {
  const {
    cur,
    accounts,
    isAuditModalOpen,
    setIsAuditModalOpen,
    auditAccountId,
    setAuditAccountId,
    auditCashier,
    setAuditCashier,
    denoms,
    setDenoms,
    auditVarianceReason,
    setAuditVarianceReason,
    currentAuditTotal,
    currentExpectedCash,
    currentVariance,
    handleSaveAudit,
  } = useCashbox();

  return (
    <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
      <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-500" />
            حاسبة جرد الفئات النقدية ومطابقة الدرج
          </DialogTitle>
          <DialogDescription className="text-xs">
            أدخل عدد الورقات النقدية من كل فئة لاحتساب المجموع ومقارنته برصيد السيستم
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الخزينة المجرودة</Label>
              <Select value={auditAccountId} onValueChange={setAuditAccountId}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">أمين الخزينة / المسؤول</Label>
              <Input
                value={auditCashier}
                onChange={(e) => setAuditCashier(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Denomination Grid */}
          <div className="rounded-2xl border border-foreground/10 bg-muted/30 p-3.5 space-y-2.5">
            <span className="text-xs font-bold text-muted-foreground block mb-1">
              الفئات النقدية (العد الفعلي):
            </span>

            {[
              { key: "d200", label: "فئة 200 جنيه", val: 200 },
              { key: "d100", label: "فئة 100 جنيه", val: 100 },
              { key: "d50", label: "فئة 50 جنيه", val: 50 },
              { key: "d20", label: "فئة 20 جنيه", val: 20 },
              { key: "d10", label: "فئة 10 جنيهات", val: 10 },
              { key: "d5", label: "فئة 5 جنيهات", val: 5 },
            ].map((row) => {
              const count = (denoms as any)[row.key] || 0;
              const subtotal = count * row.val;
              return (
                <div key={row.key} className="flex items-center justify-between gap-3 text-xs bg-card p-2 rounded-xl border border-foreground/5">
                  <span className="font-bold w-28">{row.label}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0 ورقة"
                      value={count || ""}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        setDenoms((prev) => ({ ...prev, [row.key]: v }));
                      }}
                      className="h-8 rounded-lg text-xs font-bold text-center w-24"
                    />
                    <span className="text-[11px] text-muted-foreground">ورقة</span>
                  </div>
                  <span className="font-black tabular-nums text-foreground w-24 text-left">
                    = {fmt(subtotal)} {cur}
                  </span>
                </div>
              );
            })}

            {/* Coins */}
            <div className="flex items-center justify-between gap-3 text-xs bg-card p-2 rounded-xl border border-foreground/5">
              <span className="font-bold w-28">فكة ونقود معدنية</span>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={denoms.coins || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setDenoms((prev) => ({ ...prev, coins: v }));
                  }}
                  className="h-8 rounded-lg text-xs font-bold text-center w-24"
                />
                <span className="text-[11px] text-muted-foreground">{cur}</span>
              </div>
              <span className="font-black tabular-nums text-foreground w-24 text-left">
                = {fmt(denoms.coins || 0)} {cur}
              </span>
            </div>
          </div>

          {/* Audit Comparison Summary */}
          <div className="p-4 rounded-2xl border border-foreground/10 bg-card space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-muted/40">
                <span className="text-[10px] text-muted-foreground block">المجموع الفعلي</span>
                <span className="font-black text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fmt(currentAuditTotal)} {cur}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-muted/40">
                <span className="text-[10px] text-muted-foreground block">رصيد النظام</span>
                <span className="font-black text-base text-foreground tabular-nums">
                  {fmt(currentExpectedCash)} {cur}
                </span>
              </div>
              <div
                className={cn(
                  "p-2 rounded-xl border",
                  currentVariance === 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                    : currentVariance > 0
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-600"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-600"
                )}
              >
                <span className="text-[10px] block opacity-80">الفارق (عجز / زيادة)</span>
                <span className="font-black text-base tabular-nums">
                  {currentVariance > 0 ? "+" : ""}{fmt(currentVariance)} {cur}
                </span>
              </div>
            </div>

            {currentVariance !== 0 && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-danger">سبب الفارق المالي / التوضيح</Label>
                <Input
                  placeholder="مثال: فكة ناقصة، أو لم تسجل مصروفات صيانة..."
                  value={auditVarianceReason}
                  onChange={(e) => setAuditVarianceReason(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAuditModalOpen(false)} className="rounded-xl text-xs">
              إلغاء
            </Button>
            <Button type="button" onClick={handleSaveAudit} className="rounded-xl text-xs font-bold px-5 bg-emerald-600 hover:bg-emerald-700 text-white">
              اعتماد وحفظ محضر الجرد
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
