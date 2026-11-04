import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface LicenseInstallmentFieldsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  deposit: number;
  onDepositChange: (value: number) => void;
  count: number;
  onCountChange: (value: number) => void;
  monthly: number;
  onMonthlyChange: (value: number) => void;
}

export function LicenseInstallmentFields({
  enabled,
  onEnabledChange,
  deposit,
  onDepositChange,
  count,
  onCountChange,
  monthly,
  onMonthlyChange,
}: LicenseInstallmentFieldsProps) {
  return (
                  <div className="space-y-3 py-1 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-foreground">تفعيل خطة سداد بالأقساط</Label>
                        <p className="text-[10px] text-muted-foreground">
                          تسجيل دفعة مقدمة وجدولة المتبقي على أقساط شهرية
                        </p>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={onEnabledChange}
                      />
                    </div>

                    {enabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">الدفعة المقدمة (ج.م)</Label>
                          <Input
                            type="number"
                            value={deposit}
                            onChange={(e) => onDepositChange(Number(e.target.value))}
                            className="h-9 text-xs rounded-xl mt-1 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">عدد الأقساط</Label>
                          <Input
                            type="number"
                            value={count}
                            onChange={(e) => onCountChange(Number(e.target.value))}
                            className="h-9 text-xs rounded-xl mt-1 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">قيمة القسط الشهري (ج.م)</Label>
                          <Input
                            type="number"
                            value={monthly}
                            onChange={(e) => onMonthlyChange(Number(e.target.value))}
                            className="h-9 text-xs rounded-xl mt-1 bg-background"
                          />
                        </div>
                      </div>
                    )}
                  </div>
  );
}
