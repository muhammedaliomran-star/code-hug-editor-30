import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Trash2 } from "lucide-react";
import type { HardwareItem } from "@/lib/licensing";

export interface LicenseHardwareRowsProps {
  items: HardwareItem[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof HardwareItem, value: any) => void;
  onRemove: (id: string) => void;
}

export function LicenseHardwareRows({ items, onAdd, onUpdate, onRemove }: LicenseHardwareRowsProps) {
  return (
                  <div className="space-y-3 py-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                        <Printer className="w-4 h-4 text-primary" />
                        الأجهزة الموردة (طابعات / قارئ باركود / أدراج)
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onAdd}
                        className="rounded-xl text-[11px] h-7 text-primary font-bold"
                      >
                        + إضافة جهاز
                      </Button>
                    </div>

                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Input
                          placeholder="اسم الجهاز والموديل..."
                          value={item.name}
                          onChange={(e) => onUpdate(item.id, "name", e.target.value)}
                          className="h-9 text-xs rounded-xl flex-1 bg-background"
                        />
                        <Input
                          type="number"
                          placeholder="الكمية"
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdate(item.id, "quantity", Number(e.target.value))
                          }
                          className="h-9 text-xs rounded-xl w-20 text-center bg-background"
                        />
                        <Input
                          type="number"
                          placeholder="السعر"
                          value={item.unitPrice}
                          onChange={(e) =>
                            onUpdate(item.id, "unitPrice", Number(e.target.value))
                          }
                          className="h-9 text-xs rounded-xl w-28 text-center bg-background"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemove(item.id)}
                          className="h-8 w-8 rounded-lg text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
  );
}
