import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { fmt } from "@/lib/store";
import type { SalesDraft } from "@/types";
import { Loader2, Play, Trash2, FileClock } from "lucide-react";
import { toast } from "sonner";

export function SalesDraftsModal({ open, onOpenChange, onSelect }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (draft: SalesDraft) => void;
}) {
  const [drafts, setDrafts] = useState<SalesDraft[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setDrafts(await db.listSalesDrafts()); }
    catch (error: any) { toast.error(error?.message ?? "تعذر تحميل المسودات"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); }, [open]);

  const cancel = async (id: string) => {
    try {
      await db.cancelSalesDraft(id, true);
      setDrafts((current) => current.filter((draft) => draft.id !== id));
      toast.success("تم إلغاء المسودة وتحرير الكمية ورد العربون إن وجد");
    } catch (error: any) { toast.error(error?.message ?? "تعذر إلغاء المسودة"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-end gap-2">مسودات فواتير البيع <FileClock className="h-5 w-5 text-primary" /></DialogTitle>
          <DialogDescription>المسودة تحجز الكمية مؤقتًا، ولا تتحول إلى بيع أو مديونية إلا بعد الاعتماد.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : drafts.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">لا توجد مسودات محفوظة.</div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-2xl border border-border/40 bg-foreground/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => { onSelect(draft); onOpenChange(false); }}><Play className="h-3.5 w-3.5" /> استكمال</Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-danger hover:bg-danger/10" onClick={() => void cancel(draft.id)}><Trash2 className="h-3.5 w-3.5" /> إلغاء</Button>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2"><Badge variant="outline" className="font-mono text-primary">D-{String(draft.draftNumber).padStart(4, "0")}</Badge><span className="font-bold">{draft.customerId ? "مسودة عميل" : "عميل غير محدد"}</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">{draft.items.length} صنف • {fmt(draft.total)} ج.م {draft.depositTotal > 0 ? `• عربون ${fmt(draft.depositTotal)} ج.م` : ""}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
