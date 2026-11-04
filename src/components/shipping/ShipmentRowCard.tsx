import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ExternalLink, FileText, MessageCircle, Printer } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Shipment, ShipmentStatus } from "@/lib/store";
import type { SlaInfo } from "@/lib/shipping-pricing";
import { allowedShipmentStatuses, collectionMap, egp, statusMap } from "./shipment-status";

export interface ShipmentRowCardProps {
  shipment: Shipment;
  delay: number;
  checked: boolean;
  sla: SlaInfo;
  blurCls: string;
  onToggle: () => void;
  onWhatsApp: () => void;
  onPrintLabel: () => void;
  onDetail: () => void;
  onStatusChange: (status: ShipmentStatus) => void;
}

export function ShipmentRowCard({
  shipment: s,
  delay,
  checked,
  sla,
  blurCls,
  onToggle,
  onWhatsApp,
  onPrintLabel,
  onDetail,
  onStatusChange,
}: ShipmentRowCardProps) {
  return (
                    <Reveal delay={delay}>
                      <BezelCard className="plate group flex flex-wrap items-center gap-2 p-3 sm:gap-4 sm:p-5 lg:gap-6">
                        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label="تحديد الشحنة" className="h-5 w-5" />
                        <div className={`h-10 w-1.5 rounded-full sm:h-12 ${statusMap[s.status]?.color.split(" ")[0]}`} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="text-base font-bold sm:text-lg">#{s.trackingNumber || "بدون رقم"}</span>

                            <span className={`rounded-full border px-3 py-0.5 text-[11px] font-bold ${statusMap[s.status]?.color}`}>
                              {statusMap[s.status]?.label}
                            </span>
                            {(() => {
                              if (sla.state === "closed" || sla.state === "on_time") return null;
                              return (
                                <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${sla.state === "late" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-600"}`}>
                                  {sla.label}
                                </span>
                              );
                            })()}
                            {s.codAmount > 0 && (
                              <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${collectionMap[s.collectionStatus]?.color}`}>
                                {collectionMap[s.collectionStatus]?.label}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{s.recipientName} • {s.recipientPhone}</p>
                          {s.invoiceId && (
                            <Link to="/invoices" search={{ invoice: s.invoiceId } as never} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" /> فاتورة مرتبطة
                            </Link>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-medium text-muted-foreground sm:text-sm">التحصيل</p>
                          <p className={`text-sm font-bold ${blurCls}`}>{egp(s.codAmount)}</p>
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-xs font-medium text-muted-foreground sm:text-sm">التكلفة</p>
                          <p className={`text-sm font-bold ${blurCls}`}>{egp(s.shippingCost)}</p>
                        </div>
                        <div className="hidden text-right lg:block">
                          <p className="text-sm font-medium text-muted-foreground">التاريخ</p>
                          <p className="text-sm font-bold">{format(new Date(s.createdAt), "dd MMMM yyyy", { locale: ar })}</p>
                        </div>
                        <div className="flex w-full items-center gap-1.5 border-t border-hairline pt-2 sm:w-auto sm:border-0 sm:pt-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="إشعارات وقوالب واتساب التلقائية"
                            className="h-11 w-11 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 sm:h-9 sm:w-9"
                            onClick={onWhatsApp}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" title="بوليصة شحن" onClick={onPrintLabel}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" title="تفاصيل" onClick={onDetail}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Select value={s.status} onValueChange={(val) => onStatusChange(val as ShipmentStatus)}>
                            <SelectTrigger className="h-11 flex-1 rounded-xl text-xs font-bold sm:h-9 sm:w-[130px] sm:flex-none"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {allowedShipmentStatuses(s.status).map((status) => <SelectItem key={status} value={status}>{statusMap[status]?.label ?? status}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                      </BezelCard>
                    </Reveal>
  );
}
