import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Truck,
  Receipt,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "@/lib/router-compat";

export function IntegrationsTab() {
  const navigate = useNavigate();

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-[fade-in_0.3s_ease-out]">
      <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black tracking-tight mb-1">المتجر الإلكتروني (Storefront)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            تخصيص هوية ورابط متجرك الإلكتروني للبيع أونلاين، واستقبال طلبات الزبائن مباشرة في النظام.
          </p>
        </div>
        <Button
          onClick={() => navigate("/storefront/settings")}
          className="w-full gap-2 rounded-2xl bg-primary text-black font-black h-11 shadow-md shadow-primary/10"
        >
          <ExternalLink className="w-4 h-4" /> إعدادات المتجر الإلكتروني
        </Button>
      </div>

      <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-info/10 text-info grid place-items-center mb-4">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black tracking-tight mb-1">شركات الشحن وبوليصات التوصيل</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            إدارة شركات الشحن (بوسطة، أرامكس، مندوب خاص)، طباعة بوليصات الشحن، ومتابعة التحصيلات والتسويات.
          </p>
        </div>
        <Button
          onClick={() => navigate("/carriers")}
          variant="secondary"
          className="w-full gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 font-black h-11"
        >
          <ExternalLink className="w-4 h-4" /> إدارة الشحن والتوصيل
        </Button>
      </div>

      <div className="rounded-[2.5rem] bg-card/60 backdrop-blur-md border border-foreground/5 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center mb-4">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black tracking-tight mb-1">نقطة البيع السريعة (POS)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            كاشير نقطة البيع السريع مع دعم قارئ الباركود واللمس وإصدار الإيصالات الحرارية في ثوانٍ.
          </p>
        </div>
        <Button
          onClick={() => navigate("/pos")}
          variant="secondary"
          className="w-full gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 font-black h-11"
        >
          <ExternalLink className="w-4 h-4" /> فتح كاشير نقطة البيع
        </Button>
      </div>
    </div>
  );
}
