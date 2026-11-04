import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, CheckCircle2, MessageCircle, RefreshCw } from "lucide-react";
import { generateRenewalReminderMessage, type LicenseRecord } from "@/lib/licensing";

/** ترخيص موسّع بحقول CRM (الأيام المتبقية وحالة التحذير). */
export type CrmItem = LicenseRecord & {
  daysRemaining: number;
  isExpired: boolean;
  isWarning: boolean;
  isTrialExpiring: boolean;
};

export interface CrmTabProps {
  items: CrmItem[];
  onWhatsApp: (phone: string, message: string) => void;
  onExtend: (lic: LicenseRecord) => void;
  onManage: (lic: LicenseRecord) => void;
}

export function CrmTab({ items, onWhatsApp, onExtend, onManage }: CrmTabProps) {
  return (
            <TabsContent value="crm" className="space-y-4">
              <div className="p-4 rounded-3xl bg-primary/[0.03] border border-primary/20 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-primary flex items-center gap-2">
                    <BellRing className="w-4 h-4" />
                    مركز متابعة التجديدات والعملاء المحتملين (CRM Follow-ups)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    قائمة بالعملاء المنتهي اشتراكهم أو الفترات التجريبية القريبة من الانتهاء للتواصل معهم بنقرة واحدة على واتساب.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-foreground">{item.shopName}</h4>
                        <Badge
                          variant={item.isExpired ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {item.isExpired
                            ? "منتهي الصلاحية"
                            : item.tier === "trial"
                            ? `تجريبي (${item.daysRemaining} يوم متبقي)`
                            : `ينتهي خلال ${item.daysRemaining} يوم`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        العميل: <strong>{item.clientName}</strong> — الهاتف: <strong>{item.clientPhone}</strong> — الباقة: {item.tierLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      <Button
                        size="sm"
                        onClick={() => onWhatsApp(item.clientPhone, generateRenewalReminderMessage(item))}
                        className="rounded-2xl h-10 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white gap-1.5 shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        إرسال تذكير تجديد واتساب
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExtend(item)}
                        className="rounded-2xl h-10 px-4 text-xs font-bold gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-primary" />
                        تجديد فوري سنة
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onManage(item)}
                        className="rounded-2xl h-10 text-xs font-bold"
                      >
                        تفاصيل
                      </Button>
                    </div>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-bold text-sm">ممتاز! لا توجد اشتراكات متأخرة أو تنبيهات تجديد حالياً.</p>
                  </div>
                )}
              </div>
            </TabsContent>
  );
}
