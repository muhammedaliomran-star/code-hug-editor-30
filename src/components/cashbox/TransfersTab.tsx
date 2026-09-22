import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { deleteInternalTransfer } from "@/lib/cashbox-system";
import { Plus, Trash2 } from "lucide-react";

export function TransfersTab() {
  const {
    cur,
    accounts,
    transfers,
    setIsTransferOpen,
    refreshAll,
  } = useCashbox();

  const handleDeleteTransfer = (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا التحويل واسترداد الأرصدة؟")) return;
    deleteInternalTransfer(id);
    toast.success("تم حذف سجل التحويل");
    refreshAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold">سجل التحويلات المالية الداخلية بين الخزن</h3>
          <p className="text-xs text-muted-foreground">
            نقل الأرصدة والسيولة بين الدرج، المحافظ الإلكترونية، والحسابات البنكية
          </p>
        </div>
        <Button
          onClick={() => setIsTransferOpen(true)}
          className="h-11 justify-center gap-1.5 rounded-full px-5 text-xs font-bold sm:h-9"
        >
          <Plus className="h-4 w-4" />
          إجراء تحويل مالي جديد
        </Button>
      </div>

      {/* Mobile cards (Phase 4) */}
      <div className="flex flex-col gap-2 md:hidden">
        {transfers.map((trf) => {
          const fromAcc = accounts.find((a) => a.id === trf.fromAccountId);
          const toAcc = accounts.find((a) => a.id === trf.toAccountId);
          return (
            <div key={trf.id} className="rounded-2xl border border-foreground/10 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-bold text-primary">{trf.transferNumber}</span>
                <span className="whitespace-nowrap text-sm font-black tabular-nums">
                  {fmt(trf.amount)} {cur}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed">
                من <span className="font-bold text-rose-600 dark:text-rose-400">{fromAcc?.name || "حساب محذوف"}</span>
                {" إلى "}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{toAcc?.name || "حساب محذوف"}</span>
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                  {new Date(trf.date).toLocaleDateString("ar-EG")} • {trf.fee > 0 ? `${fmt(trf.fee)} ${cur}` : "بدون عمولة"} • {trf.notes || "تحويل سيولة دوري"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl text-danger hover:bg-danger/10"
                  onClick={() => handleDeleteTransfer(trf.id)}
                  title="حذف التحويل"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {transfers.length === 0 && (
          <p className="rounded-2xl border border-foreground/10 bg-card py-12 text-center text-xs text-muted-foreground">
            لا توجد تحويلات داخلية مسجلة بعد.
          </p>
        )}
      </div>

      <div className="hidden rounded-2xl border border-foreground/10 bg-card overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                <th className="p-3.5">رقم التحويل</th>
                <th className="p-3.5">التاريخ</th>
                <th className="p-3.5">من حساب (المصدر)</th>
                <th className="p-3.5">إلى حساب (الوجهة)</th>
                <th className="p-3.5">المبلغ المحول</th>
                <th className="p-3.5">العمولة / الرسوم</th>
                <th className="p-3.5">المسؤول والملاحظات</th>
                <th className="p-3.5 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {transfers.map((trf) => {
                const fromAcc = accounts.find((a) => a.id === trf.fromAccountId);
                const toAcc = accounts.find((a) => a.id === trf.toAccountId);

                return (
                  <tr key={trf.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-primary">{trf.transferNumber}</td>
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                      {new Date(trf.date).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {fromAcc?.name || "حساب محذوف"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {toAcc?.name || "حساب محذوف"}
                      </span>
                    </td>
                    <td className="p-3.5 font-black tabular-nums text-sm">
                      {fmt(trf.amount)} {cur}
                    </td>
                    <td className="p-3.5 tabular-nums text-muted-foreground">
                      {trf.fee > 0 ? `${fmt(trf.fee)} ${cur}` : "بدون عمولة"}
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {trf.notes || "تحويل سيولة دوري"}
                    </td>
                    <td className="p-3.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-danger hover:bg-danger/10"
                        onClick={() => handleDeleteTransfer(trf.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {transfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                    لا توجد تحويلات داخلية مسجلة بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
