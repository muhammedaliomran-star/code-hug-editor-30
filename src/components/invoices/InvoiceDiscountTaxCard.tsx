import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/store";

export interface InvoiceDiscountTaxCardProps {
  subtotal: number;
  taxPct: string;
  onTaxPctChange: (v: string) => void;
  discountPct: string;
  onDiscountPctChange: (v: string) => void;
  discountAmt: string;
  onDiscountAmtChange: (v: string) => void;
  discountValue: number;
  taxValue: number;
  totalPrice: number;
}

export function InvoiceDiscountTaxCard({
  subtotal,
  taxPct,
  onTaxPctChange,
  discountPct,
  onDiscountPctChange,
  discountAmt,
  onDiscountAmtChange,
  discountValue,
  taxValue,
  totalPrice,
}: InvoiceDiscountTaxCardProps) {
  return (
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold",
                      discountValue > 0 ? "text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    − {fmt(discountValue)} ج.م
                  </span>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    الخصم
                  </Label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">بالنسبة %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={discountPct}
                      onChange={(e) => {
                        const v = e.target.value;
                        onDiscountPctChange(v);
                        const pct = Math.min(100, Math.max(0, Number(v || 0)));
                        onDiscountAmtChange(v === "" ? "" : String(Math.round((subtotal * pct) / 100)));
                      }}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">بالمبلغ (ج.م)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={discountAmt}
                      onChange={(e) => {
                        const v = e.target.value;
                        onDiscountAmtChange(v);
                        const amt = Math.max(0, Number(v || 0));
                        onDiscountPctChange(
                          v === "" || subtotal <= 0 ? "" : ((amt / subtotal) * 100).toFixed(1),
                        );
                      }}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        onDiscountPctChange(String(n));
                        onDiscountAmtChange(String(Math.round((subtotal * n) / 100)));
                      }}
                      className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
                    >
                      {n}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      onDiscountPctChange("");
                      onDiscountAmtChange("");
                    }}
                    className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground/80 hover:bg-danger/10 hover:text-danger active:scale-95"
                  >
                    مسح
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-white/5 pt-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">معدل الضريبة %</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={taxPct}
                      onChange={(e) => onTaxPctChange(e.target.value)}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{fmt(subtotal)} ج.م</span>
                      <span className="text-muted-foreground">الإجمالي قبل الخصم</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{fmt(taxValue)} ج.م</span>
                      <span className="text-muted-foreground">قيمة الضريبة</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <span className="text-base font-black text-foreground">
                        {fmt(totalPrice)} ج.م
                      </span>
                      <span className="text-muted-foreground">الإجمالي النهائي</span>
                    </div>
                  </div>
                </div>
              </div>
  );
}
