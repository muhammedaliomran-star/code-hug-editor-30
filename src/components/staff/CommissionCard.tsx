import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/store";
import type { StaffCommission } from "@/lib/staff";

export interface CommissionCardProps {
  commission: StaffCommission;
}

export function CommissionCard({ commission: comm }: CommissionCardProps) {
  return (
                  <div
                    key={comm.staff.id}
                    className="p-4 rounded-2xl border border-border/40 bg-card/60 space-y-3 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{comm.staff.name}</h4>
                        <span className="text-xs text-muted-foreground">{comm.staff.branchName || "الفرع الرئيسي"}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold font-mono">
                        نسبة العمولة: {comm.commissionRate}%
                      </Badge>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl bg-background/50 border border-border/30 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">مبيعات الشهر الحالية:</span>
                        <strong className="text-foreground">{fmt(comm.totalMonthSales)} ج.م</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">عدد الفواتير المنجزة:</span>
                        <span>{comm.totalInvoices} فاتورة</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">ساعات العمل في الورديات:</span>
                        <span>{comm.totalHours} ساعة</span>
                      </div>
                      <div className="flex justify-between text-success font-bold pt-1.5 border-t border-border/20">
                        <span className="font-sans">العمولة المستحقة:</span>
                        <span>+{fmt(comm.commissionEarned)} ج.م</span>
                      </div>
                      {comm.baseSalary > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-sans">الراتب الأساسي:</span>
                          <span>{fmt(comm.baseSalary)} ج.م</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-primary pt-1.5 border-t border-border/20">
                        <span className="font-sans">إجمالي المستحق:</span>
                        <span>{fmt(comm.totalPayout)} ج.م</span>
                      </div>
                    </div>
                  </div>
  );
}
