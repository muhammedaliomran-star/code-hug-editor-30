import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/store";
import { removeBranchStaffMember, setActiveBranchId } from "@/lib/branch-system";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StaffTab() {
  const {
    branches, staffList, cur,
    setEditingStaff, setIsStaffDialogOpen,
    roleSimulatorBranch, setRoleSimulatorBranch,
    refreshBranchData,
  } = useBranches();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold">إدارة موظفي وصلاحيات الفروع</h3>
          <p className="text-xs text-muted-foreground">ربط الكاشير، البائعين والمديرين بالفروع وتحديد نطاق الرؤية</p>
        </div>

        <Button
          onClick={() => {
            setEditingStaff(null);
            setIsStaffDialogOpen(true);
          }}
          className="rounded-full px-5 h-9 font-bold text-xs shadow-sm"
        >
          <Plus className="ml-1.5 h-4 w-4" />
          إضافة موظف جديد
        </Button>
      </div>

      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <div>
            <span className="text-xs font-bold block">محاكي نطاق الصلاحيات (Scope Simulator)</span>
            <span className="text-[11px] text-muted-foreground">
              تجربة عرض البيانات كما يراها موظف فرع معين فقط دون صلاحية المدير العام
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={roleSimulatorBranch}
            onValueChange={(val) => {
              setRoleSimulatorBranch(val);
              setActiveBranchId(val);
              toast.info(val === "all" ? "تم الرجوع لوضع المدير العام (كل الفروع)" : `تم تقييد الصلاحية لفرع محدد`);
            }}
          >
            <SelectTrigger className="h-8 w-44 rounded-full text-xs font-semibold">
              <SelectValue placeholder="اختر النطاق" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold">
                صلاحية المدير العام (كل الفروع)
              </SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">
                  مقيد بفرع: {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-card overflow-hidden">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-[var(--hairline)] bg-muted/40 text-muted-foreground font-bold">
              <th className="p-3.5">اسم الموظف</th>
              <th className="p-3.5">الفرع المخصص</th>
              <th className="p-3.5">الدور الوظيفي</th>
              <th className="p-3.5">الهاتف</th>
              <th className="p-3.5">الراتب الأساسي</th>
              <th className="p-3.5 text-center">الحالة</th>
              <th className="p-3.5 text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {staffList.map((staff) => {
              const branch = branches.find((b) => b.id === staff.branchId);
              const roleMap = {
                manager: { label: "مدير فرع", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
                cashier: { label: "كاشير", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
                sales: { label: "بائع / مبيعات", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                inventory_keeper: { label: "أمين مخزن", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
                accountant: { label: "محاسب", color: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
              }[staff.role] || { label: staff.role, color: "bg-card" };

              return (
                <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3.5 font-bold text-sm">{staff.name}</td>
                  <td className="p-3.5 font-semibold text-primary">{branch?.name || "الفرع الرئيسي"}</td>
                  <td className="p-3.5">
                    <Badge variant="outline" className={cn("text-[10px] font-bold", roleMap.color)}>
                      {roleMap.label}
                    </Badge>
                  </td>
                  <td className="p-3.5 tabular-nums" dir="ltr">{staff.phone}</td>
                  <td className="p-3.5 tabular-nums font-bold">{fmt(staff.salary)} {cur}</td>
                  <td className="p-3.5 text-center">
                    <Badge variant={staff.active ? "default" : "secondary"} className="text-[10px]">
                      {staff.active ? "نشط" : "معطل"}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-left">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => {
                          setEditingStaff(staff);
                          setIsStaffDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-danger hover:bg-danger/10"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف ${staff.name}؟`)) {
                            removeBranchStaffMember(staff.id);
                            refreshBranchData();
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
