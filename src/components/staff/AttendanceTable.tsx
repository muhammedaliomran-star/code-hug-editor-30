import { Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttendanceRecord } from "@/lib/staff";

export interface AttendanceTableProps {
  records: AttendanceRecord[];
}

export function AttendanceTable({ records }: AttendanceTableProps) {
  return (
    records.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
                  <Timer className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-sm text-foreground">لا توجد سجلات حضور وانصراف بعد</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    يمكن للموظف تسجيل الحضور والانصراف بضغطة زر واحدة من الشريط العلوي يومياً.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/60">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground bg-muted/20">
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">الموظف</th>
                        <th className="p-3 font-bold">الفرع</th>
                        <th className="p-3 font-bold">وقت الحضور (Clock-In)</th>
                        <th className="p-3 font-bold">وقت الانصراف (Clock-Out)</th>
                        <th className="p-3 font-bold">إجمالي الساعات</th>
                        <th className="p-3 font-bold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono font-bold text-foreground">{rec.date}</td>
                          <td className="p-3 font-medium text-foreground">{rec.staffName}</td>
                          <td className="p-3 text-muted-foreground">{rec.branchName}</td>
                          <td className="p-3 font-mono text-emerald-600">
                            {new Date(rec.clockIn).toLocaleTimeString("ar-EG")}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString("ar-EG") : "— قيد الدوام —"}
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {rec.totalHours ? `${rec.totalHours} ساعة` : "—"}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] py-0.5",
                                rec.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : "bg-primary/10 text-primary border-primary/30"
                              )}
                            >
                              {rec.status === "completed" ? "دوام مكتمل" : "حاضر بالعمل"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
    );
}
