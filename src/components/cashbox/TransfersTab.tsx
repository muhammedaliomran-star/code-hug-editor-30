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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">سجل التحويلات المالية الداخلية بين الخزن</h3>
          <p className="text-xs text-muted-foreground">
            نقل الأرصدة والسيولة بين الدرج، المحافظ الإلكترونية، والحسابات البنكية
          </p>
        </div>
        <Button
          onClick={() => setIsTransferOpen(true)}
          className="rounded-full px-5 text-xs font-bold gap-1.5 h-9"
        >
          <Plus className="h-4 w-4" />
          إجراء تحويل مالي جديد
        </Button>
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
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
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا التحويل واسترداد الأرصدة؟")) {
                            deleteInternalTransfer(trf.id);
                            toast.success("تم حذف سجل التحويل");
                            refreshAll();
                          }
                        }}
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
