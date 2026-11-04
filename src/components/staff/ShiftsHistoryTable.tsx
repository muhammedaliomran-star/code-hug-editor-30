import { Clock, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ShiftRecord } from "@/lib/staff";

export interface ShiftsHistoryTableProps {
  shifts: ShiftRecord[];
  blurCls: string;
  onSelectZReport: (shift: ShiftRecord) => void;
}

export function ShiftsHistoryTable({ shifts, blurCls, onSelectZReport }: ShiftsHistoryTableProps) {
  return (
    shifts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
                  <Clock className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-sm text-foreground">لا توجد ورديات مسجلة حتى الآن</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    عند إغلاق أي وردية كاشير، سيتم حفظ تقرير الـ Z-Report المفصل هنا تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/60">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground bg-muted/20">
                        <th className="p-3 font-bold">الوردية</th>
                        <th className="p-3 font-bold">الكاشير</th>
                        <th className="p-3 font-bold">تاريخ البدء / الإغلاق</th>
                        <th className="p-3 font-bold">المبيعات</th>
                        <th className="p-3 font-bold">الدرج الفعلي</th>
                        <th className="p-3 font-bold">العجز / الزيادة</th>
                        <th className="p-3 font-bold text-left">تقرير Z</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {shifts.map((shift) => {
                        const isOver = shift.cashVariance > 0;
                        const isShort = shift.cashVariance < 0;

                        return (
                          <tr key={shift.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-bold font-mono">
                              #{shift.shiftNumber}
                              {shift.status === "open" && (
                                <Badge variant="outline" className="mr-2 text-[9px] bg-success/10 text-success border-success/30">
                                  نشطة حالياً
                                </Badge>
                              )}
                            </td>

                            <td className="p-3 font-medium text-foreground">
                              {shift.staffName}
                              <span className="block text-[10px] text-muted-foreground">{shift.branchName}</span>
                            </td>

                            <td className="p-3 text-[11px] text-muted-foreground">
                              <div>من: {new Date(shift.openedAt).toLocaleString("ar-EG")}</div>
                              {shift.closedAt && (
                                <div>إلى: {new Date(shift.closedAt).toLocaleString("ar-EG")}</div>
                              )}
                            </td>

                            <td className={cn("p-3 font-mono font-bold", blurCls)}>
                              {fmt(shift.totalGrossSales)} ج.م
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                ({shift.invoicesCount} فواتير)
                              </span>
                            </td>

                            <td className={cn("p-3 font-mono font-bold text-foreground", blurCls)}>
                              {fmt(shift.actualClosingCash)} ج.م
                            </td>

                            <td className="p-3 font-mono">
                              {shift.status === "open" ? (
                                <span className="text-muted-foreground text-[10px]">— قيد التشغيل —</span>
                              ) : isShort ? (
                                <span className="text-danger font-bold">عجز {fmt(Math.abs(shift.cashVariance))} ج.م</span>
                              ) : isOver ? (
                                <span className="text-success font-bold">زيادة {fmt(shift.cashVariance)} ج.م</span>
                              ) : (
                                <span className="text-success font-bold">مطابق تماماً ✓</span>
                              )}
                            </td>

                            <td className="p-3 text-left">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedZReportShift(shift)}
                                className="h-7 px-2.5 rounded-lg text-[10px] font-bold border-border/40 gap-1"
                              >
                                <Printer className="w-3 h-3 text-primary" />
                                Z-Report
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
  );
}
