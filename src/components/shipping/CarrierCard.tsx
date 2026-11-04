import { Building2, Link2, Pencil, Printer, RefreshCw } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import type { ShipmentCarrier } from "@/lib/store";

export interface CarrierCardProps {
  carrier: ShipmentCarrier;
  delay: number;
  onEdit: () => void;
  onManifest: () => void;
  onCopyPortal: () => void;
  onRotateToken: () => void;
  onToggleActive: () => void;
}

export function CarrierCard({
  carrier: c,
  delay,
  onEdit,
  onManifest,
  onCopyPortal,
  onRotateToken,
  onToggleActive,
}: CarrierCardProps) {
  return (
                  <Reveal delay={delay}>
                    <BezelCard className="plate space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${c.active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                          {c.active ? "نشط" : "غير نشط"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">{c.contactPerson || "لا يوجد مسئول اتصال"}</p>
                        {c.phone && <p className="mt-1 text-xs text-muted-foreground">{c.phone}</p>}
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-4 text-sm">
                        <span className="text-muted-foreground">التكلفة الأساسية</span>
                        <span className="font-bold">{c.baseCost} ج.م</span>
                      </div>
                      <div className="flex flex-wrap gap-2 [&_button]:h-11 sm:[&_button]:h-9">
                        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
                          <Pencil className="h-4 w-4" /> تعديل
                        </Button>
                        <Button variant="outline" size="sm" onClick={onManifest} title="مانيفست">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={onCopyPortal} title="نسخ رابط بوابة المندوب">
                          <Link2 className="h-4 w-4" /> رابط المندوب
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onRotateToken} title="إصدار رمز دخول جديد وإبطال القديم">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onToggleActive}>
                          {c.active ? "إيقاف" : "تفعيل"}
                        </Button>
                      </div>
                    </BezelCard>
                  </Reveal>
  );
}
