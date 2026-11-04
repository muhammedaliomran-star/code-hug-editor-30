import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { fmt } from "@/lib/store";

export interface CashPaymentPanelProps {
  totalPrice: number;
  enableSplitPayment: boolean;
  onEnableSplitPaymentChange: (v: boolean) => void;
  splitCash: string;
  onSplitCashChange: (v: string) => void;
  splitElectronic: string;
  onSplitElectronicChange: (v: string) => void;
  splitMethod: string;
  onSplitMethodChange: (v: string) => void;
  splitRef: string;
  onSplitRefChange: (v: string) => void;
  splitTotal: number;
  splitDiff: number;
  cashPaid: string;
  onCashPaidChange: (v: string) => void;
  cashPaidNum: number;
  cashShort: number;
  change: number;
}

export function CashPaymentPanel({
  totalPrice,
  enableSplitPayment,
  onEnableSplitPaymentChange,
  splitCash,
  onSplitCashChange,
  splitElectronic,
  onSplitElectronicChange,
  splitMethod,
  onSplitMethodChange,
  splitRef,
  onSplitRefChange,
  splitTotal,
  splitDiff,
  cashPaid,
  onCashPaidChange,
  cashPaidNum,
  cashShort,
  change,
}: CashPaymentPanelProps) {
  return (
                      <div className="flex items-center justify-between gap-3">
                        <Badge className="gap-1.5 border border-border/30 bg-foreground/[0.06] px-3 py-1 text-muted-foreground">
                          <Banknote className="h-3.5 w-3.5" /> بيع نقدي
                        </Badge>
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          تفاصيل السداد
                        </Label>
                      </div>

                      <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3">
                        <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground">
                          {fmt(totalPrice)} ج.م
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المطلوب دفعه الآن
                        </span>
                      </div>

                      {/* خيار الدفع المجزأ (Split Payment) */}
                      <div className="p-3.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-primary" />
                            تعدد طرق الدفع (الدفع المجزأ: كاش + إلكتروني)
                          </div>
                          <Switch
                            checked={enableSplitPayment}
                            onCheckedChange={onEnableSplitPaymentChange}
                          />
                        </div>

                        {enableSplitPayment && (
                          <div className="space-y-3 pt-2 border-t border-foreground/5 animate-[fade-in_0.2s_ease-out]">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                  <Banknote className="w-3.5 h-3.5 text-success" /> المبلغ النقدي (كاش)
                                </Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={splitCash}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    onSplitCashChange(val);
                                    const c = Number(val || 0);
                                    if (totalPrice > c) {
                                      onSplitElectronicChange(String(Math.round(totalPrice - c)));
                                    }
                                  }}
                                  className="font-bold"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                  <Smartphone className="w-3.5 h-3.5 text-primary" /> المبلغ الإلكتروني
                                </Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={splitElectronic}
                                  onChange={(e) => onSplitElectronicChange(e.target.value)}
                                  className="font-bold"
                                />
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">طريقة التحصيل الإلكتروني</Label>
                                <Select
                                  value={splitMethod}
                                  onValueChange={(v) => onSplitMethodChange(v)}
                                >
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="instapay">انستاباي (InstaPay)</SelectItem>
                                    <SelectItem value="vodafone_cash">فودافون كاش / محفظة ذكية</SelectItem>
                                    <SelectItem value="visa">فيزا / ماستركارد (POS Card)</SelectItem>
                                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs">الرقم المرجعي / هاتف المحفظة</Label>
                                <Input
                                  value={splitRef}
                                  onChange={(e) => onSplitRefChange(e.target.value)}
                                  placeholder="رقم العملية أو الهاتف..."
                                  className="h-10 text-xs"
                                />
                              </div>
                            </div>

                            <div className={cn(
                              "p-2 rounded-xl text-xs font-bold flex items-center justify-between",
                              splitDiff < 0.01 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                            )}>
                              <span>مجموع الدفع: {fmt(splitTotal)} ج.م</span>
                              <span>{splitDiff < 0.01 ? "المبلغ متطابق تماماً ✓" : `فرق: ${fmt(splitDiff)} ج.م`}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!enableSplitPayment && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            المبلغ المستلم من العميل (ج.م)
                          </Label>
                          <Input
                            type="number"
                            value={cashPaid}
                            onChange={(e) => onCashPaidChange(e.target.value)}
                            placeholder={`${totalPrice || 0}`}
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {[totalPrice, 50, 100, 200, 500]
                              .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                              .map((v, i) => (
                                <button
                                  key={`${v}-${i}`}
                                  type="button"
                                  onClick={() =>
                                    onCashPaidChange(String(i === 0 ? v : Number(cashPaid || 0) + v))
                                  }
                                  className="rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground active:scale-[0.96]"
                                >
                                  {i === 0 ? "المبلغ بالظبط" : `+ ${fmt(v)}`}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {!enableSplitPayment && cashPaidNum > 0 && (
                        <div
                          className={cn(
                            "flex items-baseline justify-between gap-3 rounded-2xl px-4 py-3",
                            cashShort > 0 ? "bg-warning/10" : "bg-success/10",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold leading-none tracking-tight",
                              cashShort > 0 ? "text-warning" : "text-success",
                            )}
                          >
                            {fmt(cashShort > 0 ? cashShort : change)} ج.م
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            {cashShort > 0 ? "ناقص من المبلغ" : "الفكّة للعميل"}
                          </span>
                        </div>
                      )}
  );
}
