import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Volume2,
  MessageCircle,
  HeartHandshake,
} from "lucide-react";
import { TabProps, Section, playTestAlert } from "./shared";

function PaymentThankYouTemplateSection({ form, set }: TabProps) {
  const insertPaymentVar = (varKey: string) => {
    const current = form.whatsappPaymentThankYouTemplate || "";
    set("whatsappPaymentThankYouTemplate", `${current} {${varKey}}`);
  };

  const sampleCustomer = "محمد أحمد";
  const samplePaid = "500 ج.م";
  const sampleRemaining = "750 ج.م";
  const sampleShop = form.shopName || "محل النور";

  const simulatedText = (form.whatsappPaymentThankYouTemplate || "")
    .replace(/\{اسم_العميل\}/g, sampleCustomer)
    .replace(/\{المبلغ_المدفوع\}/g, samplePaid)
    .replace(/\{المبلغ_المتبقي\}/g, sampleRemaining)
    .replace(/\{اسم_المحل\}/g, sampleShop);

  return (
    <Section
      icon={<HeartHandshake className="w-5 h-5 text-emerald-500" />}
      title="قالب رسالة الشكر وتأكيد استلام الدفعة"
      hint="الرسالة التلقائية المرسلة للعميل فور استلام دفعة نقدية أو تسديد قسط."
    >
      <div className="grid gap-3">
        <Label className="text-xs font-black">المتغيرات المتاحة (اضغط للإضافة):</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            { key: "اسم_العميل", label: "اسم العميل" },
            { key: "المبلغ_المدفوع", label: "المبلغ المدفوع" },
            { key: "المبلغ_المتبقي", label: "المبلغ المتبقي" },
            { key: "اسم_المحل", label: "اسم المحل" },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertPaymentVar(v.key)}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              + {`{${v.label}}`}
            </button>
          ))}
        </div>

        <Textarea
          value={form.whatsappPaymentThankYouTemplate ?? ""}
          onChange={(e) => set("whatsappPaymentThankYouTemplate", e.target.value)}
          placeholder="اكتب نص رسالة الشكر واستلام الدفعة..."
          rows={3}
          className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all p-3.5 text-xs leading-relaxed"
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              set(
                "whatsappPaymentThankYouTemplate",
                "شكراً لتعاملكم مع {اسم_المحل}، أستاذ {اسم_العميل}. تم بنجاح استلام دفعة بقيمة {المبلغ_المدفوع}، والمتبقي على حسابكم هو {المبلغ_المتبقي}.",
              )
            }
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            استعادة القالب الافتراضي
          </Button>
          <span>{(form.whatsappPaymentThankYouTemplate || "").length} حرف</span>
        </div>

        {/* محاكاة الرسالة */}
        <div className="mt-2 rounded-[2rem] bg-emerald-950/20 dark:bg-emerald-950/40 p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <MessageCircle className="w-4 h-4" /> محاكاة رسالة الشكر:
          </div>
          <div className="rounded-2xl bg-card p-3.5 text-xs leading-relaxed border border-emerald-500/20 shadow-sm text-foreground">
            {simulatedText || "اكتب نص القالب للمعاينة..."}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function AlertsTab({ form, set }: TabProps) {
  const insertTemplateVar = (varKey: string) => {
    const current = form.whatsappReminderTemplate || "";
    set("whatsappReminderTemplate", `${current} {${varKey}}`);
  };

  const sampleCustomer = "محمد أحمد";
  const sampleAmount = "1,250 ج.م";
  const sampleDate = "2026-09-01";
  const sampleShop = form.shopName || "محل النور";
  const sampleInv = "INV-1042";

  const simulatedWhatsAppText = (form.whatsappReminderTemplate || "")
    .replace(/\{اسم_العميل\}/g, sampleCustomer)
    .replace(/\{المبلغ_المستحق\}/g, sampleAmount)
    .replace(/\{تاريخ_الاستحقاق\}/g, sampleDate)
    .replace(/\{اسم_المحل\}/g, sampleShop)
    .replace(/\{رقم_الفاتورة\}/g, sampleInv);

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Bell className="w-5 h-5" />}
        title="تنبيهات الأقساط والمديونيات"
        hint="التحكم في مواعيد وقنوات التنبيه بالأقساط المتأخرة والوشيكة."
      >
        <div className="grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black">تفعيل نظام التنبيهات الذكي</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                إظهار شارات التنبيه في القائمة العلوية وشاشات الفواتير
              </p>
            </div>
            <Switch checked={form.alertsEnabled} onCheckedChange={(v) => set("alertsEnabled", v)} />
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">تذكير قبل الاستحقاق بـ</Label>
              <Badge
                variant="secondary"
                className="rounded-xl px-3 py-1 bg-primary/10 text-primary border-none font-black"
              >
                {form.reminderDaysBefore} يوم
              </Badge>
            </div>
            <Slider
              value={[form.reminderDaysBefore]}
              min={0}
              max={30}
              step={1}
              onValueChange={([v]) => set("reminderDaysBefore", v)}
              disabled={!form.alertsEnabled}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">0 = التنبيه في نفس يوم الاستحقاق.</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">حد التأخر الحرج (Critical Overdue)</Label>
              <Badge
                variant="secondary"
                className="rounded-xl px-3 py-1 bg-danger/10 text-danger border-none font-black"
              >
                {form.criticalOverdueDays ?? 15} يوم
              </Badge>
            </div>
            <Slider
              value={[form.criticalOverdueDays ?? 15]}
              min={1}
              max={60}
              step={1}
              onValueChange={([v]) => set("criticalOverdueDays", v)}
              disabled={!form.alertsEnabled}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">
              تمييز الفواتير المتأخرة أكثر من هذه الفترة بلون تحذيري بارز.
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary" /> التنبيهات الصوتية
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تشغيل نغمة خفيفة عند حدوث عمليات بيع أو وصول أقساط حرجة
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={playTestAlert}
                className="rounded-xl h-8 text-xs font-bold px-3"
              >
                تجربة الصوت
              </Button>
              <Switch
                checked={form.audioAlertsEnabled ?? true}
                onCheckedChange={(v) => set("audioAlertsEnabled", v)}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">حد المخزون المنخفض</Label>
              <Badge
                variant="secondary"
                className="rounded-xl px-3 py-1 bg-primary/10 text-primary border-none font-black"
              >
                {form.lowStockThreshold} قطعة
              </Badge>
            </div>
            <Slider
              value={[form.lowStockThreshold]}
              min={0}
              max={50}
              step={1}
              onValueChange={([v]) => set("lowStockThreshold", v)}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">
              إشعارك تلقائياً في حالة انخفاض كمية أي منتج بالمخزن عن هذا الحد.
            </p>
          </div>
        </div>
      </Section>

      <Section
        icon={<MessageCircle className="w-5 h-5 text-emerald-500" />}
        title="محرر قالب رسائل الواتساب"
        hint="صياغة نص رسالة التذكير التي تُرسل للعملاء بضغطة زر واحدة."
      >
        <div className="grid gap-3">
          <Label className="text-xs font-black">المتغيرات الديناميكية المتاحة (اضغط للإضافة):</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { key: "اسم_العميل", label: "اسم العميل" },
              { key: "المبلغ_المستحق", label: "المبلغ المستحق" },
              { key: "تاريخ_الاستحقاق", label: "تاريخ الاستحقاق" },
              { key: "اسم_المحل", label: "اسم المحل" },
              { key: "رقم_الفاتورة", label: "رقم الفاتورة" },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertTemplateVar(v.key)}
                className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                + {`{${v.label}}`}
              </button>
            ))}
          </div>

          <Textarea
            value={form.whatsappReminderTemplate ?? ""}
            onChange={(e) => set("whatsappReminderTemplate", e.target.value)}
            placeholder="اكتب نص رسالة التذكير هنا..."
            rows={4}
            className="rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all p-3.5 text-xs leading-relaxed"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                set(
                  "whatsappReminderTemplate",
                  "السلام عليكم أستاذ {اسم_العميل}، نود تذكيركم بموعد استحقاق قسط بقيمة {المبلغ_المستحق} بتاريخ {تاريخ_الاستحقاق}. مع تحيات {اسم_المحل}.",
                )
              }
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              استعادة القالب الافتراضي
            </Button>
            <span>{(form.whatsappReminderTemplate || "").length} حرف</span>
          </div>

          {/* محاكاة فقاعة الواتساب الحية */}
          <div className="mt-2 rounded-[2rem] bg-emerald-950/20 dark:bg-emerald-950/40 p-4 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-4 h-4" /> محاكاة رسالة التذكير:
            </div>
            <div className="rounded-2xl bg-card p-3.5 text-xs leading-relaxed border border-emerald-500/20 shadow-sm text-foreground">
              {simulatedWhatsAppText || "اكتب نص القالب للمعاينة..."}
            </div>
          </div>
        </div>
      </Section>

      {/* قالب رسالة شكر واستلام الدفعة */}
      <PaymentThankYouTemplateSection form={form} set={set} />
    </div>
  );
}
