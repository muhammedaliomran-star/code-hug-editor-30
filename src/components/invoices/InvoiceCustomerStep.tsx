import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { fmt } from "@/lib/store";
import type { Customer } from "@/types";

export interface InvoiceCustomerStepProps {
  customers: Customer[];
  customerId: string;
  onCustomerChange: (v: string) => void;
  customer?: Customer;
  customerInfo: { balance: number; limit: number; wouldExceed: boolean } | null;
  blocked: boolean;
  saleType: "cash" | "installments";
  onSaleTypeChange: (key: "cash" | "installments") => void;
  onSelectDefaultCashCustomer: () => void;
}

export function InvoiceCustomerStep({
  customers,
  customerId,
  onCustomerChange,
  customer,
  customerInfo,
  blocked,
  saleType,
  onSaleTypeChange,
  onSelectDefaultCashCustomer,
}: InvoiceCustomerStepProps) {
  return (
          {step === 1 && (
            <div className="space-y-4">
              {/* العميل */}
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onSelectDefaultCashCustomer}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    + اختيار عميل فوري سريع (F1)
                  </button>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    العميل
                  </Label>
                </div>
                <Select
                  value={customerId}
                  onValueChange={onCustomerChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العميل" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.customerType === "cash" ? "فوري" : "قسط"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {customer && customerInfo && (
                  <div className="flex flex-wrap items-center gap-2 animate-[fade-in_0.2s_ease-out]">
                    <CustomerTypeBadge type={customer.customerType} />
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 font-bold",
                        customerInfo.balance > 0
                          ? "bg-danger/10 text-danger border-danger/40"
                          : "bg-foreground/[0.06] text-foreground ring-border",
                      )}
                    >
                      مديونية حالية: {fmt(customerInfo.balance)} ج.م
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-foreground/[0.06] text-muted-foreground ring-border font-bold"
                    >
                      سقف الائتمان:{" "}
                      {customerInfo.limit > 0 ? `${fmt(customerInfo.limit)} ج.م` : "بدون حد"}
                    </Badge>
                    {customerInfo.wouldExceed && (
                      <Badge
                        variant="outline"
                        className="bg-warning/15 text-warning border-warning/40 gap-1"
                      >
                        <ShieldAlert className="w-3 h-3" /> سيتجاوز السقف الائتماني
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {blocked && (
                <div className="rounded-2xl border-2 border-danger/40 bg-danger/10 p-3 text-sm text-danger flex items-start gap-2 animate-[scale-in_0.2s_ease-out]">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    هذا العميل {customer?.frozen ? "مجمد" : "مماطل"}. النظام لا يسمح بفتح فاتورة
                    جديدة قبل تسوية حسابه.
                  </div>
                </div>
              )}

              {/* نوع الفاتورة */}
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  نوع الفاتورة
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "installments" as const, label: "أقساط", hint: "دفع على دفعات شهرية" },
                    { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل الآن" },
                  ].map((opt) => {
                    const active = saleType === opt.key;
                    const locked = opt.key === "installments" && customer?.customerType === "cash";
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={locked}
                        onClick={() => onSaleTypeChange(opt.key)}
                        aria-pressed={active}
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-2xl p-4 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          active
                            ? "bg-foreground text-background"
                            : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
                          locked && "cursor-not-allowed opacity-40 hover:bg-transparent",
                        )}
                      >
                        <span className="text-lg font-black mb-1">{opt.label}</span>
                        <span className="text-[10px] font-medium opacity-60 leading-tight">
                          {locked ? "غير متاح لعميل فوري" : opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
  );
}
