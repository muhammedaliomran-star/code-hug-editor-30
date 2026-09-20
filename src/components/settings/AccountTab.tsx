import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Mail,
  UserRound,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/store";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserChip";
import { Section, Field, shrinkImage } from "./shared";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "غير معروف");

function useAccount() {
  const p = useProfile();
  return { ...p, hasPassword: p.user?.hasPassword ?? false };
}

function LineSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="block h-9 animate-pulse rounded-2xl bg-foreground/[0.06]" />
      ))}
    </div>
  );
}

function providerLabel(p: string) {
  if (p === "google") return "جوجل";
  if (p === "email") return "بريد وكلمة سر";
  return p;
}

function IdentityCard({ onSignOut }: { onSignOut: () => void }) {
  const { user, label, avatar, profile, save, loading } = useProfile();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile.displayName || user?.metaName || "");
  }, [profile.displayName, user?.metaName]);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختار صورة صحيحة");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً (أقصى حد 8 ميجابايت)");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await shrinkImage(file);
      await save({ avatarUrl: dataUrl });
      toast.success("تم تحديث صورتك بنجاح");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر رفع الصورة");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      await save({ avatarUrl: null });
      toast.success("تم حذف الصورة الشخصية");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length > 60) {
      toast.error("الاسم طويل جداً");
      return;
    }
    setBusy(true);
    try {
      await save({ displayName: trimmed });
      toast.success("تم تحديث اسم العرض");
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      icon={<UserRound className="w-5 h-5" />}
      title="هويتك الشخصية"
      hint="الحساب المسجل دخوله حالياً على هذا الجهاز."
    >
      {loading ? (
        <LineSkeleton rows={4} />
      ) : !user ? (
        <p className="text-sm text-muted-foreground">لا يوجد حساب مسجل دخوله حالياً.</p>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
            <div className="flex items-center gap-5 rounded-[calc(2.5rem-0.5rem)] bg-card p-6 backdrop-blur-md shadow-xl border border-white/5">
              <UserAvatar size={58} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-black leading-tight text-foreground">
                  {label || "بدون اسم"}
                </div>
                <div dir="ltr" className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {user.email ?? "—"}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(user.providers.length ? user.providers : ["unknown"]).map((p: string) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className="rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] bg-foreground/10 border-none"
                    >
                      {providerLabel(p)}
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className={`rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] border-none ${
                      user.emailConfirmed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {user.emailConfirmed ? (
                      <>
                        <ShieldCheck className="mr-1 h-3 w-3" /> مؤكد
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="mr-1 h-3 w-3" /> غير مؤكد
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold">اسم العرض</Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setEditing(true);
                }}
                placeholder={user.metaName ?? "اكتب اسمك"}
                maxLength={60}
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
              <Button
                onClick={submit}
                disabled={busy || !editing}
                variant="secondary"
                className="h-11 shrink-0 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
              >
                <Save className="h-4 w-4 opacity-60" /> حفظ
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold">صورتك الشخصية</Label>
            <div className="flex items-center gap-3">
              <UserAvatar size={48} />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickAvatar(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
              >
                <UserRound className="h-4 w-4 opacity-60" />{" "}
                {uploading ? "جاري الرفع..." : avatar ? "تغيير الصورة" : "رفع صورة"}
              </Button>
              {profile.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={uploading}
                  onClick={removeAvatar}
                  className="text-danger font-bold"
                >
                  حذف
                </Button>
              ) : null}
            </div>
          </div>

          <Separator />

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-foreground/[0.04] p-3">
              <dt className="mb-1 block text-[11px] text-muted-foreground">تاريخ إنشاء الحساب</dt>
              <dd className="font-medium">{fmtDate(user.createdAt)}</dd>
            </div>
            <div className="rounded-2xl bg-foreground/[0.04] p-3">
              <dt className="mb-1 block text-[11px] text-muted-foreground">آخر تسجيل دخول</dt>
              <dd className="font-medium">{fmtDate(user.lastSignInAt)}</dd>
            </div>
          </dl>

          <Button
            variant="outline"
            className="w-full gap-2 text-danger border-danger/20 hover:bg-danger/10 font-bold h-11 rounded-2xl transition-all"
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4" /> تسجيل الخروج من النظام
          </Button>
        </div>
      )}
    </Section>
  );
}

function ChangeEmail() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("بريد إلكتروني غير صالح");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("تم إرسال رابط تأكيد إلى البريد الجديد");
      setEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر تغيير البريد");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label className="text-xs font-bold">البريد الجديد</Label>
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        placeholder="new@email.com"
        type="email"
        className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
      />
      <p className="rounded-2xl bg-amber-500/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
        سيتم إرسال رسالة تأكيد للبريد الجديد، ويجب النقر على الرابط لتأكيد الملكية.
      </p>
      <Button
        type="submit"
        variant="secondary"
        disabled={busy}
        className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
      >
        <Mail className="w-4 h-4 opacity-60" /> {busy ? "جاري الإرسال..." : "تأكيد تغيير البريد"}
      </Button>
    </form>
  );
}

function ChangePassword({ mode = "change" }: { mode?: "change" | "add" }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = pwStrength(pw);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (pw !== pw2) {
      toast.error("كلمتا السر غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("تم تحديث كلمة المرور بنجاح");
      setPw("");
      setPw2("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر التغيير");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="كلمة السر الجديدة">
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          dir="ltr"
          placeholder="••••••••"
          maxLength={72}
          className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
        />
      </Field>
      {pw ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strength.cls}`}
              style={{ width: `${strength.pct}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{strength.label}</span>
        </div>
      ) : null}
      <Field label="تأكيد كلمة السر">
        <Input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          dir="ltr"
          placeholder="••••••••"
          maxLength={72}
          className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        disabled={busy}
        className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all px-6 font-bold"
      >
        <KeyRound className="w-4 h-4 opacity-60" />{" "}
        {busy ? "جاري الحفظ..." : mode === "add" ? "إضافة كلمة مرور" : "تحديث كلمة المرور"}
      </Button>
    </form>
  );
}

function pwStrength(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { pct: 33, cls: "bg-danger", label: "ضعيفة" };
  if (score === 3) return { pct: 66, cls: "bg-warning", label: "متوسطة" };
  return { pct: 100, cls: "bg-success", label: "قوية جداً" };
}

export function AccountTab({ onSignOut }: { onSignOut: () => void }) {
  const { user, authReady, hasPassword } = useAccount();
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <IdentityCard onSignOut={onSignOut} />
      <div className="grid gap-6">
        <Section
          icon={<KeyRound className="w-5 h-5" />}
          title={hasPassword ? "كلمة المرور" : "إضافة كلمة مرور"}
          hint="تأمين حسابك وحماية بيانات العمليات المالية."
        >
          {authReady ? (
            <ChangePassword mode={hasPassword ? "change" : "add"} />
          ) : (
            <LineSkeleton rows={3} />
          )}
        </Section>

        {user?.provider === "google" ? null : (
          <Section
            icon={<Mail className="w-5 h-5" />}
            title="البريد الإلكتروني"
            hint="تحديث وسيلة التواصل الأساسية مع الحساب."
          >
            <ChangeEmail />
          </Section>
        )}
      </div>
    </div>
  );
}
