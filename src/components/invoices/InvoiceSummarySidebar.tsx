import { Link } from "@tanstack/react-router";
import { PauseCircle, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/shop-settings";

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-foreground/5 pb-2 last:border-0 last:pb-0">
      <span className={cn("font-extrabold text-foreground", valueClass)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export interface InvoiceSummarySidebarProps {
  itemCount: number;
  subtotal: number;
  discountValue: number;
  taxPct: string | number;
  taxValue: number;
  totalPrice: number;
  downNum: number;
  remaining: number;
  isCashMode: boolean;
  blockReason: string | null;
  parkedCount: number;
  onInstantPrint: () => void;
  onSave: () => void;
  onPark: () => void;
  onOpenParked: () => void;
}

export function InvoiceSummarySidebar({
  itemCount,
  subtotal,
  discountValue,
  taxPct,
  taxValue,
  totalPrice,
  downNum,
  remaining,
  isCashMode,
  blockReason,
  parkedCount,
  onInstantPrint,
  onSave,
  onPark,
  onOpenParked,
}: InvoiceSummarySidebarProps) {
  return (
    <div className="w-full space-y-4 text-right">
      <div className="rounded-[2rem] border border-border/30 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] font-bold",
              blockReason
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border border-border/30 bg-foreground/[0.06] text-foreground",
            )}
          >
            {blockReason ? "غير مكتملة" : "جاهزة للحفظ"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            ملخص الفاتورة
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <SummaryRow label="عدد الأصناف" value={String(itemCount)} />
          <SummaryRow label="الإجمالي قبل الخصم" value={`${fmt(subtotal)} ج.م`} />
          {discountValue > 0 && <SummaryRow label="الخصم" value={`− ${fmt(discountValue)} ج.م`} />}
          {taxValue > 0 && <SummaryRow label={`الضريبة (${Number(taxPct || 0)}%)`} value={`${fmt(taxValue)} ج.م`} />}
          <SummaryRow label="إجمالي الفاتورة" value={`${fmt(totalPrice)} ج.م`} />
          <SummaryRow label={isCashMode ? "المدفوع الآن" : "المقدم"} value={`${fmt(isCashMode ? totalPrice : downNum)} ج.م`} />
          {!isCashMode && <SummaryRow label="المتبقي للتقسيط" value={`${fmt(remaining)} ج.م`} />}
        </div>

        <div className="rounded-2xl bg-foreground/[0.06] px-4 py-4">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {isCashMode ? "المطلوب سداده" : "المقدم الآن"}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black leading-none tracking-tighter text-foreground">
              {fmt(isCashMode ? totalPrice : downNum)}
            </span>
            <span className="text-xs font-bold text-foreground">ج.م</span>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/30 p-5 space-y-3">
        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          الإجراءات
        </span>
        {blockReason && <div className="text-[11px] font-bold text-warning">{blockReason}</div>}

        <Button
          type="button"
          onClick={onInstantPrint}
          disabled={!!blockReason}
          className="h-14 w-full rounded-2xl bg-success text-success-foreground hover:bg-success/90 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-success/20 transition-all active:scale-[0.98]"
        >
          <Printer className="w-5 h-5" />
          <span>دفع فوري وطباعة إيصال (F9)</span>
        </Button>

        <Button
          onClick={onSave}
          disabled={!!blockReason}
          className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-black text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>حفظ الفاتورة (Ctrl+S)</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={onPark}
            className="h-11 rounded-2xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-bold"
          >
            <PauseCircle className="w-4 h-4 ml-1" /> تعليق (F4)
          </Button>
          <Button variant="outline" onClick={onOpenParked} className="h-11 rounded-2xl text-xs font-bold">
            المعلقة ({parkedCount})
          </Button>
        </div>

        <Button asChild variant="ghost" className="h-10 w-full rounded-2xl text-xs text-muted-foreground">
          <Link to="/invoices">إلغاء والعودة</Link>
        </Button>
      </div>
    </div>
  );
}
