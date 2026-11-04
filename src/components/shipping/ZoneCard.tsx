import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import type { ShippingZone } from "@/lib/store";

export interface ZoneCardProps {
  zone: ShippingZone;
  carrierName?: string;
  delay: number;
  onEdit: () => void;
  onRemove: () => void;
}

export function ZoneCard({ zone: z, carrierName, delay, onEdit, onRemove }: ZoneCardProps) {
  return (
                  <Reveal delay={delay}>
                    <BezelCard className="plate space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/20">
                          <MapPin className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">{carrierById.get(z.carrierId)?.name}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{z.name}</h3>
                        <p className="text-sm text-muted-foreground">مدة التوصيل: {z.estimatedDays} أيام</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-4 text-sm">
                        <span className="text-muted-foreground">تكلفة التوصيل</span>
                        <span className="font-bold text-primary">{z.deliveryCost} ج.م</span>
                      </div>
                      <div className="flex flex-wrap gap-2 [&_button]:h-11 sm:[&_button]:h-9">
                        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
                          <Pencil className="h-4 w-4" /> تعديل
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onRemove}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </BezelCard>
                  </Reveal>
  );
}
