import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fmt } from "@/lib/store";

export interface PosHeldInvoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heldList: any[];
  heldCount: number;
  onRestore: (held: any) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function PosHeldInvoicesDialog({
  open, onOpenChange, heldList, heldCount, onRestore, onRemove, onClearAll,
}: PosHeldInvoicesDialogProps) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-warning" />
              الفواتير المعلقة ({heldCount})
            </DialogTitle>
            <DialogDescription className="text-xs">
              قائمة بسلات المشتريات المعلقة مؤقتاً. يمكنك استرجاع أي سلة لإكمال البيع.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-2 py-2 custom-scrollbar">
            {heldList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <PauseCircle className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p>لا توجد أي فواتير معلقة حالياً.</p>
              </div>
            ) : (
              heldList.map((held) => (
                <div
                  key={held.id}
                  className="p-3 rounded-2xl border border-border/50 bg-background flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground flex items-center gap-2">
                      <span>{held.customerName || "عميل نقدي"}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {format(new Date(held.createdAt), "HH:mm - dd/MM")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {held.items.length} أصناف • إجمالي: <b className="text-primary font-mono">{fmt(held.total)} ج.م</b>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onRestore(held)}
                      className="rounded-xl font-bold h-10 text-xs bg-primary text-primary-foreground gap-1.5 px-3"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>استرجاع</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(held.id)}
                      className="h-10 w-10 rounded-xl text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {heldList.length > 0 && (
            <DialogFooter className="justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="text-xs text-danger hover:bg-danger/10"
              >
                مسح كل المعلق
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs"
              >
                إغلاق
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
  );
}
