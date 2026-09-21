import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorScreen({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger mb-4">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <p className="text-sm font-bold text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
