import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export interface ShippingAddZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editZone: boolean;
  name: string;
  onNameChange: (v: string) => void;
  carrierId: string;
  onCarrierIdChange: (v: string) => void;
  carriers: any[];
  cost: string;
  onCostChange: (v: string) => void;
  days: string;
  onDaysChange: (v: string) => void;
  onSave: () => void;
}

export function ShippingAddZoneDialog({
  open, onOpenChange, editZone, name, onNameChange, carrierId, onCarrierIdChange,
  carriers, cost, onCostChange, days, onDaysChange, onSave,
}: ShippingAddZoneDialogProps) {
  return (
                  <Dialog open={isAddZoneOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) resetZoneForm(); }}>
                    <DialogTrigger asChild>
                      <button className="group flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-dashed border-hairline p-8 transition-all hover:border-amber-500/50 hover:bg-amber-500/5">
                        <div className="rounded-full bg-muted p-4 transition-colors group-hover:bg-amber-500/10 group-hover:text-amber-500">
                          <Plus className="h-6 w-6" />
                        </div>
                        <span className="font-bold text-muted-foreground transition-colors group-hover:text-amber-500">إضافة منطقة توصيل</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-right">{editZone ? "تعديل المنطقة" : "إضافة منطقة توصيل"}</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>اسم المنطقة</Label>
                          <Input value={zoneName} onChange={(e) => onNameChange(e.target.value)} placeholder="مثلاً: القاهرة، الجيزة..." className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>شركة الشحن</Label>
                          <Select value={zoneCarrierId} onValueChange={onCarrierIdChange}>
                            <SelectTrigger className="text-right"><SelectValue placeholder="اختر الشركة" /></SelectTrigger>
                            <SelectContent>
                              {carriers.filter((c) => c.active).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>تكلفة التوصيل (ج.م)</Label>
                          <Input type="number" value={zoneCost} onChange={(e) => onCostChange(e.target.value)} className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>مدة التوصيل (أيام)</Label>
                          <Input type="number" value={zoneDays} onChange={(e) => onDaysChange(e.target.value)} className="text-right" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => void onSave()} className="h-12 w-full rounded-xl font-bold">حفظ المنطقة</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
  );
}
