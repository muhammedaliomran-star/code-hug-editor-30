import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "warning";
};

type ConfirmContextValue = { confirm: (options: ConfirmOptions) => Promise<boolean> };
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setRequest({ options, resolve });
  }), []);

  const finish = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };
  const tone = request?.options.tone ?? "primary";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={!!request} onOpenChange={(open) => { if (!open) finish(false); }}>
        <AlertDialogContent dir="rtl" className="rounded-[1.75rem] border-border/40 bg-card/95 p-6 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="mb-2 flex items-center gap-3 text-right">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", tone === "danger" ? "bg-danger/10 text-danger" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                <AlertTriangle className="h-5 w-5" />
              </span>
              <AlertDialogTitle className="text-right">{request?.options.title ?? "تأكيد العملية"}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-right leading-7">{request?.options.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse">
            <AlertDialogCancel onClick={() => finish(false)}>{request?.options.cancelLabel ?? "إلغاء"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => finish(true)} className={cn(tone === "danger" ? "bg-danger text-danger-foreground hover:bg-danger/90" : tone === "warning" ? "bg-warning text-warning-foreground hover:bg-warning/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {request?.options.confirmLabel ?? "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error("useConfirm must be used inside ConfirmDialogProvider");
  return value.confirm;
}
