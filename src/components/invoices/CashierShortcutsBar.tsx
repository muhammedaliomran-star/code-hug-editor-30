import { Lightbulb } from "lucide-react";

export interface CashierShortcutsBarProps {
  onSelectDefaultCashCustomer: () => void;
}

export function CashierShortcutsBar({ onSelectDefaultCashCustomer }: CashierShortcutsBarProps) {
  return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-foreground/[0.03] border border-foreground/5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-foreground flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-primary" /> اختصارات الكاشير:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F1 عميل فوري
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F2 تركيز الباركود
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F4 تعليق الفاتورة
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F8 استرجاع المعلقة
          </span>
          <span className="px-2 py-0.5 rounded-md bg-success/20 text-success border border-success/30 font-mono font-bold">
            F9 بيع وطباعة سريعة
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSelectDefaultCashCustomer}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            اختيار عميل فوري سريع
          </button>
        </div>
      </div>
  );
}
