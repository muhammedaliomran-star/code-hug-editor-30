import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Database,
  Upload,
  Trash2,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
  ShieldAlert,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  downloadExcelBackup,
  downloadJsonBackup,
  downloadAccountingAuditLog,
  resetInventoryStock,
  resetCustomerOpeningBalances,
  dataCounts,
  restoreJsonBackup,
  validateBackupDeep,
  wipeAllData,
} from "@/lib/backup";
import { verifyManagerPinAsync } from "@/lib/security";
import { recordAuditLog, type AuditActionType, type AuditSeverity } from "@/lib/audit";
import { fmt, type AutoBackupFrequency } from "@/lib/store";
import { TabProps, Section, Field } from "./shared";
const TABLE_LABELS: Record<string, string> = {
  customers: "العملاء",
  suppliers: "الموردين",
  invoices: "فواتير البيع",
  invoice_items: "أصناف الفواتير",
  payments: "الدفعات والتحصيلات",
  purchases: "فواتير الشراء",
  purchase_items: "أصناف الشراء",
  supplier_payments: "مدفوعات الموردين",
  stock_items: "أصناف المخزن",
  stock_adjustments: "تسويات المخزن",
  expenses: "المصروفات",
};

export function DataTab({ form, set }: TabProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoreInput, setRestoreInput] = useState<HTMLInputElement | null>(null);

  // Selective resets confirmation state
  const [selectiveResetType, setSelectiveResetType] = useState<"stock" | "balances" | null>(null);

  // Phase 0 (#15): restore preview — validated payload awaiting explicit confirmation
  const [restorePreview, setRestorePreview] = useState<{
    payload: unknown;
    tableCount: number;
    totalRows: number;
  } | null>(null);

  // Phase 2 (#15): manager-PIN re-auth, valid 10 minutes (session only)
  const [pin, setPin] = useState("");
  const REAUTH_TTL_MS = 10 * 60 * 1000;
  const REAUTH_KEY = "segilly_backup_reauth_at";
  const isReauthFresh = () => {
    try {
      return Date.now() - Number(sessionStorage.getItem(REAUTH_KEY) ?? 0) < REAUTH_TTL_MS;
    } catch {
      return false;
    }
  };
  const ensureReauth = async (): Promise<boolean> => {
    if (isReauthFresh()) return true;
    if (!pin.trim()) {
      toast.error("أدخل PIN المدير للمتابعة");
      return false;
    }
    const ok = await verifyManagerPinAsync(pin);
    if (!ok) {
      toast.error("PIN المدير غير صحيح");
      return false;
    }
    try {
      sessionStorage.setItem(REAUTH_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    return true;
  };

  const load = useCallback(() => {
    dataCounts()
      .then(setCounts)
      .catch(() => setCounts({}));
  }, []);

  useEffect(load, [load]);

  const run = async (
    key: string,
    fn: () => Promise<unknown>,
    ok: string,
    audit?: { action: AuditActionType; title: string; severity?: AuditSeverity; details?: string },
  ) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      if (audit) {
        try {
          await recordAuditLog({
            action: audit.action,
            module: "settings",
            severity: audit.severity ?? "info",
            title: audit.title,
            details: audit.details,
          });
        } catch {
          // Audit is best-effort — never block the user flow
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "حصلت مشكلة");
    } finally {
      setBusy(null);
    }
  };

  // Phase 0 (#15): audited restore with explicit confirmation
  const confirmRestore = async () => {
    if (!restorePreview || busy !== null) return;
    // Phase 2 (#15): fresh manager-PIN re-auth before writing
    if (!(await ensureReauth())) return;
    setBusy("restore");
    try {
      const report = await restoreJsonBackup(restorePreview.payload);
      toast.success(
        `تم الاسترجاع: ${report.inserted} سجل، وتم تخطي ${report.skipped} سجل`,
      );
      if (report.failed.length > 0)
        toast.error(`تعذر استرجاع ${report.failed.length} سجل`);
      try {
        await recordAuditLog({
          action: "BACKUP_RESTORE",
          module: "settings",
          severity: "warning",
          title: "استرجاع نسخة احتياطية من ملف JSON",
          details: `جداول: ${restorePreview.tableCount}، مسترجعة: ${report.inserted}، متخطاة: ${report.skipped}، فاشلة: ${report.failed.length}${
            (restorePreview.payload as { exportedBy?: string | null })?.exportedBy
              ? `، المصدّر الأصلي: ${(restorePreview.payload as { exportedBy?: string }).exportedBy}`
              : ""
          }`,
        });
      } catch {
        // best-effort
      }
      load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "تعذر استرجاع النسخة");
    } finally {
      setBusy(null);
      setRestorePreview(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-[fade-in_0.3s_ease-out]">
      <div className="grid gap-6 h-fit">
        <Section
          icon={<Clock className="w-5 h-5 text-primary" />}
          title="جدولة وتذكيرات النسخ الاحتياطي الدوري"
          hint="إعداد تذكيرات منتظمة لتنزيل نسخة احتياطية للحفاظ على بيانات المحل من الضياع."
        >
          <div className="grid gap-4">
            <Field label="تكرار التذكير بالنسخ الاحتياطي">
              <Select
                value={form.autoBackupFrequency ?? "weekly"}
                onValueChange={(v) => {
                  set("autoBackupFrequency", v as AutoBackupFrequency);
                  toast.success("تم تحديث دورية التذكير بالنسخ");
                }}
              >
                <SelectTrigger className="h-11 rounded-2xl bg-foreground/[0.03] border-foreground/10 focus:bg-background transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="weekly">تذكير أسبوعي (موصى به لحماية البيانات)</SelectItem>
                  <SelectItem value="monthly">تذكير شهري (نهاية كل دورة محاسبية)</SelectItem>
                  <SelectItem value="off">إيقاف التذكير التلقائي</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="rounded-2xl bg-foreground/[0.02] border border-foreground/5 p-3.5 text-xs text-muted-foreground leading-relaxed">
              {form.autoBackupFrequency === "off" ? (
                <span>
                  ⚠️ التذكير التلقائي معطل حالياً. نوصي بتفعيل التذكير الأسبوعي أو الشهري لضمان حفظ بياناتك بانتظام.
                </span>
              ) : (
                <span>
                  💡 يُنبهك النظام بتنزيل نسخة بصيغة JSON أو Excel كل{" "}
                  <strong className="text-foreground">
                    {form.autoBackupFrequency === "weekly" ? "أسبوع" : "شهر"}
                  </strong>{" "}
                  لحفظها على فلاش ميموري أو جهازك المحلي بأمان.
                </span>
              )}
            </div>
          </div>
        </Section>

        <Section
          icon={<Database className="w-5 h-5" />}
          title="ملخص حجم السجلات"
          hint="عدد السجلات المخزنة والمسجلة في قاعدة البيانات السحابية."
        >
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="rounded-2xl bg-foreground/[0.03] border border-foreground/5 p-3.5 flex items-center justify-between transition-all hover:bg-foreground/[0.05]"
              >
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-sm font-black tabular-nums text-primary">
                  {counts ? fmt(counts[key] ?? 0) : "…"}
                </span>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 gap-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
            onClick={load}
          >
            <RotateCcw className="w-3.5 h-3.5" /> تحديث الإحصائيات
          </Button>
        </Section>
      </div>

      <div className="grid gap-6 h-fit">
        <Section
          icon={<FileSpreadsheet className="w-5 h-5 text-emerald-500" />}
          title="النسخ الاحتياطي والمراجعة المحاسبية"
          hint="تصدير وتنزيل كافة بياناتك أو كشف الحركة المحاسبية في ملفات Excel و JSON."
        >
          <div className="grid gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all font-bold text-xs"
                disabled={busy !== null}
                onClick={() =>
                  run("json", downloadJsonBackup, "تم تنزيل النسخة الاحتياطية (JSON)", {
                    action: "BACKUP_EXPORT",
                    title: "تنزيل نسخة احتياطية كاملة (JSON)",
                  })
                }
              >
                <FileJson className="w-4 h-4 opacity-70" /> نسخة كاملة JSON
              </Button>
              <Button
                variant="secondary"
                className="h-11 gap-2 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border-none transition-all font-bold text-xs"
                disabled={busy !== null}
                onClick={() =>
                  run("xlsx", downloadExcelBackup, "تم تنزيل ملف Excel الشامل", {
                    action: "BACKUP_EXPORT",
                    title: "تنزيل ملف Excel مجمّع",
                  })
                }
              >
                <FileSpreadsheet className="w-4 h-4 opacity-70 text-emerald-500" /> ملف Excel مجمّع
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-11 gap-2 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs"
              disabled={busy !== null}
              onClick={() =>
                run("audit", downloadAccountingAuditLog, "تم تنزيل كشف المراجعة المحاسبية باللغة العربية", {
                  action: "BACKUP_EXPORT",
                  title: "تنزيل كشف المراجعة المحاسبية",
                })
              }
            >
              <FileSpreadsheet className="w-4 h-4" /> كشف المراجعة المحاسبية الشامل (Arabic Audit Log)
            </Button>

            <input
              ref={setRestoreInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const payload = JSON.parse(await file.text());
                  // Phase 2 (#15): deep structural dry run — unknown tables,
                  // duplicate ids, broken relations, size caps
                  const validation = validateBackupDeep(payload);
                  if (!validation.valid) {
                    toast.error(validation.error ?? "ملف النسخة غير صالح", {
                      description:
                        validation.errors.length > 1
                          ? `${validation.errors[1]}${validation.errors.length > 2 ? "…" : ""}`
                          : undefined,
                    });
                    return;
                  }
                  // Phase 0 (#15): preview first — actual restore happens after explicit confirmation
                  setRestorePreview({
                    payload,
                    tableCount: validation.tableCount ?? 0,
                    totalRows: validation.totalRows ?? 0,
                  });
                } catch (error: unknown) {
                  toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف النسخة");
                }
              }}
            />
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-2xl font-bold text-xs"
              disabled={busy !== null}
              onClick={() => restoreInput?.click()}
            >
              <Upload className="w-4 h-4" /> استرجاع بيانات من ملف JSON
            </Button>
          </div>
        </Section>

        {/* العمليات الانتقائية ومنطقة الخطر */}
        <Section
          icon={<ShieldAlert className="w-5 h-5 text-danger" />}
          title="التصفير الانتقائي ومنطقة الخطر"
          hint="إجراءات حساسة لتصفير الأرصدة أو مسح البيانات."
        >
          <div className="grid gap-2.5">
            <div className="grid sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/10 font-bold text-xs"
                onClick={() => setSelectiveResetType("stock")}
              >
                <RefreshCw className="w-3.5 h-3.5" /> تصفير كميات المخزون لـ 0
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/10 font-bold text-xs"
                onClick={() => setSelectiveResetType("balances")}
              >
                <RefreshCw className="w-3.5 h-3.5" /> تصفير أرصدة العملاء الافتتاحية
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-11 w-full gap-2 rounded-2xl text-danger border-danger/20 bg-danger/[0.02] hover:bg-danger/10 font-black text-xs transition-all"
              onClick={() => {
                setConfirmText("");
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" /> مسح كافة البيانات نهائياً (Factory Reset)
            </Button>
          </div>
        </Section>
      </div>

      {/* مودال تأكيد التصفير الانتقائي */}
      <AlertDialog open={selectiveResetType !== null} onOpenChange={(v) => !v && setSelectiveResetType(null)}>
        <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-lg font-black">
              {selectiveResetType === "stock"
                ? "تأكيد تصفير كميات المخزون؟"
                : "تأكيد تصفير الأرصدة الافتتاحية؟"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed text-muted-foreground">
              {selectiveResetType === "stock"
                ? "سيتم ضبط رصيد جميع أصناف المخزن ليكون 0 دون حذف المنتجات نفسها."
                : "سيتم تصفير الأرصدة الافتتاحية لجميع العملاء المسجلين."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-amber-500 text-black font-black"
              onClick={async () => {
                if (selectiveResetType === "stock") {
                  await run("reset-stock", resetInventoryStock, "تم تصفير كميات المخزون بنجاح", {
                    action: "DATA_RESET",
                    severity: "warning",
                    title: "تصفير كميات المخزون لـ 0",
                  });
                } else if (selectiveResetType === "balances") {
                  await run("reset-balances", resetCustomerOpeningBalances, "تم تصفير الأرصدة الافتتاحية", {
                    action: "DATA_RESET",
                    severity: "warning",
                    title: "تصفير الأرصدة الافتتاحية للعملاء",
                  });
                }
                setSelectiveResetType(null);
                load();
              }}
            >
              تأكيد التصفير
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* مودال تأكيد الاسترجاع (Phase 0 #15) */}
      <AlertDialog
        open={restorePreview !== null}
        onOpenChange={(v) => {
          if (!v && busy === null) {
            setRestorePreview(null);
            setPin("");
          }
        }}
      >
        <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-lg font-black">
              تأكيد استرجاع النسخة الاحتياطية؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed text-muted-foreground">
              الملف يحتوي على{" "}
              <strong className="text-foreground">{restorePreview?.tableCount ?? 0} جدول</strong> و{" "}
              <strong className="text-foreground">{restorePreview?.totalRows ?? 0} سجل</strong>.
              <br />
              سيتم دمج البيانات في حسابك الحالي — البيانات الموجودة لن تُستبدل،
              ولن تُستورد أي بيانات ملكية من حساب آخر.
              <br />
              <br />
              أدخل <strong className="text-foreground">PIN المدير</strong> للتأكيد
              (صالح لمدة 10 دقائق).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN المدير"
            className="h-12 rounded-2xl bg-foreground/[0.03] text-center font-bold tracking-widest"
          />
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl font-bold" disabled={busy !== null}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-primary font-black"
              disabled={busy !== null}
              onClick={confirmRestore}
            >
              {busy === "restore" ? "جاري الاسترجاع…" : "تأكيد الاسترجاع"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* مودال المسح الشامل */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          setConfirmOpen(v);
          if (!v) setPin("");
        }}
      >
        <AlertDialogContent
          dir="rtl"
          className="rounded-[2.5rem] border-danger/10 bg-card/95 backdrop-blur-2xl p-8 max-w-lg shadow-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black tracking-tight text-danger">
              حذف كل البيانات بشكل نهائي؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm leading-relaxed">
              هذا الإجراء سيقوم بمسح كافة الفواتير، العملاء، الموردين، والمخزون بشكل نهائي لا رجعة فيه.
              <br />
              <br />
              لتأكيد الحذف النهائي، يرجى كتابة كلمة <strong className="text-foreground">حذف</strong> في الحقل أدناه،
              ثم إدخال <strong className="text-foreground">PIN المدير</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="اكتب حذف هنا"
            className="h-12 rounded-2xl bg-foreground/[0.03] border-danger/20 focus:border-danger transition-all text-center font-bold"
          />
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN المدير"
            className="h-12 rounded-2xl bg-foreground/[0.03] border-danger/20 focus:border-danger transition-all text-center font-bold tracking-widest"
          />
          <AlertDialogFooter className="mt-6 gap-3 sm:justify-end">
            <AlertDialogCancel className="rounded-2xl border-none hover:bg-foreground/5 h-12 px-6 font-bold">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== "حذف" || busy !== null}
              className="rounded-2xl bg-danger h-12 px-8 font-black text-white transition-all hover:bg-danger/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-danger/20"
              onClick={async () => {
                // Phase 2 (#15): fresh manager-PIN re-auth before wiping
                if (!(await ensureReauth())) return;
                await run("wipe", wipeAllData, "تم حذف جميع بيانات النشاط بنجاح", {
                  action: "DATA_WIPE",
                  severity: "critical",
                  title: "مسح كافة البيانات نهائياً (Factory Reset)",
                });
                setConfirmOpen(false);
                load();
              }}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
