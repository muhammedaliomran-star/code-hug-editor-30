import { db } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteTimelineEntry({ kind, id }: { kind: "invoice" | "payment"; id: string }) {
  const onConfirm = async () => {
    try {
      if (kind === "invoice") await db.removeInvoice(id);
      else await db.removePayment(id);
      toast.success("تم الحذف وتحديث الرصيد");
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحذف");
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-danger hover:bg-danger/10 action-btn danger"
          aria-label="حذف"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">هل أنت متأكد؟</AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            سيتم تحديث إجمالي مديونية العميل بناءً على هذا الحذف. لا يمكن التراجع.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-danger text-danger-foreground hover:bg-danger/90"
          >
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
