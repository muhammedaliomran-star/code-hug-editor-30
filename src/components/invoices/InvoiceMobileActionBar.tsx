import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/shop-settings";

export interface InvoiceMobileActionBarProps {
  step: number;
  blockReason: string | null;
  totalPrice: number;
  onNext: () => void;
  onInstantPrint: () => void;
}

export function InvoiceMobileActionBar({
  step,
  blockReason,
  totalPrice,
  onNext,
  onInstantPrint,
}: InvoiceMobileActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-3">
        <Button
          onClick={onNext}
          disabled={step === 4 && !!blockReason}
          className="h-12 flex-1 rounded-2xl font-black"
        >
          {step < 4 ? "التالي" : "حفظ الفاتورة"}
        </Button>
        <Button
          onClick={onInstantPrint}
          disabled={!!blockReason}
          className="h-12 px-3 rounded-2xl bg-success text-success-foreground font-black"
          title="دفع وطباعة"
        >
          <Printer className="w-5 h-5" />
        </Button>
        <div className="text-right">
          <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            الإجمالي
          </span>
          <span className="text-lg font-black leading-none text-foreground">
            {fmt(totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}
