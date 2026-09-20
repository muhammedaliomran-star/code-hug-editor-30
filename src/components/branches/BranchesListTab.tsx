import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt, calculateBranchStockValuation } from "@/lib/store";
import { GitBranch, MapPin, Phone, User, Plus, Pencil, Trash2, Boxes, Wallet, Check, Building2 } from "lucide-react";
import { setActiveBranchId } from "@/lib/branch-system";
import { toast } from "sonner";

export default function BranchesListTab() {
  const {
    branches, stockItems, staffList, loading, cur,
    setSelectedBranchId, setActiveTab,
    setEditingBranch, setIsBranchDialogOpen, removeBranch,
  } = useBranches();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {branches.map((branch) => {
        const val = calculateBranchStockValuation(branch.id, stockItems);
        const staffCount = staffList.filter((s) => s.branchId === branch.id).length;

        return (
          <div
            key={branch.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-5 bg-card/80 transition-all shadow-sm hover:shadow-md",
              branch.isMain ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-foreground/10"
            )}
          >
            {branch.isMain && (
              <div className="absolute top-0 left-0 bg-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-br-xl uppercase tracking-wider">
                الفرع الرئيسي
              </div>
            )}

            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg",
                    branch.isMain ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"
                  )}
                >
                  <GitBranch className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{branch.name}</h3>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {branch.location || "بدون عنوان مسجل"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => {
                    setEditingBranch(branch);
                    setIsBranchDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-danger hover:bg-danger/10"
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف ${branch.name}؟`)) {
                      removeBranch(branch.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3 border-y border-[var(--hairline)] text-xs mb-4">
              <div>
                <span className="text-muted-foreground block text-[10px]">المدير المسؤول</span>
                <span className="font-semibold flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {branch.managerName || "غير محدد"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">رقم الهاتف</span>
                <span className="font-semibold flex items-center gap-1 mt-0.5" dir="ltr">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  {branch.phone || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">قيمة المخزون</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block tabular-nums">
                  {fmt(val.totalCostValue)} {cur}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">فريق العمل</span>
                <span className="font-semibold mt-0.5 block">{staffCount} موظفين</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 rounded-xl text-xs font-semibold h-8"
                onClick={() => {
                  setSelectedBranchId(branch.id);
                  setActiveTab("inventory");
                }}
              >
                <Boxes className="ml-1 h-3.5 w-3.5" />
                المخزون
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 rounded-xl text-xs font-semibold h-8"
                onClick={() => {
                  setSelectedBranchId(branch.id);
                  setActiveTab("cashbox");
                }}
              >
                <Wallet className="ml-1 h-3.5 w-3.5" />
                الخزينة
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-semibold h-8"
                onClick={() => {
                  setActiveBranchId(branch.id);
                  toast.success(`تم تفعيل العمل على "${branch.name}" في كل شاشات النظام`);
                }}
              >
                <Check className="ml-1 h-3 w-3 text-primary" />
                تعيين كنشط
              </Button>
            </div>
          </div>
        );
      })}

      {branches.length === 0 && !loading && (
        <div className="col-span-full py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-foreground/10 bg-card/40">
          <Building2 className="h-10 w-10 mx-auto opacity-30 mb-2" />
          لا توجد فروع مسجلة حتى الآن. أضف أول فرع لبدء العمل.
        </div>
      )}
    </div>
  );
}
