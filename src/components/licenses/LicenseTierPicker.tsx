import { Label } from "@/components/ui/label";
import { TIER_CONFIG, type LicenseTier } from "@/lib/licensing";

export interface LicenseTierPickerProps {
  selected: LicenseTier;
  onSelect: (tier: LicenseTier) => void;
}

export function LicenseTierPicker({ selected, onSelect }: LicenseTierPickerProps) {
  return (
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground">1. اختر باقة الترخيص:</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(["trial", "starter", "pro", "enterprise"] as LicenseTier[]).map((t) => (
                        <div
                          key={t}
                          onClick={() => onSelect(t)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all text-center space-y-1 ${
                            selected === t
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/5"
                          }`}
                        >
                          <div className="text-xs font-black text-foreground">{TIER_CONFIG[t].label}</div>
                          <div className="text-[10px] text-muted-foreground">{TIER_CONFIG[t].desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
  );
}
