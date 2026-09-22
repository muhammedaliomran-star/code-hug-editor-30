import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  useShopSettings,
  saveShopSettings,
  type ShopSettings,
} from "@/lib/store";
import { applyTheme, storePalette, type ColorPalette as LibColorPalette } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Settings as SettingsIcon, Save, Store, Receipt, Bell, Palette, ShieldCheck, Users, ShoppingBag, KeyRound, Database } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";
import { z } from "zod";
import { useMyRole } from "@/lib/roles";
import {
  ShopTab,
  BillingTab,
  AlertsTab,
  AppearanceTab,
  LicenseTab,
  TeamTab,
  IntegrationsTab,
  AccountTab,
  DataTab,
} from "@/components/settings";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <SettingsPage />
      </PageTransition>
    </AppShell>
  );
}

const shopSchema = z.object({
  shopName: z.string().trim().max(80, "اسم المحل طويل جداً"),
  phone: z.string().trim().max(30, "رقم التليفون طويل جداً"),
  whatsapp: z.string().trim().max(30, "رقم الواتساب طويل جداً"),
  address: z.string().trim().max(200, "العنوان طويل جداً"),
  taxNumber: z.string().trim().max(40, "الرقم الضريبي طويل جداً"),
  logoUrl: z.string().trim().max(400000).nullable(),
  footerNote: z.string().trim().max(300, "الملاحظة طويلة جداً"),
  currency: z.string().trim().min(1, "اكتب رمز العملة").max(10, "رمز العملة طويل"),
  invoicePrefix: z.string().trim().max(10, "البادئة 10 حروف كحد أقصى"),
  lowStockThreshold: z.number().int().min(0).max(999),
  defaultInstallmentMonths: z
    .number()
    .int()
    .min(1, "شهر واحد على الأقل")
    .max(60, "60 شهر كحد أقصى"),
  defaultDueDay: z.number().int().min(1).max(28),
  reminderDaysBefore: z.number().int().min(0).max(30),
  printPaper: z.enum(["a4", "thermal"]),
  theme: z.enum(["dark", "light", "system"]),
  alertsEnabled: z.boolean(),
  // Extended fields
  commercialRegister: z.string().trim().max(50, "السجل التجاري طويل جداً").optional(),
  email: z.string().trim().max(100).optional(),
  website: z.string().trim().max(200).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  enableVat: z.boolean().optional(),
  warrantyPolicy: z.string().trim().max(500, "شروط الضمان طويلة جداً").optional(),
  autoPrintOnSave: z.boolean().optional(),
  thermalShowBarcode: z.boolean().optional(),
  thermalShowHeader: z.boolean().optional(),
  whatsappReminderTemplate: z.string().trim().max(600).optional(),
  whatsappPaymentThankYouTemplate: z.string().trim().max(600).optional(),
  criticalOverdueDays: z.number().int().min(1).max(180).optional(),
  audioAlertsEnabled: z.boolean().optional(),
  colorPalette: z.enum(["emerald", "amber", "sapphire", "violet", "rose", "orchid", "ocean", "bronze", "lime", "charcoal"]).optional(),
  numeralsFormat: z.enum(["latn", "arab"]).optional(),
  autoBackupFrequency: z.enum(["off", "weekly", "monthly"]).optional(),
  customExpenseCategories: z.array(z.string().trim()).optional(),
  // Commercial POS & Security Settings
  managerPin: z.string().trim().max(10).optional(),
  maxDiscountWithoutPin: z.number().min(0).max(100).optional(),
  hideCostAndProfitsFromCashier: z.boolean().optional(),
  preventInvoiceDeletionWithoutPin: z.boolean().optional(),
  openCashDrawerOnPrint: z.boolean().optional(),
  thermalPaperWidth: z.enum(["80mm", "58mm"]).optional(),
});

function SettingsPage() {
  const { settings, loading } = useShopSettings();
  // Phase 1 (#15): sellers don't see the backup/restore tab (server gate enforces)
  const { role } = useMyRole();
  const showDataTab = (role ?? "owner") !== "seller";
  const navigate = useNavigate();
  const [form, setForm] = useState<ShopSettings>(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    applyTheme(form.theme, form.colorPalette);
  }, [form.theme, form.colorPalette]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(settings), [form, settings]);

  const set = useCallback(
    <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => setForm((f) => ({ ...f, [k]: v })),
    [],
  );

  const save = async () => {
    const parsed = shopSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await saveShopSettings({ ...form, ...parsed.data });
      if (form.colorPalette) {
        storePalette(form.colorPalette as LibColorPalette);
      }
      toast.success("تم حفظ جميع الإعدادات بنجاح");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="text-right">
      <PageHeader
        title="الإعدادات الشاملة"
        subtitle="بيانات المحل، الفواتير والضرائب، التنبيهات والواتساب، المظهر ولوحات الألوان، الفريق، والبيانات."
        icon={<SettingsIcon className="w-7 h-7 text-primary" />}
      />

      <Tabs defaultValue="shop" dir="rtl" className="w-full text-right">
        {/* شريط التنقل الملتصق بتأثير بلوري */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/70 backdrop-blur-xl border-b border-foreground/5 mb-8">
          <TabsList
            dir="rtl"
            className="h-auto w-full bg-transparent justify-start gap-2 border-none p-0 rounded-none overflow-x-auto custom-scrollbar no-scrollbar"
          >
            {[
              { value: "shop", label: "المحل والنشاط", icon: Store },
              { value: "billing", label: "الفواتير والطباعة", icon: Receipt },
              { value: "alerts", label: "التنبيهات والواتساب", icon: Bell },
              { value: "appearance", label: "المظهر والألوان", icon: Palette },
              { value: "license", label: "الترخيص والاشتراك", icon: ShieldCheck },
              { value: "team", label: "الفريق والصلاحيات", icon: Users },
              { value: "integrations", label: "المتجر والشحن", icon: ShoppingBag },
              { value: "account", label: "الحساب والأمان", icon: KeyRound },
              // Phase 1 (#15): backup/restore UI is owner+manager only (server gate is the real enforcement)
              ...(showDataTab ? [{ value: "data", label: "البيانات والنسخ", icon: Database }] : []),
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative h-11 px-5 gap-2 rounded-2xl border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300 font-bold opacity-75 data-[state=active]:opacity-100 hover:opacity-100 whitespace-nowrap"
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="shop">
          <ShopTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="license">
          <LicenseTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab
            onSignOut={async () => {
              await supabase.auth.signOut();
              navigate("/landing");
            }}
          />
        </TabsContent>
        {showDataTab && (
          <TabsContent value="data">
            <DataTab form={form} set={set} />
          </TabsContent>
        )}
      </Tabs>

      <div className="sticky bottom-4 mt-12 z-20 mx-auto max-w-2xl px-4">
        <div className="plate-glow flex items-center justify-between gap-6 rounded-[2rem] border border-primary/20 bg-background/85 p-3 backdrop-blur-xl shadow-2xl shadow-primary/10">
          <div className="flex items-center gap-3 px-3">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full animate-pulse",
                dirty ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {dirty ? "هناك تعديلات غير محفوظة" : "جميع التعديلات محفوظة"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty || busy}
              onClick={() => setForm(settings)}
              className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              تراجع
            </Button>
            <Button
              onClick={save}
              disabled={!dirty || busy}
              className="h-11 px-8 gap-2 rounded-2xl bg-primary text-black font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save className="w-4 h-4" /> {busy ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
