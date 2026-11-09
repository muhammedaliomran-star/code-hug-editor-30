import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search,
  Zap,
  Layers,
  Undo2,
  Keyboard,
  Pause,
} from "lucide-react";

interface PosKeyboardHUDProps {
  onSearchFocus?: () => void;
  onInstantCheckout?: () => void;
  onSplitPayment?: () => void;
  onQuickRefund?: () => void;
  onHoldCart?: () => void;
  onRecallHeld?: () => void;
  onCustomerDisplay?: () => void;
  onClearCart?: () => void;
  onShiftManager?: () => void;
  heldCount?: number;
  cartCount?: number;
}

export function PosKeyboardHUD({
  onSearchFocus,
  onInstantCheckout,
  onSplitPayment,
  onQuickRefund,
  onHoldCart,
  onRecallHeld,
  onCustomerDisplay,
  onClearCart,
  onShiftManager,
  heldCount = 0,
  cartCount = 0,
}: PosKeyboardHUDProps) {
  const shortcuts = [
    {
      key: "F2",
      label: "بحث",
      icon: <Search className="h-3 w-3" />,
      action: onSearchFocus,
      tone: "default",
    },
    {
      key: "F3",
      label: "مرتجع",
      icon: <Undo2 className="h-3 w-3" />,
      action: onQuickRefund,
      tone: "danger",
    },
    {
      key: "F4",
      label: "بيع كاش",
      icon: <Zap className="h-3 w-3" />,
      action: onInstantCheckout,
      tone: "primary",
      disabled: cartCount === 0,
    },
    {
      key: "F6",
      label: "دفع متعدد",
      icon: <Layers className="h-3 w-3" />,
      action: onSplitPayment,
      tone: "secondary",
      disabled: cartCount === 0,
    },
    {
      key: "F8",
      label: "تعليق",
      icon: <Pause className="h-3 w-3" />,
      action: onHoldCart,
      tone: "warning",
      disabled: cartCount === 0,
    },
  ];

  return (
    <div className="hidden lg:flex items-center justify-between gap-1.5 px-3 py-1.5 bg-card/90 backdrop-blur-md border-t border-border/50 text-[11px] select-none shrink-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-muted-foreground font-bold shrink-0">
        <Keyboard className="h-3.5 w-3.5 text-primary" />
        <span>اختصارات الكاشير:</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {shortcuts.map((sc) => (
          <button
            key={sc.key}
            type="button"
            onClick={sc.action}
            disabled={sc.disabled}
            className={cn(
              "flex items-center gap-1 px-2.5 min-h-[36px] rounded-lg border transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold active:scale-[0.98]",
              sc.tone === "primary"
                ? "bg-foreground/[0.05] border-border/50 text-primary hover:bg-foreground/[0.09]"
                : sc.tone === "danger"
                ? "bg-danger/5 border-danger/20 text-danger hover:bg-danger/10"
                : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <kbd className="px-1 py-0.2 rounded bg-background border border-border/80 font-mono font-bold text-[11px] shadow-2xs">
              {sc.key}
            </kbd>
            <span className="hidden xl:inline">{sc.icon}</span>
            <span>{sc.label}</span>
          </button>
        ))}
        <span className="hidden xl:inline-flex items-center gap-1.5 mr-1 text-[10px] text-muted-foreground border-r border-border/50 pr-2">
          <button type="button" onClick={onRecallHeld} className="hover:text-foreground">
            <kbd className="font-mono font-bold">F9</kbd> معلّق{heldCount > 0 ? ` (${heldCount})` : ""}
          </button>
          <span>·</span>
          <button type="button" onClick={onCustomerDisplay} className="hover:text-foreground">
            <kbd className="font-mono font-bold">F10</kbd> شاشة العميل
          </button>
          <span>·</span>
          <button type="button" disabled={cartCount === 0} onClick={onClearCart} className="hover:text-danger disabled:opacity-40">
            <kbd className="font-mono font-bold">Esc</kbd> مسح
          </button>
        </span>
      </div>
    </div>
  );
}
