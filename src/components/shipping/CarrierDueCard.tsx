import { CheckCheck, Printer, Wallet } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import type { ShipmentCarrier } from "@/lib/store";
import { egp } from "./shipment-status";

export interface CarrierDueStat {
  carrier: ShipmentCarrier;
  count: number;
  due: number;
}

export interface CarrierDueCardProps {
  stat: CarrierDueStat;
  delay: number;
  blurCls: string;
  onSettle: () => void;
  onManifest: () => void;
}

export function CarrierDueCard({ stat: st, delay, blurCls, onSettle, onManifest }: CarrierDueCardProps) {
  return (
                  <Reveal delay={delay}>
                    <BezelCard className="plate space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">{st.carrier.name}</h3>
                        <Wallet className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="rounded-2xl bg-amber-500/5 p-4">
                        <p className="text-xs font-medium text-muted-foreground">محصّل ولم يُسلَّم بعد</p>
                        <p className={`mt-1 text-2xl font-bold text-amber-500 ${blurCls}`}>{egp(st.due)}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm">
                        <span className="text-muted-foreground">عدد الشحنات</span>
                        <span className="font-bold">{st.count}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" disabled={st.due <= 0} onClick={onSettle}>
                          <CheckCheck className="ml-2 h-4 w-4" /> تسوية
                        </Button>
                        <Button variant="outline" onClick={onManifest} title="مانيفست اليوم">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </BezelCard>
                  </Reveal>
  );
}
