import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMyStorefront, saveStorefront, getPaymentConfig, savePaymentConfig, type Storefront, type StorefrontPaymentConfig } from "@/lib/storefront";
import { addStorefrontDomain, getStorefrontDomains, type StorefrontDomain } from "@/lib/storefront-domains";
import { Globe2, Loader2, Palette, Save, Store, CreditCard, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function StorefrontSettings() {
  const [shop, setShop] = useState<Storefront | null>(null); const [form, setForm] = useState({ banner_url: "", theme_key: "emerald", seo_title: "", seo_description: "", minimum_order: "0", facebook: "", instagram: "", whatsapp: "" }); const [domain, setDomain] = useState(""); const [domains, setDomains] = useState<StorefrontDomain[]>([]); const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<"general" | "payment">("general");
  const [paymentForm, setPaymentForm] = useState({ secret_key: "", public_key: "", hmac_secret: "", integration_id_card: "", integration_id_wallet: "" });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => { (async () => { try { const value = await getMyStorefront(); setShop(value); if (value) { setForm({ banner_url: value.banner_url ?? "", theme_key: value.theme_key ?? "emerald", seo_title: value.seo_title ?? "", seo_description: value.seo_description ?? "", minimum_order: String(value.minimum_order ?? 0), facebook: value.social_links?.facebook ?? "", instagram: value.social_links?.instagram ?? "", whatsapp: value.social_links?.whatsapp ?? "" }); setDomains(await getStorefrontDomains(value.id)); } const pc = await getPaymentConfig(); if (pc) setPaymentForm({ secret_key: pc.secret_key ?? "", public_key: pc.public_key ?? "", hmac_secret: pc.hmac_secret ?? "", integration_id_card: pc.integration_id_card ? String(pc.integration_id_card) : "", integration_id_wallet: pc.integration_id_wallet ? String(pc.integration_id_wallet) : "" }); } catch (error: any) { toast.error(error.message ?? "تعذر تحميل الإعدادات"); } finally { setBusy(false); } })(); }, []);
  const save = async () => { if (!shop) return; try { const value = await saveStorefront({ ...shop, ...form, minimum_order: Number(form.minimum_order) || 0, social_links: { facebook: form.facebook, instagram: form.instagram, whatsapp: form.whatsapp } }); setShop(value); toast.success("اتحفظت إعدادات المتجر"); } catch (error: any) { toast.error(error.message ?? "تعذر الحفظ"); } };
  const addDomain = async () => { if (!shop || !domain.trim()) return; try { const value = await addStorefrontDomain(shop.id, domain); setDomains((current) => [value, ...current]); setDomain(""); toast.success("اتضاف الدومين، أكمل التحقق من DNS"); } catch (error: any) { toast.error(error.message ?? "تعذر إضافة الدومين"); } };

  const savePayment = async () => {
    setPaymentLoading(true);
    try {
      const cardId = Number(paymentForm.integration_id_card);
      if (!paymentForm.secret_key.trim() || !paymentForm.public_key.trim() || !cardId) {
        throw new Error("ملي كلالحقول المطلوبة: Secret Key + Public Key + Integration ID");
      }
      await savePaymentConfig({
        secretKey: paymentForm.secret_key.trim(),
        publicKey: paymentForm.public_key.trim(),
        hmacSecret: paymentForm.hmac_secret.trim(),
        integrationIdCard: cardId,
        integrationIdWallet: paymentForm.integration_id_wallet ? Number(paymentForm.integration_id_wallet) : undefined,
      });
      toast.success("اتحفظت إعدادات الدفع الإلكتروني");
    } catch (error: any) { toast.error(error.message ?? "تعذر حفظ إعدادات الدفع"); }
    finally { setPaymentLoading(false); }
  };

  if (busy) return <AppShell><div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></div></AppShell>;
  return <AppShell><div dir="rtl" className="space-y-6 pb-20">
    <PageHeader title="إعدادات المتجر" subtitle="الهوية والظهور والدومين المخصص." icon={<Store className="h-7 w-7" />} />
    <div className="flex gap-2 px-1">
      <Button variant={tab === "general" ? "default" : "outline"} size="sm" onClick={() => setTab("general")}><Palette className="h-4 w-4" /> عام</Button>
      <Button variant={tab === "payment" ? "default" : "outline"} size="sm" onClick={() => setTab("payment")}><CreditCard className="h-4 w-4" /> الدفع الإلكتروني</Button>
    </div>
    {tab === "general" && <div className="grid gap-5 lg:grid-cols-2">
      <BezelCard className="p-6"><div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><h2 className="font-bold">الهوية والظهور</h2></div><div className="mt-5 grid gap-4"><Field label="رابط البانر" value={form.banner_url} onChange={(banner_url) => setForm({ ...form, banner_url })} /><div><Label>الثيم</Label><select value={form.theme_key} onChange={(event) => setForm({ ...form, theme_key: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3"><option value="emerald">Emerald</option><option value="copper">Copper</option><option value="blue">Blue</option></select></div><Field label="الحد الأدنى للطلب" value={form.minimum_order} onChange={(minimum_order) => setForm({ ...form, minimum_order })} /><Field label="عنوان SEO" value={form.seo_title} onChange={(seo_title) => setForm({ ...form, seo_title })} /><div><Label>وصف SEO</Label><Textarea value={form.seo_description} onChange={(event) => setForm({ ...form, seo_description: event.target.value })} className="mt-2" /></div><Field label="Facebook" value={form.facebook} onChange={(facebook) => setForm({ ...form, facebook })} /><Field label="Instagram" value={form.instagram} onChange={(instagram) => setForm({ ...form, instagram })} /><Field label="WhatsApp" value={form.whatsapp} onChange={(whatsapp) => setForm({ ...form, whatsapp })} /></div><Button className="mt-5" onClick={() => void save()}><Save className="h-4 w-4" /> حفظ الإعدادات</Button></BezelCard>
      <BezelCard className="p-6"><div className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /><h2 className="font-bold">الدومين المخصص</h2></div><div className="mt-5 flex gap-2"><Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="shop.example.com" /><Button onClick={() => void addDomain()}>إضافة</Button></div>{domains.length > 0 && <div className="mt-4 grid gap-2">{domains.map((d) => <div key={d.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span dir="ltr" className="font-mono">{d.domain}</span><span className={`rounded-full px-2 py-0.5 text-xs ${d.status === "active" ? "bg-emerald-100 text-emerald-700" : d.status === "disabled" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>{d.status}</span></div>)}</div>}
        {domains.length === 0 && <p className="mt-4 text-sm text-muted-foreground">مفيش دومينات مخصصة لسه.</p>}
      </BezelCard>
    </div>}
    {tab === "payment" && <div className="max-w-2xl">
      <BezelCard className="p-6">
        <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h2 className="font-bold">إعدادات الدفع الإلكتروني — Paymob</h2></div>
        <p className="mt-2 text-sm text-muted-foreground">ادخل بيانات حساب Paymob بتاعك عشان تفعّل الدفع بالكارت والمحفظة الإلكترونية على المتجر. البيانات محفوظة في قاعدة البيانات وأمانها على السيرفر بس.</p>
        <div className="mt-5 grid gap-4">
          <SecretField label="Secret Key" value={paymentForm.secret_key} show={showSecrets} onChange={(v) => setPaymentForm({ ...paymentForm, secret_key: v })} placeholder="sk_test_..." />
          <SecretField label="Public Key" value={paymentForm.public_key} show={showSecrets} onChange={(v) => setPaymentForm({ ...paymentForm, public_key: v })} placeholder="pk_test_..." />
          <SecretField label="HMAC Secret (اختياري)" value={paymentForm.hmac_secret} show={showSecrets} onChange={(v) => setPaymentForm({ ...paymentForm, hmac_secret: v })} placeholder="الsovgr..." />
          <Field label="Integration ID — كارتات" value={paymentForm.integration_id_card} onChange={(v) => setPaymentForm({ ...paymentForm, integration_id_card: v })} placeholder="123456" />
          <Field label="Integration ID — محفظة (اختياري)" value={paymentForm.integration_id_wallet} onChange={(v) => setPaymentForm({ ...paymentForm, integration_id_wallet: v })} placeholder="123457" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={() => void savePayment()} disabled={paymentLoading}>{paymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ إعدادات الدفع</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)}>{showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        </div>
      </BezelCard>
    </div>}
  </div></AppShell>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <div><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2" /></div>; }

function SecretField({ label, value, show, onChange, placeholder }: { label: string; value: string; show: boolean; onChange: (value: string) => void; placeholder?: string }) {
  return <div><Label>{label}</Label><div className="relative mt-2"><Input type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pr-10" /></div></div>;
}
