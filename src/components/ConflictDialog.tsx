import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { ConflictInfo, ConflictResolution } from "@/lib/conflict";

interface ConflictDialogProps {
  conflict: ConflictInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: ConflictResolution) => void;
}

const ARABIC_LABELS: Record<string, string> = {
  customers: "العميل",
  invoices: "الفاتورة",
  payments: "الدفعة",
  expenses: "المصروف",
  suppliers: "المورد",
  purchases: "الفاتورة",
  stock_items: "صنف المخزون",
  shipments: "الشحنة",
  branches: "الفرع",
  payment_vouchers: "السند",
  shipping_carriers: "شركة الشحن",
  shipping_zones: "منطقة الشحن",
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("ar-EG");
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

export function ConflictDialog({ conflict, open, onOpenChange, onResolve }: ConflictDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!conflict) return null;

  const tableName = ARABIC_LABELS[conflict.table] ?? conflict.table;
  const changedFields = Object.keys(conflict.localData).filter(
    (key) => key !== "id" && key !== "updated_at" && conflict.localData[key] !== undefined
  );

  const handleResolve = async (useServer: boolean) => {
    setLoading(true);
    onResolve({ useServer });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            تضارب في البيانات
          </DialogTitle>
          <DialogDescription>
            السجل ده (<strong>{tableName}</strong>) اتعدّل من جهاز تاني في نفس الوقت.
            اختار إيه اللي تحبه تحفظه.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border p-3">
            <p className="mb-2 font-bold text-primary">تغييراتك (الأقدم):</p>
            {changedFields.slice(0, 5).map((key) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key}</span>
                <span>{formatValue(key, conflict.localData[key])}</span>
              </div>
            ))}
            {changedFields.length > 5 && (
              <p className="mt-1 text-xs text-muted-foreground">+{changedFields.length - 5} حقول تانية</p>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 font-bold text-emerald-600">البيانات الأحدث (السيرفر):</p>
            {changedFields.slice(0, 5).map((key) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key}</span>
                <span>{formatValue(key, conflict.serverData[key])}</span>
              </div>
            ))}
            {changedFields.length > 5 && (
              <p className="mt-1 text-xs text-muted-foreground">+{changedFields.length - 5} حقول تانية</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => void handleResolve(true)}
            disabled={loading}
          >
            خذ بيانات السيرفر (الأحدث)
          </Button>
          <Button
            onClick={() => void handleResolve(false)}
            disabled={loading}
            className="bg-primary"
          >
            احتفظ بتغييراتي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
