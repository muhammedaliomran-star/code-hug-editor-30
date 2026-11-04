import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck } from "lucide-react";
import type { ShipmentCarrier, ShippingZone } from "@/types";

export interface InvoiceShippingStepProps {
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shippingCarrierId: string;
  onCarrierChange: (v: string) => void;
  shippingZoneId: string;
  onZoneChange: (v: string) => void;
  shippingAddress: string;
  onAddressChange: (v: string) => void;
  trackingNumber: string;
  onTrackingChange: (v: string) => void;
  customerAddress?: string;
}

export function InvoiceShippingStep({
  carriers,
  zones,
  shippingCarrierId,
  onCarrierChange,
  shippingZoneId,
  onZoneChange,
  shippingAddress,
  onAddressChange,
  trackingNumber,
  onTrackingChange,
  customerAddress,
}: InvoiceShippingStepProps) {
  return (
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <Badge className="gap-1.5 border border-border/30 bg-foreground/[0.06] px-3 py-1 text-muted-foreground">
                    <Truck className="h-3.5 w-3.5" /> تفاصيل الشحن
                  </Badge>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    اختياري
                  </Label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">شركة الشحن</Label>
                    <Select value={shippingCarrierId} onValueChange={onCarrierChange}>
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04]">
                        <SelectValue placeholder="اختر الشركة" />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers
                          .filter((c: any) => c.active)
                          .map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">المنطقة / المحافظة</Label>
                    <Select
                      value={shippingZoneId}
                      onValueChange={onZoneChange}
                      disabled={!shippingCarrierId}
                    >
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04]">
                        <SelectValue placeholder="اختر المنطقة" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones
                          .filter((z: any) => z.carrierId === shippingCarrierId)
                          .map((z: any) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.name} ({z.deliveryCost} ج.م)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">عنوان التوصيل</Label>
                  <Input
                    value={shippingAddress}
                    onChange={(e) => onAddressChange(e.target.value)}
                    placeholder={customerAddress || "اكتب العنوان هنا..."}
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">رقم التتبع (إن وجد)</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => onTrackingChange(e.target.value)}
                    placeholder="رقم البوليصة"
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04]"
                  />
                </div>
              </div>
            </div>
          )}
  );
}
