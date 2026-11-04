import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, Plus, Wallet } from "lucide-react";
import { generateInstallmentReminderMessage, type LicenseRecord } from "@/lib/licensing";

export interface InstallmentsTabProps {
  items: LicenseRecord[];
  onRecordPayment: (lic: LicenseRecord) => void;
  onWhatsApp: (phone: string, message: string) => void;
}

export function InstallmentsTab({ items, onRecordPayment, onWhatsApp }: InstallmentsTabProps) {
  return (
            <TabsContent value="installments" className="space-y-4">
              <div className="p-4 rounded-3xl bg-amber-500/[0.03] border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-amber-600 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    سجل أقساط البرمجيات والأجهزة الموردة للعملاء
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    متابعة الدفعات المتبقية على المشتركين، تسجيل سندات القبض، وإرسال مطالبات الأقساط عبر واتساب.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => {
                  const inst = item.installments!;
                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-black text-base text-foreground">{item.shopName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.clientName} ({item.clientPhone})
                            </p>
                          </div>
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs">
                            قسط نشط
                          </Badge>
                        </div>

                        {/* Progress Bar & Details */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
                            <span className="text-[10px] text-muted-foreground block">إجمالي التعاقد:</span>
                            <strong className="text-foreground">{inst.totalPrice.toLocaleString()} ج.م</strong>
                          </div>
                          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] text-emerald-600 block">المسدد:</span>
                            <strong className="text-emerald-600">
                              {(inst.totalPrice - inst.remainingBalance).toLocaleString()} ج.م
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-2xl bg-danger/10 border border-danger/20">
                            <span className="text-[10px] text-danger block">المتبقي:</span>
                            <strong className="text-danger">{inst.remainingBalance.toLocaleString()} ج.م</strong>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                          <span>
                            القسط الشهري: <strong>{inst.monthlyAmount} ج.م</strong>
                          </span>
                          <span>
                            تاريخ الاستحقاق: <strong>{inst.nextDueDate || "هذا الشهر"}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-foreground/5 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => onRecordPayment(item)}
                          className="w-full rounded-2xl h-10 text-xs font-bold bg-primary text-black hover:bg-primary/90"
                        >
                          <Plus className="w-3.5 h-3.5 ml-1" />
                          تسجيل سند تحصيل قسط
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onWhatsApp(item.clientPhone, generateInstallmentReminderMessage(item))}
                          className="rounded-2xl h-10 px-3 text-xs font-bold text-[#25D366] hover:text-[#25D366]"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <div className="col-span-2 p-12 text-center text-muted-foreground rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-bold text-sm">لا توجد أي أقساط مستحقة حالياً. جميع المشتركين مسددين بالكامل.</p>
                  </div>
                )}
              </div>
            </TabsContent>
  );
}
