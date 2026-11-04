import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, History } from "lucide-react";
import {
  fetchStockHistory,
  fmt,
  type StockHistoryEntry,
  type StockItem,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export function HistoryDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    fetchStockHistory(item.id, item.name)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل حركة المنتج
          </DialogTitle>
          <DialogDescription className="text-right">
            {item?.name} — كل زيادة (شراء) ونقص (بيع/تعديل).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 -mx-2 px-2">
          {loading && (
            <div className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</div>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              لا يوجد حركة مسجلة لهذا المنتج.
            </div>
          )}
          {entries.map((e) => {
            const positive = e.qty > 0;
            const cls =
              e.type === "purchase"
                ? "border-success/30 bg-success/5"
                : e.type === "sale"
                  ? "border-primary/30 bg-primary/5"
                  : positive
                    ? "border-success/30 bg-success/5"
                    : "border-warning/30 bg-warning/5";
            const Icon = positive ? ArrowUp : ArrowDown;
            const iconCls = positive
              ? "text-success"
              : e.type === "sale"
                ? "text-primary"
                : "text-warning";
            const label = e.type === "purchase" ? "شراء" : e.type === "sale" ? "بيع" : "تعديل";
            return (
              <div
                key={e.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border-2 p-3",
                  cls,
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn("w-5 h-5 shrink-0", iconCls)} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {label}
                      {e.reason && (
                        <span className="text-xs font-normal text-muted-foreground">
                          — {e.reason}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {new Date(e.date).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                      {e.notes ? ` • ${e.notes}` : e.ref ? ` • ${e.ref}` : ""}
                    </div>
                  </div>
                </div>
                <div className={cn("font-extrabold tabular-nums shrink-0", iconCls)}>
                  {positive ? "+" : ""}
                  {fmt(e.qty)}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
