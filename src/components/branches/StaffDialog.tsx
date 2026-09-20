import { useBranches } from "./context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StaffDialog() {
  const {
    branches, cur, activeBranch,
    isStaffDialogOpen, setIsStaffDialogOpen,
    editingStaff,
    handleSaveStaff,
  } = useBranches();

  return (
    <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
        <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-6 py-5">
          <DialogTitle className="text-base font-bold">
            {editingStaff ? "تعديل بيانات الموظف" : "إضافة موظف جديد بالفرع"}
          </DialogTitle>
        </div>
        <form onSubmit={handleSaveStaff} className="p-6 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">اسم الموظف *</Label>
            <Input name="name" defaultValue={editingStaff?.name} required placeholder="الاسم ثلاثي..." className="h-10 rounded-xl text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الفرع المخصص *</Label>
              <Select name="branchId" defaultValue={editingStaff?.branchId || (activeBranch ? activeBranch.id : "")}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">الدور الوظيفي *</Label>
              <Select name="role" defaultValue={editingStaff?.role || "cashier"}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager" className="text-xs">مدير فرع</SelectItem>
                  <SelectItem value="cashier" className="text-xs">كاشير</SelectItem>
                  <SelectItem value="sales" className="text-xs">بائع / مبيعات</SelectItem>
                  <SelectItem value="inventory_keeper" className="text-xs">أمين مخزن</SelectItem>
                  <SelectItem value="accountant" className="text-xs">محاسب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">رقم الهاتف</Label>
              <Input name="phone" defaultValue={editingStaff?.phone} placeholder="010..." className="h-10 rounded-xl text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الراتب الأساسي ({cur})</Label>
              <Input name="salary" type="number" defaultValue={editingStaff?.salary || 4500} className="h-10 rounded-xl text-xs" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-foreground/10 bg-card/50">
            <span className="text-xs font-bold">الحساب نشط</span>
            <Switch name="active" defaultChecked={editingStaff ? editingStaff.active : true} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 h-10 rounded-xl font-bold text-xs">
              حفظ بيانات الموظف
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsStaffDialogOpen(false)} className="h-10 rounded-xl text-xs">
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
