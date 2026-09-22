import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  Printer,
  KeyRound,
  CheckCircle2,
  MessageCircle,
  Check,
  Copy,
} from "lucide-react";
import {
  useCurrentLicense,
  activateLicenseKey,
  calculateDaysRemaining,
  printLicenseCertificate,
} from "@/lib/licensing";
import { useNavigate } from "@/lib/router-compat";

export function LicenseTab() {
  const { license, refresh } = useCurrentLicense();
  const navigate = useNavigate();
  const [activationKey, setActivationKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { days, isLifetime, isExpired } = calculateDaysRemaining(license.expiryDate);

  const handleActivate = () => {
    if (!activationKey.trim()) {
      toast.error("يرجى إدخال مفتاح التفعيل أولاً");
      return;
    }
    setBusy(true);
    try {
      const res = activateLicenseKey(activationKey);
      if (res.success && res.license) {
        toast.success(res.message);
        refresh();
        setActivationKey("");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل تفعيل الترخيص");
    } finally {
      setBusy(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(license.key);
    setCopied(true);
    toast.success("تم نسخ المفتاح للحافظة");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSupport = () => {
    const text = encodeURIComponent(
      `مرحباً فريق سِجلّي، أحتاج للمساعدة أو التجديد بخصوص ترخيص متجري (${license.shopName}) ومفتاحي: ${license.key}`
    );
    window.open(`https://wa.me/201000000000?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6 max-w-4xl text-right">
      {/* Current License Card */}
      <div className="p-6 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-foreground">{license.tierLabel}</h3>
                {license.status === "active" ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">مرخص وساري</Badge>
                ) : license.status === "trial" ? (
                  <Badge variant="secondary" className="text-amber-600 text-[10px]">فترة تجريبية</Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">منتهي الصلاحية</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                المنشأة المرخصة: <strong>{license.shopName}</strong> ({license.clientName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => printLicenseCertificate(license)}
              className="rounded-2xl h-10 gap-1.5 text-xs font-bold"
            >
              <Printer className="w-4 h-4" />
              طباعة شهادة الترخيص
            </Button>

            <Button
              size="sm"
              onClick={() => navigate("/admin")}
              className="rounded-2xl h-10 px-4 gap-1.5 text-xs font-bold bg-foreground/10 hover:bg-foreground/15 text-foreground"
            >
              <ShieldAlert className="w-4 h-4 text-primary" />
              لوحة السوبر أدمن
            </Button>
          </div>
        </div>

        {/* License Key Display */}
        <div className="p-4 rounded-2xl bg-background/80 border border-foreground/10 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-muted-foreground">مفتاح الترخيص المسجل (License Key):</div>
            <div className="font-mono text-sm font-black text-primary tracking-widest select-all">
              {license.key}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={copyKey}
            className="rounded-xl h-8 text-xs gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "تم النسخ" : "نسخ المفتاح"}
          </Button>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1">
            <span className="text-muted-foreground text-[10px] font-bold">تاريخ التفعيل:</span>
            <div className="font-bold text-foreground">{license.issueDate}</div>
          </div>

          <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1">
            <span className="text-muted-foreground text-[10px] font-bold">تاريخ الانتهاء:</span>
            <div className="font-bold text-foreground">
              {isLifetime ? "مدى الحياة (دائم)" : license.expiryDate}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1">
            <span className="text-muted-foreground text-[10px] font-bold">الأيام المتبقية:</span>
            <div className={`font-bold ${isExpired ? "text-danger" : "text-emerald-600"}`}>
              {isLifetime ? "غير محدود" : isExpired ? "انتهى" : `${days} يوم`}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1">
            <span className="text-muted-foreground text-[10px] font-bold">الفروع المتاحة:</span>
            <div className="font-bold text-foreground">{license.modules.maxBranches} فرع</div>
          </div>
        </div>

        {/* Enabled Features List */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-muted-foreground">الموديولات والصلاحيات المشمولة:</div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "نقاط البيع والكاشير السريع", ok: license.modules.allowPos },
              { label: "إدارة المخازن والباركود", ok: license.modules.allowWarehouse },
              { label: "نظام الأقساط والديون", ok: license.modules.allowInstallments },
              { label: "إرسال إيصالات واتساب", ok: license.modules.allowWhatsApp },
              { label: "الربط متعدد الفروع", ok: license.modules.allowMultiBranch },
            ].map((mod, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className={`text-xs gap-1.5 py-1 px-3 rounded-xl ${
                  mod.ok
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                    : "bg-foreground/5 text-muted-foreground line-through opacity-50"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {mod.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Activate New Key Section */}
      <div className="p-6 rounded-3xl bg-foreground/[0.02] border border-foreground/10 space-y-4">
        <div>
          <h4 className="text-sm font-black text-foreground flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            تفعيل مفتاح ترخيص جديد أو تجديد الاشتراك
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            إذا قمت بشراء ترخيص جديد أو تجديد باقتك، الصق مفتاح التفعيل هنا واضغط على تفعيل.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Input
            placeholder="مثال: SEG-PRO-9842-7719-B31A"
            value={activationKey}
            onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
            className="h-11 rounded-2xl font-mono text-center sm:text-right font-bold text-xs tracking-wider uppercase bg-background"
          />
          <Button
            type="button"
            disabled={busy}
            onClick={handleActivate}
            className="w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-xs bg-primary text-black hover:bg-primary/90 shrink-0"
          >
            تفعيل الترخيص
          </Button>
        </div>
      </div>

      {/* Need Support / Help */}
      <div className="p-4 rounded-3xl bg-primary/[0.03] border border-primary/20 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-primary">هل تحتاج إلى شراء أجهزة أو تجديد ترخيصك؟</div>
          <div className="text-[11px] text-muted-foreground">
            فريق المبيعات والدعم الفني متاح لمساعدتك في توريد طابعات الباركود، أدراج النقدية، وتفعيل الباقات.
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleWhatsAppSupport}
          className="rounded-2xl text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white gap-1.5 h-9"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          تواصل مع المبيعات على واتساب
        </Button>
      </div>
    </div>
  );
}
