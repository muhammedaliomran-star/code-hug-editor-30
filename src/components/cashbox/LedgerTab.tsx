import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCashbox } from "./context";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import { deleteManualTransaction } from "@/lib/cashbox-system";
import {
  Search,
  Filter,
  Printer,
  Trash2,
  Pencil,
  Calendar,
} from "lucide-react";

export function LedgerTab() {
  const {
    cur,
    accounts,
    filteredLedger,
    searchQuery,
    setSearchQuery,
    dateRangeFilter,
    setDateRangeFilter,
    typeFilter,
    setTypeFilter,
    openEditManualTx,
    handlePrintStatement,
    refreshAll,
  } = useCashbox();

  return (
    <div className="space-y-4">
      {/* Controls and filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-foreground/10">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث في الحركات أو البيان أو المبلغ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pr-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          <Select value={dateRangeFilter} onValueChange={(v: any) => setDateRangeFilter(v)}>
            <SelectTrigger className="h-9 w-32 rounded-xl text-xs font-semibold">
              <Calendar className="h-3.5 w-3.5 ml-1 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs">اليوم</SelectItem>
              <SelectItem value="week" className="text-xs">آخر 7 أيام</SelectItem>
              <SelectItem value="month" className="text-xs">آخر 30 يوماً</SelectItem>
              <SelectItem value="all" className="text-xs">كافة الحركات</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="h-9 w-32 rounded-xl text-xs font-semibold">
              <Filter className="h-3.5 w-3.5 ml-1 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كافة الأنواع</SelectItem>
              <SelectItem value="in" className="text-xs text-emerald-600">وارد (مقبوضات)</SelectItem>
              <SelectItem value="out" className="text-xs text-rose-600">منصرف (مدفوعات)</SelectItem>
              <SelectItem value="transfer" className="text-xs text-amber-600">تحويلات خزن</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintStatement}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            تصدير PDF
          </Button>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
                <th className="p-3.5 w-24">التاريخ والوقت</th>
                <th className="p-3.5">البيان / المعاملة</th>
                <th className="p-3.5">التصنيف والمصدر</th>
                <th className="p-3.5">الحساب / الخزينة</th>
                <th className="p-3.5 text-left">المبلغ</th>
                <th className="p-3.5 text-left">الرصيد التراكمي</th>
                <th className="p-3.5 text-center w-16">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {filteredLedger.map((tx) => {
                const isPositive = tx.type === "in";
                const acc = accounts.find((a) => a.id === tx.accountId);

                return (
                  <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-foreground">{tx.title}</div>
                      {tx.referenceId && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          #{tx.referenceId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold",
                          isPositive
                            ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/10"
                            : "border-rose-500/20 text-rose-600 bg-rose-500/10"
                        )}
                      >
                        {tx.category}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-[11px] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {acc?.name || "الدرج الرئيسي"}
                      </span>
                    </td>
                    <td className="p-3.5 text-left whitespace-nowrap">
                      <span
                        className={cn(
                          "text-sm font-black tabular-nums",
                          isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {isPositive ? "+" : "-"}{fmt(tx.amount)} {cur}
                      </span>
                    </td>
                    <td className="p-3.5 text-left whitespace-nowrap font-bold font-mono text-foreground">
                      {fmt(tx.runningBalance || 0)} {cur}
                    </td>
                    <td className="p-3.5 text-center">
                      {tx.source === "manual" && (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10"
                            onClick={() => openEditManualTx(tx.id.replace("man-", ""))}
                            title="تعديل الحركة اليدوية"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-danger hover:bg-danger/10"
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذه الحركة اليدوية؟")) {
                                const rawId = tx.id.replace("man-", "");
                                deleteManualTransaction(rawId);
                                toast.success("تم حذف المعاملة اليدوية");
                                refreshAll();
                              }
                            }}
                            title="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                    لا توجد حركات مسجلة تطابق محددات البحث الحالية.
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
