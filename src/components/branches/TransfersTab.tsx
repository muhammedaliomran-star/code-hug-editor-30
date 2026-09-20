import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/store";
import { printBranchTransferNote } from "@/lib/branch-system";
import { Plus, ArrowLeftRight, Truck, Send, CheckCircle2, Printer } from "lucide-react";

export default function TransfersTab() {
  const {
    transfers, branches, cur, shopSettings,
    setIsCreateTransferOpen,
    handleDispatch, handleOpenReceive, handleCancelTransfer,
  } = useBranches();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold">أوامر تحويل ونقل البضائع بين الفروع</h3>
          <p className="text-xs text-muted-foreground">
            دورة نقل متكاملة: إعداد المسودة ➔ خصم وشحن (In Transit) ➔ استلام وفحص التوالف (Received)
          </p>
        </div>
        <Button
          onClick={() => setIsCreateTransferOpen(true)}
          className="rounded-full px-5 h-10 font-bold text-xs shadow-sm"
        >
          <Plus className="ml-1.5 h-4 w-4" />
          إنشاء أمر تحويل جديد
        </Button>
      </div>

      <div className="space-y-3">
        {transfers.map((trf) => {
          const fromBranch = branches.find((b) => b.id === trf.fromBranchId);
          const toBranch = branches.find((b) => b.id === trf.toBranchId);
          const totalUnits = trf.items.reduce((s, i) => s + i.sentQty, 0);
          const totalCost = trf.items.reduce((s, i) => s + i.sentQty * i.unitCost, 0);

          const statusConfig = {
            draft: { label: "مسودة", color: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
            in_transit: { label: "قيد النقل والشحن", color: "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse" },
            received: { label: "تم الاستلام بنجاح", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
            cancelled: { label: "ملغي", color: "bg-red-500/10 text-red-600 border-red-500/30" },
          }[trf.status];

          return (
            <div
              key={trf.id}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border border-foreground/10 bg-card hover:border-foreground/20 transition-all shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{trf.transferNumber}</span>
                    <Badge variant="outline" className={cn("text-[10px] font-bold", statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(trf.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs mt-1.5 flex-wrap">
                    <span className="font-semibold text-foreground">
                      من: <span className="text-primary">{fromBranch?.name || "فرع محذوف"}</span>
                    </span>
                    <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      إلى: <span className="text-emerald-600 dark:text-emerald-400">{toBranch?.name || "فرع محذوف"}</span>
                    </span>
                    <span className="text-muted-foreground">| {trf.items.length} أصناف ({totalUnits} قطعة)</span>
                    <span className="font-bold text-foreground">| القيمة: {fmt(totalCost)} {cur}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[var(--hairline)]">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-xs"
                  onClick={() => printBranchTransferNote(trf, fromBranch, toBranch, shopSettings)}
                >
                  <Printer className="ml-1 h-3.5 w-3.5" />
                  إذن النقل (PDF)
                </Button>

                {trf.status === "draft" && (
                  <Button
                    size="sm"
                    className="h-8 rounded-xl text-xs bg-amber-600 hover:bg-amber-700 font-bold"
                    onClick={() => handleDispatch(trf.id)}
                  >
                    <Send className="ml-1 h-3.5 w-3.5" />
                    شحن البضاعة
                  </Button>
                )}

                {trf.status === "in_transit" && (
                  <Button
                    size="sm"
                    className="h-8 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 font-bold"
                    onClick={() => handleOpenReceive(trf)}
                  >
                    <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
                    تأكيد الاستلام والفحص
                  </Button>
                )}

                {(trf.status === "draft" || trf.status === "in_transit") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-xl text-xs text-danger hover:bg-danger/10"
                    onClick={() => handleCancelTransfer(trf.id)}
                  >
                    إلغاء
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {transfers.length === 0 && (
          <div className="py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/40">
            <ArrowLeftRight className="h-10 w-10 mx-auto opacity-30 mb-2" />
            لا توجد أوامر تحويل مسجلة حالياً.
          </div>
        )}
      </div>
    </div>
  );
}
