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

export default function BranchDialog() {
  const {
    isBranchDialogOpen, setIsBranchDialogOpen,
    editingBranch, editingBranchProfile,
    handleSaveBranch,
  } = useBranches();

  return (
    <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-lg" dir="rtl">
        <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-card px-8 py-6">
          <DialogTitle className="text-xl font-bold">
            {editingBranch ? "تعديل بيانات الفرع" : "إضافة فرع جديد"}
          </DialogTitle>
        </div>
        <form onSubmit={handleSaveBranch} className="p-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم الفرع *</Label>
            <Input id="name" name="name" defaultValue={editingBranch?.name} required placeholder="مثلاً: فرع المهندسين" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">الموقع / العنوان التفصيلي</Label>
            <Input id="location" name="location" defaultValue={editingBranch?.location || ""} placeholder="شارع سوريا، المهندسين، الجيزة" className="h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" name="phone" defaultValue={editingBranch?.phone || ""} placeholder="010..." className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managerName">اسم المدير</Label>
              <Input id="managerName" name="managerName" defaultValue={editingBranch?.managerName || ""} placeholder="محمد علي..." className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="branchCode">كود الفرع</Label>
              <Input id="branchCode" name="branchCode" defaultValue={editingBranchProfile.code || ""} placeholder="BR-01" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchEmail">بريد الفرع</Label>
              <Input id="branchEmail" name="branchEmail" defaultValue={editingBranchProfile.email || ""} placeholder="branch@store.com" className="h-11 rounded-xl" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNumber">السجل الضريبي للفرع</Label>
              <Input id="taxNumber" name="taxNumber" defaultValue={editingBranchProfile.taxNumber || ""} placeholder="100-200-300" className="h-11 rounded-xl" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercialRecord">السجل التجاري للفرع</Label>
              <Input id="commercialRecord" name="commercialRecord" defaultValue={editingBranchProfile.commercialRecord || ""} placeholder="12345" className="h-11 rounded-xl" dir="ltr" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-foreground/10 bg-card/50">
            <div className="space-y-0.5">
              <Label>تعيين كفرع رئيسي</Label>
              <p className="text-xs text-muted-foreground">يكون المرجع الافتراضي للمخزون والعمليات</p>
            </div>
            <Switch name="isMain" defaultChecked={editingBranch?.isMain} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 h-11 rounded-xl font-bold">حفظ الفرع</Button>
            <Button type="button" variant="outline" onClick={() => setIsBranchDialogOpen(false)} className="h-11 px-6 rounded-xl">إلغاء</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
