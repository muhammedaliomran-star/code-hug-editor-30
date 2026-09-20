import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt, calculateBranchStockValuation, getProductStockInBranch } from "@/lib/store";
import { setBranchStockAbsolute } from "@/lib/branch-system";
import { toast } from "sonner";
import { Search, ArrowLeftRight, AlertTriangle } from "lucide-react";

export default function InventoryTab() {
  const {
    activeBranch, stockItems, cur,
    stockSearch, setStockSearch,
    stockFilterLow, setStockFilterLow,
    setIsCreateTransferOpen, setTransferFrom, refreshBranchData,
  } = useBranches();

  return (
    <div className="space-y-6">
      {activeBranch && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl border border-foreground/10 bg-gradient-to-r from-primary/5 via-card to-card">
          {(() => {
            const valuation = calculateBranchStockValuation(activeBranch.id, stockItems);
            return (
              <>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">إجمالي أصناف الفرع</span>
                  <span className="text-xl sm:text-2xl font-black tabular-nums">{valuation.totalItemsCount} صنف</span>
                  <span className="text-[10px] text-muted-foreground block">({valuation.totalUnitsCount} وحدة إجمالية)</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">قيمة المخزون (سعر التكلفة)</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmt(valuation.totalCostValue)} {cur}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">القيمة البيعية المتوقعة</span>
                  <span className="text-xl sm:text-2xl font-black text-primary tabular-nums">
                    {fmt(valuation.totalRetailValue)} {cur}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                    (أرباح متوقعة: {fmt(valuation.potentialProfit)} {cur})
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">أصناف شارفت على النفاد</span>
                  <span className={cn("text-xl sm:text-2xl font-black tabular-nums", valuation.lowStockItemsCount > 0 ? "text-danger" : "text-emerald-500")}>
                    {valuation.lowStockItemsCount} صنف
                  </span>
                  {valuation.lowStockItemsCount > 0 && (
                    <span className="text-[10px] text-danger font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> يحتاج لطلب تحويل
                    </span>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث باسم المنتج أو الباركود..."
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
            className="h-10 pr-10 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="low-stock-filter"
              checked={stockFilterLow}
              onCheckedChange={setStockFilterLow}
            />
            <Label htmlFor="low-stock-filter" className="text-xs font-semibold cursor-pointer">
              إظهار النواقص والحد الأدنى فقط
            </Label>
          </div>

          <Button
            onClick={() => {
              setTransferFrom(activeBranch ? activeBranch.id : "");
              setIsCreateTransferOpen(true);
            }}
            className="rounded-full h-9 px-4 text-xs font-bold shadow-sm"
          >
            <ArrowLeftRight className="ml-1.5 h-3.5 w-3.5" />
            طلب تحويل مخزون
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                <th className="p-3.5">المنتج والباركود</th>
                <th className="p-3.5 text-center">الرصيد بهذا الفرع</th>
                <th className="p-3.5 text-center">الحد الأدنى للفرع</th>
                <th className="p-3.5 text-center">إجمالي رصيد الشركة</th>
                <th className="p-3.5">سعر التكلفة</th>
                <th className="p-3.5">سعر البيع</th>
                <th className="p-3.5 text-center">الحالة</th>
                <th className="p-3.5 text-left">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {stockItems
                .filter((item) => {
                  const q = stockSearch.toLowerCase().trim();
                  const matchesQ = !q || item.name.toLowerCase().includes(q) || (item.barcode && item.barcode.includes(q));
                  if (!matchesQ) return false;

                  if (stockFilterLow && activeBranch) {
                    const stock = getProductStockInBranch(activeBranch.id, item.id, item.quantity);
                    return stock.quantity <= stock.minStock;
                  }
                  return true;
                })
                .map((item) => {
                  const branchStock = activeBranch
                    ? getProductStockInBranch(activeBranch.id, item.id, item.quantity)
                    : { quantity: item.quantity, minStock: item.minStock || 3 };

                  const isLow = branchStock.quantity <= branchStock.minStock;

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-sm">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {item.barcode || "بدون باركود"}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={cn("text-base font-black tabular-nums", isLow ? "text-danger" : "text-foreground")}>
                          {branchStock.quantity}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-bold tabular-nums text-muted-foreground">
                        {branchStock.minStock} قطع
                      </td>
                      <td className="p-3.5 text-center font-semibold tabular-nums text-muted-foreground">
                        {item.quantity}
                      </td>
                      <td className="p-3.5 tabular-nums">{fmt(item.lastUnitCost)} {cur}</td>
                      <td className="p-3.5 tabular-nums font-bold text-primary">{fmt(item.salePrice)} {cur}</td>
                      <td className="p-3.5 text-center">
                        {branchStock.quantity === 0 ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            منتهي تماماً
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 text-amber-600 bg-amber-500/10">
                            شارف على النفاد
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                            متوفر بكفاءة
                          </Badge>
                        )}
                      </td>
                      <td className="p-3.5 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] rounded-lg px-2.5"
                            onClick={() => {
                              const newQtyStr = prompt(`تعديل الكمية لمنتج "${item.name}" بالفرع الحالي:`, String(branchStock.quantity));
                              if (newQtyStr !== null) {
                                const newQty = parseInt(newQtyStr, 10);
                                if (!isNaN(newQty) && newQty >= 0 && activeBranch) {
                                  setBranchStockAbsolute(activeBranch.id, item.id, newQty);
                                  toast.success("تم تحديث الرصيد بالفرع بنجاح");
                                  refreshBranchData();
                                }
                              }
                            }}
                          >
                            تعديل الرصيد
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[11px] rounded-lg px-2.5"
                            onClick={() => {
                              const minStr = prompt(`تعيين الحد الأدنى للتنبيه لـ "${item.name}":`, String(branchStock.minStock));
                              if (minStr !== null) {
                                const minVal = parseInt(minStr, 10);
                                if (!isNaN(minVal) && minVal >= 0 && activeBranch) {
                                  setBranchStockAbsolute(activeBranch.id, item.id, branchStock.quantity, minVal);
                                  toast.success("تم تعيين الحد الأدنى للتنبيه");
                                  refreshBranchData();
                                }
                              }
                            }}
                          >
                            حد التنبيه
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
