import { useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Store,
  Upload,
  Trash2,
  Send,
  Receipt,
} from "lucide-react";
import { TabProps, Section, Field, shrinkImage } from "./shared";

export function ShopTab({ form, set }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختار صورة صالحة من فضلك");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من 3 ميجابايت");
      return;
    }
    try {
      const dataUrl = await shrinkImage(file, 256);
      set("logoUrl", dataUrl);
      toast.success("تم تحميل اللوجو بنجاح");
    } catch {
      toast.error("تعذر معالجة الصورة");
    }
  };

  const testWhatsAppNumber = () => {
    const raw = (form.whatsapp || form.phone || "").replace(/\D/g, "");
    if (!raw) {
      toast.error("يرجى إدخال رقم هاتف أو واتساب أولاً");
      return;
    }
    const cleanNumber = raw.startsWith("0") ? `2${raw}` : raw;
    const msg = encodeURIComponent(`مرحباً بك من متجر ${form.shopName || "سجلي"}`);
    window.open(`https://wa.me/${cleanNumber}?text=${msg}`, "_blank");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Store className="w-5 h-5" />}
        title="هوية المحل والنشاط التجاري"
        hint="البيانات الأساسية التي تظهر في ترويسة الفواتير وسندات القبض وبوليصات الشحن."
      >
        <div className="grid gap-3">
          <Field label="اسم النشاط التجاري">
            <Input
              value={form.shopName}
              onChange={(e) => set("shopName", e.target.value)}
              placeholder="مثال: شركة النور للتجارة والتوزيع"
              maxLength={80}
              className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رقم التليفون">
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                maxLength={30}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="رقم الواتساب" hint="يستخدم لإرسال تنبيهات الأقساط">
              <div className="relative flex items-center">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  placeholder="201xxxxxxxxx"
                  dir="ltr"
                  maxLength={30}
                  className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all pl-10"
                />
                {form.whatsapp && (
                  <button
                    type="button"
                    onClick={testWhatsAppNumber}
                    title="اختبار فتح محادثة الواتساب"
                    className="absolute left-2.5 p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="السجل التجاري (CR)">
              <Input
                value={form.commercialRegister || ""}
                onChange={(e) => set("commercialRegister", e.target.value)}
                placeholder="مثال: 104523"
                dir="ltr"
                maxLength={50}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="الرقم الضريبي (TR)">
              <Input
                value={form.taxNumber}
                onChange={(e) => set("taxNumber", e.target.value)}
                placeholder="000-000-000"
                dir="ltr"
                maxLength={40}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="البريد الإلكتروني للنشاط">
              <Input
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="info@shop.com"
                dir="ltr"
                maxLength={100}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
            <Field label="الموقع / رابط المتجر">
              <Input
                value={form.website || ""}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://..."
                dir="ltr"
                maxLength={200}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </Field>
          </div>

          <Field label="العنوان الجغرافي">
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="مثال: القاهرة، حي المعادي - شارع النصر"
              maxLength={200}
              className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
            />
          </Field>

          <Field label="ملاحظة أسفل الفاتورة">
            <Textarea
              value={form.footerNote}
              onChange={(e) => set("footerNote", e.target.value)}
              placeholder="مثال: البضاعة المباعة لا ترد بعد 14 يوماً مع تقديم أصل الفاتورة."
              maxLength={300}
              rows={2}
              className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all resize-none p-3.5 text-xs"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-bold text-muted-foreground/60">
                {form.footerNote.length}/300
              </span>
            </div>
          </Field>
        </div>
      </Section>

      <div className="grid gap-6 h-fit order-first lg:order-none">
        <Section
          icon={<Upload className="w-5 h-5" />}
          title="شعار المحل (Logo)"
          hint="شعار مربع أو دائري يظهر في الفواتير والمطبوعات."
        >
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 rounded-[2rem] border-2 border-dashed border-foreground/10 bg-foreground/[0.02] grid place-items-center overflow-hidden shrink-0 transition-all hover:border-primary/40 hover:bg-primary/5">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="لوجو المحل"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <Store className="w-8 h-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="grid gap-2 flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-10 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-4 font-bold"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-4 h-4" /> رفع صورة
                </Button>
                {form.logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-2 rounded-2xl text-danger hover:bg-danger/10 transition-all px-4 font-bold"
                    onClick={() => set("logoUrl", null)}
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </Button>
                ) : null}
              </div>
              <Input
                value={form.logoUrl?.startsWith("data:") ? "" : (form.logoUrl ?? "")}
                onChange={(e) => set("logoUrl", e.target.value || null)}
                placeholder="أو ضع رابطاً مباشراً للصورة https://..."
                dir="ltr"
                className="h-10 rounded-xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all text-xs"
              />
            </div>
          </div>
        </Section>

        <Section
          icon={<Receipt className="w-5 h-5" />}
          title="معاينة رأس الفاتورة الرسمية"
          hint="شكل الترويسة المطبوعة كما تظهر للعميل."
        >
          <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
            <div className="rounded-[calc(2.5rem-0.5rem)] bg-card p-6 backdrop-blur-md shadow-xl border border-white/5">
              <div className="flex items-start justify-between gap-3 border-b-2 border-primary/20 pb-4">
                <div className="flex items-center gap-4">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt=""
                      className="h-12 w-12 object-contain rounded-xl bg-white p-1 shadow-sm"
                    />
                  ) : null}
                  <div className="text-right">
                    <div className="text-xl font-black tracking-tight text-foreground">
                      {form.shopName || "اسم المحل أو النشاط"}
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                      {form.address || "عنوان المحل الرئيسي"}
                    </div>
                    {form.email && (
                      <div className="text-[10px] text-muted-foreground/80 font-mono" dir="ltr">
                        {form.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] font-black text-muted-foreground text-left leading-5 tracking-wider">
                  <div dir="ltr">{form.phone || "01xxxxxxxxx"}</div>
                  {form.taxNumber ? <div dir="ltr">T.R: {form.taxNumber}</div> : null}
                  {form.commercialRegister ? <div dir="ltr">C.R: {form.commercialRegister}</div> : null}
                  <Badge
                    variant="secondary"
                    className="mt-2 rounded-lg bg-primary/10 text-primary border-none text-[9px] font-black"
                  >
                    {form.invoicePrefix || "INV"}-0001
                  </Badge>
                </div>
              </div>
              <div className="pt-3 text-[10px] font-bold text-muted-foreground/70 leading-relaxed italic">
                {form.footerNote || "ملاحظة الفاتورة المطبوعة في الأسفل..."}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
