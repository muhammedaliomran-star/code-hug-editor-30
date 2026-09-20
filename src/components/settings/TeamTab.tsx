import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Users, Trash2, Mail } from "lucide-react";
import {
  useMyRole,
  useTeam,
  ROLE_LABEL,
  ROLE_HINT,
  ABILITIES,
  relativeTime,
  type AppRole,
} from "@/lib/roles";
import { inviteTeamMember } from "@/lib/team.functions";
import { useServerFn } from "@tanstack/react-start";
import { Section } from "./shared";

const ALL_ROLES: AppRole[] = ["owner", "manager", "seller"];

function RoleBadge({ role, big = false }: { role: AppRole; big?: boolean }) {
  const tone: Record<AppRole, string> = {
    owner: "bg-primary/10 text-primary border-primary/20",
    manager: "bg-info/10 text-info border-info/20",
    seller: "bg-foreground/5 text-muted-foreground border-foreground/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border font-black uppercase tracking-widest ${tone[role]} ${big ? "px-5 py-2 text-xs" : "px-3 py-1.5 text-[9px]"}`}
    >
      <ShieldCheck className={big ? "w-4 h-4" : "w-3 h-3"} />
      {ROLE_LABEL[role]}
    </span>
  );
}
export function TeamTab() {
  const { role: myRole, isOwner, loading: roleLoading, reload: reloadRole } = useMyRole();
  const { members, invites, loading, setRole, removeMember, revokeInvite, reload } = useTeam();
  const [removing, setRemoving] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("seller");
  const [sending, setSending] = useState(false);
  const sendInvite = useServerFn(inviteTeamMember);
  const pending = invites.filter((i) => i.status === "pending");

  const submitInvite = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("اكتب بريد إلكتروني صحيح");
      return;
    }
    setSending(true);
    try {
      const res = await sendInvite({
        data: {
          email: parsed.data,
          role: inviteRole,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
        },
      });
      if (res.status === "added") toast.success("الحساب موجود بالفعل — تمت إضافته للفريق");
      else if (res.status === "pending_no_email")
        toast.success("تم تسجيل الدعوة — لكن تعذر إرسال رسالة البريد");
      else toast.success("تم إرسال رابط الدعوة إلى البريد الإلكتروني");
      setInviteOpen(false);
      setEmail("");
      setInviteRole("seller");
      await Promise.all([reload(), reloadRole()]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذّر إرسال الدعوة");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <Section
        icon={<ShieldCheck className="w-5 h-5" />}
        title="مستوى صلاحياتك في النظام"
        hint="تحديد الصلاحيات المتاحة للمالك والمدير والبائع في النظام."
      >
        {roleLoading ? (
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 p-6 rounded-[2rem] bg-primary/[0.03] border border-primary/10">
              {myRole ? (
                <RoleBadge role={myRole} big />
              ) : (
                <span className="rounded-xl bg-foreground/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground border border-foreground/10">
                  بدون صلاحية
                </span>
              )}
              <span className="text-xs font-bold text-muted-foreground leading-relaxed">
                {myRole ? ROLE_HINT[myRole] : "لم يتم العثور على صلاحيات مسجلة لحسابك حالياً."}
              </span>
            </div>

            <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
              <div className="overflow-x-auto rounded-[calc(2.5rem-0.5rem)] bg-card border border-white/5 shadow-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-foreground/[0.02]">
                      <th className="py-4 px-6 text-right">وظائف وقدرات النظام</th>
                      {ALL_ROLES.map((r) => (
                        <th key={r} className="py-4 px-4 whitespace-nowrap">
                          {ROLE_LABEL[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ABILITIES.map((a) => (
                      <tr
                        key={a.label}
                        className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.01] transition-colors"
                      >
                        <td className="py-3.5 px-6 text-right font-bold text-xs">{a.label}</td>
                        {ALL_ROLES.map((r) => {
                          const ok = a.roles.includes(r);
                          return (
                            <td
                              key={r}
                              className={`py-3.5 px-4 text-center ${myRole === r ? "bg-primary/[0.03]" : ""}`}
                            >
                              <span
                                className={
                                  ok ? "text-emerald-500 font-black text-base" : "text-muted-foreground/25"
                                }
                              >
                                {ok ? "✓" : "✗"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section
        icon={<Users className="w-5 h-5" />}
        title="أعضاء الفريق المشتركين"
        hint={
          isOwner
            ? "بصفتك المالك، يمكنك دعوة مستخدمين جدد وتعديل صلاحيات الفريق."
            : "المالك فقط هو المخول بدعوة وتعديل الصلاحيات."
        }
      >
        {isOwner && (
          <div className="mb-4 flex justify-start">
            <Button
              onClick={() => setInviteOpen(true)}
              className="rounded-2xl px-6 h-11 gap-2 bg-primary text-black font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Mail className="w-4 h-4" /> دعوة عضو جديد
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-[2.5rem] bg-foreground/[0.02] p-2 border border-foreground/5 shadow-inner">
            <div className="rounded-[calc(2.5rem-0.5rem)] bg-card px-6 py-12 text-center border border-white/5 shadow-xl">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </span>
              <p className="font-semibold">لا يوجد أعضاء مضافون في الفريق حتى الآن</p>
              <p className="mt-1 text-xs text-muted-foreground">
                أرسل دعوة بالبريد الإلكتروني وحدد صلاحيات المستخدم.
              </p>
              {isOwner && (
                <Button
                  onClick={() => setInviteOpen(true)}
                  className="mt-5 rounded-2xl px-8 h-11 bg-primary text-black font-black shadow-lg shadow-primary/20"
                >
                  دعوة عضو
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="rounded-[2rem] bg-foreground/[0.02] p-2 border border-foreground/5 transition-all hover:border-primary/20"
              >
                <div className="rounded-[calc(2rem-0.5rem)] bg-card p-4 flex items-center justify-between gap-4 border border-white/5 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-2xl object-cover ring-1 ring-foreground/10"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary grid place-items-center font-black text-xs">
                        {m.displayName.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-black text-sm tracking-tight truncate text-foreground">
                        {m.displayName}
                        {m.isMe ? " (أنت)" : ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        آخر ظهور: {relativeTime(m.lastSeenAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner && !m.isMe ? (
                      <Select
                        value={m.role}
                        onValueChange={async (v) => {
                          try {
                            await setRole(m.userId, v as AppRole);
                            toast.success("تم تحديث صلاحية العضو");
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "خطأ");
                          }
                        }}
                      >
                        <SelectTrigger className="w-32 h-9 rounded-xl bg-foreground/[0.03] border-none font-bold text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {isOwner && !m.isMe && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="إزالة العضو"
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setRemoving(m.userId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && pending.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
              دعوات قيد الانتظار
            </p>
            <div className="space-y-2">
              {pending.map((iv) => (
                <div
                  key={iv.id}
                  className="rounded-[1.75rem] border border-dashed border-foreground/10 p-4 flex items-center justify-between gap-4 bg-foreground/[0.01]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-black text-xs">{iv.email}</div>
                    <div className="text-[10px] text-muted-foreground">
                      تنتهي في: {new Date(iv.expiresAt).toLocaleDateString("en-US")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RoleBadge role={iv.role} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl h-9 text-xs font-bold text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      onClick={async () => {
                        try {
                          await revokeInvite(iv.id);
                          toast.success("تم إلغاء الدعوة بنجاح");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "خطأ");
                        }
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* مودال دعوة عضو جديد */}
      <AlertDialog open={inviteOpen} onOpenChange={(v) => !v && setInviteOpen(false)}>
        <AlertDialogContent
          dir="rtl"
          className="rounded-[2.5rem] border-foreground/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight">
              دعوة عضو جديد لفريق العمل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-muted-foreground leading-relaxed">
              سيتم إرسال دعوة رسمية عبر البريد الإلكتروني لتفعيل حساب العضو وتعيين صلاحياته.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-right">
            <div className="space-y-2">
              <Label className="text-xs font-bold">البريد الإلكتروني</Label>
              <Input
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">الدور والصلاحية</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="font-bold text-xs">
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground px-1">{ROLE_HINT[inviteRole]}</p>
            </div>
          </div>
          <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
            <AlertDialogCancel
              disabled={sending}
              className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold"
            >
              إلغاء
            </AlertDialogCancel>
            <Button
              onClick={submitInvite}
              disabled={sending}
              className="rounded-2xl bg-primary h-12 px-8 font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              {sending ? "جاري الإرسال…" : "إرسال الدعوة"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* مودال إزالة عضو */}
      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent
          dir="rtl"
          className="rounded-[2.5rem] border-danger/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight text-danger">
              إزالة العضو من الفريق؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-muted-foreground leading-relaxed">
              سيتم سحب جميع الصلاحيات الممنوحة لهذا العضو فوراً ولن يتمكن من الدخول إلى النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
            <AlertDialogCancel className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold text-xs">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-danger h-12 px-8 font-black text-white transition-all hover:bg-danger/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-danger/20 text-xs"
              onClick={async () => {
                try {
                  await removeMember(removing!);
                  toast.success("تمت إزالة العضو بنجاح");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "خطأ");
                }
                setRemoving(null);
              }}
            >
              تأكيد الإزالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
