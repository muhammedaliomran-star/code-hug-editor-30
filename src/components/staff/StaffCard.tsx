import { Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/lib/staff";

export interface StaffCardProps {
  staff: StaffMember;
  isCurrent: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function StaffCard({
  staff: st,
  isCurrent,
  canDelete,
  onEdit,
  onDelete,
}: StaffCardProps) {
  const isAdmin = st.role === "admin";
  const isManager = st.role === "manager";
  return (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl border border-border/40 bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              {st.name}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary font-mono">
                                  أنت
                                </span>
                              )}
                            </h4>
                            <span className="text-xs text-muted-foreground">{st.phone}</span>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold py-0.5",
                              isAdmin
                                ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                : isManager
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}
                          >
                            {isAdmin ? "مدير عام" : isManager ? "مشرف فرع" : "كاشير"}
                          </Badge>
                        </div>

                        {/* Permissions & Commission Info */}
                        <div className="space-y-1.5 my-3 pt-2 border-t border-border/20 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">نسبة العمولة:</span>
                            <span className="font-mono font-bold text-primary">{st.commissionRatePct || 0}%</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">تعديل سعر البيع بالفاتورة:</span>
                            <span className={st.permissions.canChangePrice ? "text-success font-bold" : "text-danger"}>
                              {st.permissions.canChangePrice ? "مسموح" : "ممنوع 🔒"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">رؤية التكلفة وهامش الربح:</span>
                            <span className={st.permissions.canViewCostAndProfit ? "text-success font-bold" : "text-danger"}>
                              {st.permissions.canViewCostAndProfit ? "مسموح" : "مخفي 🔒"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">حذف الفواتير:</span>
                            <span className={st.permissions.canDeleteInvoice ? "text-success font-bold" : "text-danger"}>
                              {st.permissions.canDeleteInvoice ? "مسموح" : "ممنوع 🔒"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">أقصى نسبة خصم مسموحة:</span>
                            <span className="font-mono font-bold text-primary">{st.permissions.maxDiscountPct}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/20">
                        <span className="text-[10px] text-muted-foreground">
                          رمز PIN: <strong className="font-mono">{st.pinCode ? "••••" : "غير محدد"}</strong>
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEdit}
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={onDelete}
                              className="h-7 w-7 text-muted-foreground hover:text-danger"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
  );
}
