import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Receipt,
  Printer,
  ShieldCheck,
  Tag,
  Plus,
  X,
  Percent,
} from "lucide-react";
import {
  fmt,
  DEFAULT_EXPENSE_CATEGORIES_LIST,
  type PrintPaper,
} from "@/lib/store";
import { TabProps, Section, Field } from "./shared";

function ExpenseCategoriesSection({ form, set }: TabProps) {
  const [newCat, setNewCat] = useState("");
  const categories = form.customExpenseCategories || DEFAULT_EXPENSE_CATEGORIES_LIST;

  const addCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast.error("هذا البند موجود بالفعل");
      return;
    }
    const updated = [...categories, trimmed];
    set("customExpenseCategories", updated);
    setNewCat("");
    toast.success(`تمت إضافة بند: ${trimmed}`);
  };

  const removeCategory = (cat: string) => {
    if (categories.length <= 1) {
      toast.error("يجب الإبقاء على تصنيف واحد على الأقل");
      return;
    }
    const updated = categories.filter((c) => c !== cat);
    set("customExpenseCategories", updated);
    toast.success(`تم حذف بند: ${cat}`);
  };

  return (
    <Section
      icon={<Tag className="w-5 h-5 text-primary" />}
      title="تصنيفات وبنود المصروفات (Expense Categories)"
      hint="تخصيص بنود المصاريف والنثريات التي تظهر في شاشتي اليومية والمصروفات."
    >
      <div className="grid gap-4">
        <div className="flex gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="أضف بند مصروف جديد (مثال: صيانة، تسويق، بوفيه)..."
            className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all text-xs"
          />
          <Button
            type="button"
            onClick={addCategory}
            className="h-11 px-4 rounded-2xl gap-1.5 font-bold shrink-0 text-xs"
          >
            <Plus className="w-4 h-4" /> إضافة
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((cat) => (
            <div
              key={cat}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-foreground/[0.04] border border-foreground/10 text-xs font-bold transition-all hover:bg-foreground/[0.07]"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="text-muted-foreground hover:text-danger rounded-full p-0.5 transition-colors"
                title={`حذف ${cat}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              set("customExpenseCategories", DEFAULT_EXPENSE_CATEGORIES_LIST);
              toast.success("تمت استعادة التصنيفات الافتراضية");
            }}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            استعادة البنود الافتراضية
          </Button>
          <span>{categories.length} بند مسجل</span>
        </div>
      </div>
    </Section>
  );
}

export function BillingTab({ form, set }: TabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Receipt className="w-5 h-5" />}
        title="الفواتير والأقساط الافتراضية"
        hint="القيم الافتراضية المحملة عند إنشاء فواتير البيع والأقساط."
      >
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رمز العملة">
              <Input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                placeholder="ج.م"
                maxLength={10}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="بادئة رقم الفاتورة" hint="مثال: INV → INV-0001">
              <Input
                value={form.invoicePrefix}
                onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())}
                placeholder="INV"
                dir="ltr"
                maxLength={10}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="أقساط افتراضية (شهور)">
              <Input
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={form.defaultInstallmentMonths}
                onChange={(e) => set("defaultInstallmentMonths", Number(e.target.value) || 1)}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="يوم الاستحقاق الافتراضي" hint="من 1 لـ 28 شهرياً">
              <Input
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                value={form.defaultDueDay}
                onChange={(e) => set("defaultDueDay", Number(e.target.value) || 1)}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <div className="rounded-[1.75rem] bg-primary/[0.04] p-4 text-xs text-muted-foreground leading-relaxed border border-primary/10">
            <span className="block mb-1.5 font-black uppercase tracking-widest text-primary">
              معاينة حاسبة الأقساط:
            </span>
            فاتورة بقيمة{" "}
            <strong className="text-foreground font-black">
              {fmt(12000)} {form.currency}
            </strong>{" "}
            على <strong className="text-foreground font-black">{form.defaultInstallmentMonths}</strong> شهر →
            القسط الشهري ≈{" "}
            <strong className="text-primary font-black">
              {fmt(12000 / Math.max(1, form.defaultInstallmentMonths))} {form.currency}
            </strong>{" "}
            يوم <strong className="text-foreground font-black">{form.defaultDueDay}</strong> من كل شهر.
          </div>

          <Separator className="my-2" />

          {/* الضريبة المضافة */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" /> تفعيل ضريبة القيمة المضافة (VAT)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                حساب الضريبة تلقائياً على فواتير المبيعات
              </p>
            </div>
            <Switch
              checked={form.enableVat ?? false}
              onCheckedChange={(v) => set("enableVat", v)}
            />
          </div>

          {form.enableVat && (
            <Field label="نسبة الضريبة الافتراضية (%)">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.defaultVatRate ?? 14}
                  onChange={(e) => set("defaultVatRate", Number(e.target.value) || 0)}
                  className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
                />
                <span className="text-sm font-bold text-muted-foreground">%</span>
              </div>
            </Field>
          )}

          <Field label="شروط الضمان وسياسة الاسترجاع">
            <Textarea
              value={form.warrantyPolicy ?? ""}
              onChange={(e) => set("warrantyPolicy", e.target.value)}
              placeholder="شروط الضمان والاسترجاع المطبوعة أسفل الفاتورة..."
              maxLength={500}
              rows={2}
              className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all resize-none p-3 text-xs"
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Printer className="w-5 h-5" />}
        title="إعدادات الطباعة والورق"
        hint="تخصيص نمط وتخطيط الورق المطبوع في الفواتير وإيصالات الكاشير."
      >
        <div className="grid gap-4">
          <Field label="مقاس الورق">
            <Select
              value={form.printPaper}
              onValueChange={(v) => set("printPaper", v as PrintPaper)}
            >
              <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="a4">A4 — طابعة مكتبية عادية (تخطيط كامل)</SelectItem>
                <SelectItem value="thermal">حراري 80mm — طابعة كاشير نقاط البيع</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {form.printPaper === "a4"
              ? "الفاتورة تُطبع بعرض كامل مع جدول أصناف مفصل وترويسة كاملة وبيانات الضريبة."
              : "الفاتورة تُطبع في شريط حراري مدمج مناسب لرولات طابعات الكاشير 80 مم."}
          </p>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">الطباعة التلقائية فور الحفظ</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                فتح نافذة الطباعة مباشرة بمجرد إصدار الفاتورة أو الإيصال
              </p>
            </div>
            <Switch
              checked={form.autoPrintOnSave ?? false}
              onCheckedChange={(v) => set("autoPrintOnSave", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">إظهار باركود الفاتورة في الطباعة الحرارية</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                طباعة باركود سريع في ذيل الفاتورة لسهولة المسح والاسترجاع
              </p>
            </div>
            <Switch
              checked={form.thermalShowBarcode ?? true}
              onCheckedChange={(v) => set("thermalShowBarcode", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">إظهار بيانات الترويسة في الإيصال الحراري</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                طباعة اسم المحل، الهاتف، والعنوان في أعلى شريط الكاشير
              </p>
            </div>
            <Switch
              checked={form.thermalShowHeader ?? true}
              onCheckedChange={(v) => set("thermalShowHeader", v)}
            />
          </div>

          {form.printPaper === "thermal" && (
            <>
              <Field label="عرض شريط الورق الحراري">
                <Select
                  value={form.thermalPaperWidth ?? "80mm"}
                  onValueChange={(v) => set("thermalPaperWidth", v as "80mm" | "58mm")}
                >
                  <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="80mm">80 مم (العرض القياسي الأنسب لمعظم الطابعات)</SelectItem>
                    <SelectItem value="58mm">58 مم (شريط ضيق لطابعات البلوتوث والمحمولة)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold">فتح درج النقدية تلقائياً عند الطباعة (Cash Drawer Kick)</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    إرسال إشارة فتح الدرج (ESC/POS) مع طباعة الفاتورة أو إغلاق الوردية
                  </p>
                </div>
                <Switch
                  checked={form.openCashDrawerOnPrint ?? true}
                  onCheckedChange={(v) => set("openCashDrawerOnPrint", v)}
                />
              </div>
            </>
          )}
        </div>
      </Section>

      {/* أمان الكاشير والتحكم في نقاط البيع */}
      <Section
        icon={<ShieldCheck className="w-5 h-5 text-primary" />}
        title="صلاحيات الكاشير وأمان نقاط البيع (POS Security)"
        hint="حماية أسعار التكلفة، منع التلاعب بالخصومات، والتحكم برقم المدير السري."
      >
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="الرقم السري للمدير (Manager PIN)" hint="المطلوب للموافقة على الخصومات وإلغاء الفواتير">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={form.managerPin ?? ""}
                onChange={(e) => set("managerPin", e.target.value)}
                placeholder="••••"
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-mono font-bold text-center tracking-widest"
              />
            </Field>

            <Field label="أقصى نسبة خصم للكاشير بدون رقم المدير (%)" hint="أي خصم أعلى يتطلب موافقة المدير">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.maxDiscountWithoutPin ?? 5}
                  onChange={(e) => set("maxDiscountWithoutPin", Number(e.target.value) || 0)}
                  className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
                />
                <span className="text-sm font-bold text-muted-foreground">%</span>
              </div>
            </Field>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">إخفاء سعر التكلفة والأرباح عن شاشات الكاشير</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                حجب حقول التكلفة وهوامش الربح لمنع اطلاع الموظفين على أسرار التسعير
              </p>
            </div>
            <Switch
              checked={form.hideCostAndProfitsFromCashier ?? false}
              onCheckedChange={(v) => set("hideCostAndProfitsFromCashier", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">منع حذف أو تعديل الفواتير الصادرة إلا بإذن المدير</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تأمين سجل الفواتير والمبيعات ضد الحذف العشوائي والتلاعب
              </p>
            </div>
            <Switch
              checked={form.preventInvoiceDeletionWithoutPin ?? true}
              onCheckedChange={(v) => set("preventInvoiceDeletionWithoutPin", v)}
            />
          </div>
        </div>
      </Section>

      {/* إدارة بنود وتصنيفات المصروفات المخصصة */}
      <ExpenseCategoriesSection form={form} set={set} />
    </div>
  );
}
