import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Palette, Binary, Sparkles } from "lucide-react";
import {
  type ThemeMode,
  type NumeralsFormat,
} from "@/lib/store";
import {
  applyTheme,
  PALETTES_CONFIG,
  storePalette,
  type ColorPalette as LibColorPalette,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { TabProps, Section } from "./shared";

const THEMES: Array<{ value: ThemeMode; label: string; desc: string }> = [
  { value: "dark", label: "الوضع الليلي (غامق)", desc: "الفحمي المريح للعين أثناء العمل الطويل" },
  { value: "light", label: "الوضع النهاري (فاتح)", desc: "خلفية ناصعة بتباين عالٍ ووضوح ساطع" },
  { value: "system", label: "تلقائي حسب الجهاز", desc: "يتماشى مع إعدادات نظام التشغيل" },
];

const NUMERAL_FORMATS: Array<{ value: NumeralsFormat; label: string; preview: string; desc: string }> = [
  {
    value: "latn",
    label: "الأرقام الإنجليزية / اللاتينية",
    preview: "123,456.78",
    desc: "النمط الافتراضي والمفضل لقراءة الحسابات والمبالغ بسلاسة",
  },
  {
    value: "arab",
    label: "الأرقام العربية الشرقية (الهندية)",
    preview: "١٢٣٬٤٥٦٫٧٨",
    desc: "النمط الكلاسيكي للأرقام في المطبوعات العربية التقليدية",
  },
];

export function AppearanceTab({ form, set }: TabProps) {
  const currentPalette = form.colorPalette || "emerald";
  const currentNumerals = form.numeralsFormat || "latn";

  const handlePaletteSelect = (palId: LibColorPalette) => {
    set("colorPalette", palId);
    applyTheme(form.theme, palId);
    storePalette(palId);
    const palette = PALETTES_CONFIG.find((item) => item.id === palId);
    toast.success(`تم تفعيل لوحة ألوان: ${palette?.label || palId}`);
  };

  return (
    <div className="grid gap-6 animate-[fade-in_0.3s_ease-out]">
      <Section
        icon={<Binary className="w-5 h-5 text-primary" />}
        title="نظام تنسيق الأرقام والأسعار (Numeral System)"
        hint="اختر طريقة عرض الأرقام والمبالغ المالية عبر كافة شاشات وجداول ومطبوعات النظام."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {NUMERAL_FORMATS.map((numOpt) => {
            const isSelected = currentNumerals === numOpt.value;
            return (
              <button
                key={numOpt.value}
                type="button"
                onClick={() => {
                  set("numeralsFormat", numOpt.value);
                  toast.success(`تم اختيار: ${numOpt.label}`);
                }}
                className={cn(
                  "text-right rounded-[1.75rem] border-2 p-5 transition-all duration-300 relative overflow-hidden group hover:scale-[1.01] active:scale-[0.99]",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05]",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-black text-foreground">{numOpt.label}</div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-lg font-black text-[10px] px-2 py-0.5",
                      isSelected ? "bg-primary text-black" : "bg-foreground/5 text-muted-foreground",
                    )}
                  >
                    {isSelected ? "مفعّل" : "اختيار"}
                  </Badge>
                </div>
                <div className="text-base font-black text-primary mb-1" dir={numOpt.value === "latn" ? "ltr" : "rtl"}>
                  {numOpt.preview} {form.currency || "ج.م"}
                </div>
                <div className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                  {numOpt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        icon={<Palette className="w-5 h-5" />}
        title="وضع العرض الأساسي"
        hint="اختر بين الوضع الليلي والنهاري أو المزامنة مع إعدادات جهازك."
      >
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                set("theme", t.value);
                applyTheme(t.value, form.colorPalette);
              }}
              className={`text-right rounded-[1.75rem] border-2 p-5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                form.theme === t.value
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05]"
              }`}
            >
              <div className="text-sm font-black mb-1 text-foreground">{t.label}</div>
              <div className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section
        icon={<Sparkles className="w-5 h-5 text-primary" />}
        title="لوحات الألوان العشرة المعتمدة (Color Palettes)"
        hint="اختر لوحة الألوان المميزة لنظامك — يتم تطبيق الألوان الحقيقية فوراً في كامل النظام وتُحفظ تلقائياً."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          {(Object.keys(PALETTES_CONFIG) as LibColorPalette[]).map((palId) => {
            const p = PALETTES_CONFIG.find((item) => item.id === palId);
            if (!p) return null;
            const isSelected = currentPalette === palId;
            return (
              <button
                key={palId}
                type="button"
                onClick={() => handlePaletteSelect(palId)}
                className={cn(
                  "text-right rounded-[1.75rem] border-2 p-4 transition-all duration-300 relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xl shadow-primary/10 ring-2 ring-primary/30"
                    : "border-foreground/5 bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full opacity-60"
                      style={{ backgroundColor: p.hex }}
                    />
                  </div>
                  {isSelected && (
                    <Badge
                      variant="secondary"
                      className="rounded-lg bg-primary text-black font-black text-[9px] px-1.5 py-0.5"
                    >
                      مفعّل
                    </Badge>
                  )}
                </div>

                <div className="text-xs font-black text-foreground mb-0.5">{p.label}</div>
                <div className="text-[10px] text-muted-foreground font-medium truncate">
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          لوحات الألوان مصممة لضمان أعلى مستويات المقروءية والتباين البصري (WCAG AA).
        </p>
      </Section>
    </div>
  );
}
