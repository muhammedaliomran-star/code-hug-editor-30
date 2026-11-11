import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { useDB, db, fmt } from "@/lib/store";
import type { SalesDraft } from "@/types";
import { FileClock, Search, ArrowRight, Play, Trash2, Plus, WalletCards, PackageCheck, Clock3, MoreHorizontal, Eye, CalendarClock, CircleAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getCustomerCode } from "@/lib/customer-utils";

export default function SalesDrafts() {
  return <AppShell><PageTransition><SalesDraftsPage /></PageTransition></AppShell>;
}

function SalesDraftsPage() {
  const data = useDB();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState<SalesDraft[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get("filter") ?? "");
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<SalesDraft | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    setLoading(true);
    try { setDrafts(await db.listSalesDrafts()); }
    catch (error: any) { toast.error(error?.message ?? "تعذر تحميل المسودات"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return drafts.filter((draft) => {
      const expiryDiff = draft.expiresAt ? new Date(draft.expiresAt).getTime() - Date.now() : Number.POSITIVE_INFINITY;
      const reserved = reservationQuantity(draft);
      const matchesFilter =
        !filter ||
        (filter === "reserved" && reserved > 0) ||
        (filter === "value" && draft.total > 0) ||
        (filter === "deposit" && draft.depositTotal > 0) ||
        (filter === "expiring" && expiryDiff <= 24 * 60 * 60 * 1000);
      if (!matchesFilter) return false;
      if (!q) return true;
      const customer = data.customers.find((item) => item.id === draft.customerId)?.name ?? "";
      return [`D-${String(draft.draftNumber).padStart(4, "0")}`, customer, ...draft.items.map((item) => item.name)]
        .some((value) => value.toLocaleLowerCase().includes(q));
    });
  }, [data.customers, drafts, filter, query]);

  const cancel = async (draft: SalesDraft) => {
    const approved = await confirm({
      title: "إلغاء المسودة وتحرير الحجز",
      description: `سيتم تحرير ${reservationQuantity(draft)} وحدة${draft.depositTotal > 0 ? ` ورد العربون ${fmt(draft.depositTotal)} ج.م` : ""}. هل تريد المتابعة؟`,
      tone: "danger",
      confirmLabel: "إلغاء المسودة",
    });
    if (!approved) return;
    try {
      await db.cancelSalesDraft(draft.id, true);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      setSelectedDraft(null);
      toast.success("تم إلغاء المسودة وتحرير الكمية");
    } catch (error: any) { toast.error(error?.message ?? "تعذر إلغاء المسودة"); }
  };

  const continueDraft = (draft: SalesDraft) => {
    window.location.assign(`/invoices/new?draft=${encodeURIComponent(draft.id)}`);
  };

  const totalValue = drafts.reduce((sum, draft) => sum + draft.total, 0);
  const deposits = drafts.reduce((sum, draft) => sum + draft.depositTotal, 0);
  const reservedLines = drafts.reduce((sum, draft) => sum + reservationQuantity(draft), 0);

  return (
    <>
      <PageHeader
        eyebrow="الفواتير والمبيعات"
        title="مسودات فواتير البيع"
        subtitle="راجع الفواتير المحجوزة، استكمل البيع، أو حرّر الكميات بأمان."
        icon={<FileClock className="h-7 w-7" />}
        action={<div className="flex items-center gap-2"><Button asChild variant="outline" className="rounded-full"><Link to="/invoices"><ArrowRight className="ml-2 h-4 w-4" />الفواتير</Link></Button><Button asChild className="rounded-full"><Link to="/invoices/new?mode=draft"><Plus className="ml-2 h-4 w-4" />مسودة جديدة</Link></Button></div>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat icon={FileClock} label="المسودات النشطة" value={String(drafts.length)} tone="text-primary" />
        <Stat icon={PackageCheck} label="الوحدات المحجوزة" value={String(reservedLines)} tone="text-warning" />
        <Stat icon={WalletCards} label="إجمالي المسودات" value={`${fmt(totalValue)} ج.م · عربون ${fmt(deposits)} ج.م`} tone="text-success" />
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-[1.75rem] border border-border/30 bg-foreground/[0.02] p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم المسودة أو العميل أو الصنف..." className="h-11 rounded-2xl pr-10" /></div>
        <div className="flex items-center justify-between gap-2 self-end sm:self-auto">
          {filter && <Button variant="ghost" size="sm" onClick={() => { setFilter(""); window.history.replaceState({}, "", "/invoices/drafts"); }} className="rounded-full text-xs">إلغاء الفلتر</Button>}
          <Badge variant="outline" className="h-9 rounded-full px-4">{visible.length} مسودة</Badge>
        </div>
      </div>

      {loading ? <div className="py-20 text-center text-muted-foreground">جاري تحميل المسودات...</div> : visible.length === 0 ? (
        <BezelCard className="min-h-[280px]" innerClassName="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <FileClock className="h-12 w-12 text-muted-foreground/50" />
          <div><h2 className="text-lg font-black">لا توجد مسودات محفوظة</h2><p className="mt-2 text-sm text-muted-foreground">احفظ فاتورة كمسودة من شاشة الكاشير لتظهر هنا.</p></div>
          <Button asChild className="rounded-full"><Link to="/invoices/new"><Plus className="ml-2 h-4 w-4" />إنشاء فاتورة</Link></Button>
        </BezelCard>
      ) : (
        <div className="space-y-3">
          {visible.map((draft) => { const customerRecord = data.customers.find((item) => item.id === draft.customerId); return <DraftCard key={draft.id} draft={draft} now={now} customer={customerRecord?.name ?? "عميل نقدي"} customerCode={customerRecord ? getCustomerCode(customerRecord) : "—"} onContinue={continueDraft} onCancel={cancel} onOpen={setSelectedDraft} />; })}
        </div>
      )}

      <DraftDetailsDialog draft={selectedDraft} now={now} customer={selectedDraft ? data.customers.find((item) => item.id === selectedDraft.customerId)?.name ?? "عميل نقدي" : ""} onClose={() => setSelectedDraft(null)} onContinue={continueDraft} onCancel={cancel} />
    </>
  );
}

function reservationQuantity(draft: SalesDraft) {
  return draft.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
}

function draftExpiry(draft: SalesDraft) {
  if (!draft.expiresAt) return { label: "بدون موعد انتهاء", tone: "neutral" as const, expired: false };
  const diff = new Date(draft.expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "انتهت مدة الحجز", tone: "danger" as const, expired: true };
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return { label: `تنتهي خلال ${hours || 1} ساعة`, tone: "warning" as const, expired: false };
  return { label: `تنتهي خلال ${Math.ceil(hours / 24)} يوم`, tone: "neutral" as const, expired: false };
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return days > 0 ? `${days} يوم ${two(hours)}:${two(minutes)}:${two(secs)}` : `${two(hours)}:${two(minutes)}:${two(secs)}`;
}

function elapsedSince(draft: SalesDraft, now: number) {
  return formatDuration((now - new Date(draft.createdAt).getTime()) / 1000);
}

function DraftStatus({ draft }: { draft: SalesDraft }) {
  const expiry = draftExpiry(draft);
  if (expiry.expired) return <Badge className="gap-1 rounded-full bg-danger/10 text-danger"><CircleAlert className="h-3.5 w-3.5" />منتهية</Badge>;
  return <Badge className="gap-1 rounded-full bg-warning/10 text-warning"><FileClock className="h-3.5 w-3.5" />مسودة محفوظة</Badge>;
}

function DraftCard({ draft, customer, customerCode, now, onContinue, onCancel, onOpen }: { draft: SalesDraft; customer: string; customerCode: string; now: number; onContinue: (draft: SalesDraft) => void; onCancel: (draft: SalesDraft) => Promise<void>; onOpen: (draft: SalesDraft) => void }) {
  const expiry = draftExpiry(draft);
  const reserved = reservationQuantity(draft);
  const remaining = Math.max(0, draft.total - draft.depositTotal);
  return (
    <BezelCard className="group transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5" innerClassName="p-3 sm:p-5">
      <div role="button" tabIndex={0} onClick={() => onOpen(draft)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(draft); }} className="cursor-pointer rounded-[1.25rem] p-2 outline-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.025] focus-visible:ring-2 focus-visible:ring-primary/50">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:items-center">
            <Button onClick={(event) => { event.stopPropagation(); onContinue(draft); }} className="group h-11 w-full rounded-full px-5 sm:w-auto"><Play className="ml-2 h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5" />استكمال البيع</Button>
            <Button onClick={(event) => { event.stopPropagation(); onOpen(draft); }} variant="outline" className="h-11 w-full rounded-full sm:w-auto"><Eye className="ml-2 h-4 w-4" />التفاصيل</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button onClick={(event) => event.stopPropagation()} variant="ghost" size="icon" className="h-11 w-full rounded-full sm:w-11" aria-label="إجراءات المسودة"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start" dir="rtl" className="rounded-2xl p-2">
                <DropdownMenuItem onClick={() => void onCancel(draft)} className="gap-2 rounded-xl text-danger focus:bg-danger/10 focus:text-danger"><Trash2 className="h-4 w-4" />إلغاء وتحرير الحجز</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <div className="flex flex-wrap items-center justify-end gap-2"><DraftStatus draft={draft} /><Badge className="rounded-full bg-primary/10 text-primary">D-{String(draft.draftNumber).padStart(4, "0")}</Badge><h2 className="text-xl font-black text-foreground">{customer}</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">كود {customerCode}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:justify-end"><span>{draft.items.length} أصناف / {reserved} وحدة</span><span>{fmt(draft.total)} ج.م إجمالي</span><span className={draft.depositTotal > 0 ? "text-success" : ""}>عربون {fmt(draft.depositTotal)} ج.م</span><span>متبقي {fmt(remaining)} ج.م</span></div>
            <div className={`mt-3 flex items-center justify-end gap-1.5 text-xs font-bold ${expiry.tone === "danger" ? "text-danger" : expiry.tone === "warning" ? "text-warning" : "text-muted-foreground"}`}><Clock3 className="h-3.5 w-3.5" />{expiry.label}</div>
            <div className="mt-2 flex items-center justify-end gap-1.5 text-xs font-bold text-info"><Clock3 className="h-3.5 w-3.5" />مدة الاحتفاظ بالحجز: {elapsedSince(draft, now)}</div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">{draft.items.slice(0, 4).map((item) => <span key={item.id} className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] text-muted-foreground">{item.name} × {item.quantity}</span>)}{draft.items.length > 4 && <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] text-muted-foreground">+{draft.items.length - 4}</span>}</div>
          </div>
        </div>
      </div>
    </BezelCard>
  );
}

function DraftDetailsDialog({ draft, customer, now, onClose, onContinue, onCancel }: { draft: SalesDraft | null; customer: string; now: number; onClose: () => void; onContinue: (draft: SalesDraft) => void; onCancel: (draft: SalesDraft) => Promise<void> }) {
  if (!draft) return null;
  const expiry = draftExpiry(draft);
  const remaining = Math.max(0, draft.total - draft.depositTotal);
  return <Dialog open={!!draft} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent dir="rtl" className="max-h-[min(760px,calc(100dvh-1rem))] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-[2rem] border-border/40 bg-card/95 p-0 backdrop-blur-xl sm:w-[calc(100vw-2rem)]">
      <DialogHeader className="border-b border-border/30 px-5 py-5 text-right sm:px-7"><div className="flex items-center justify-between gap-3"><div><DialogTitle className="text-right text-xl">تفاصيل المسودة D-{String(draft.draftNumber).padStart(4, "0")}</DialogTitle><DialogDescription className="mt-1 text-right">راجع الحجز والعربون قبل استكمال البيع.</DialogDescription></div><DraftStatus draft={draft} /></div></DialogHeader>
      <div className="space-y-4 p-5 sm:p-7">
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">العميل</span><strong>{customer}</strong></div><div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">موعد انتهاء الحجز</span><span className={expiry.tone === "warning" ? "font-bold text-warning" : expiry.tone === "danger" ? "font-bold text-danger" : "font-bold text-foreground"}>{expiry.label}</span></div></div>
        <section className="rounded-2xl border border-border/30 bg-foreground/[0.02] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-black">الأصناف المحجوزة</h3><span className="text-xs text-muted-foreground">{reservationQuantity(draft)} وحدة</span></div><div className="space-y-2">{draft.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-sm"><span className="font-semibold">{item.name}</span><span className="text-muted-foreground">{item.quantity} × {fmt(item.price)} ج.م</span></div>)}</div></section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="الإجمالي" value={draft.total} /><Summary label="العربون" value={draft.depositTotal} tone="text-success" /><Summary label="المتبقي" value={remaining} tone="text-warning" /><Summary label="عدد الأصناف" value={draft.items.length} money={false} /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-info/20 bg-info/[0.06] p-4 text-right"><span className="block text-[11px] text-muted-foreground">مدة الاحتفاظ بالحجز</span><strong className="mt-1 block text-xl font-black text-info">{elapsedSince(draft, now)}</strong><span className="mt-1 block text-[11px] text-muted-foreground">منذ حفظ المسودة</span></div><div className={`rounded-2xl border p-4 text-right ${expiry.tone === "danger" ? "border-danger/20 bg-danger/[0.06]" : expiry.tone === "warning" ? "border-warning/20 bg-warning/[0.06]" : "border-border/30 bg-foreground/[0.03]"}`}><span className="block text-[11px] text-muted-foreground">موعد انتهاء الحجز</span><strong className={`mt-1 block text-xl font-black ${expiry.tone === "danger" ? "text-danger" : expiry.tone === "warning" ? "text-warning" : "text-foreground"}`}>{expiry.label}</strong><span className="mt-1 block text-[11px] text-muted-foreground">يحرر الحجز بعد الانتهاء حسب سياسة النظام</span></div></div>
        {draft.notes && <div className="rounded-2xl border border-border/30 p-4 text-sm text-muted-foreground"><span className="mb-1 block font-bold text-foreground">ملاحظات</span>{draft.notes}</div>}
      </div>
      <DialogFooter className="border-t border-border/30 px-5 py-4 sm:px-7"><Button onClick={() => onContinue(draft)} className="h-11 w-full rounded-full sm:w-auto"><Play className="ml-2 h-4 w-4" />استكمال البيع</Button><Button onClick={() => void onCancel(draft)} variant="outline" className="h-11 w-full rounded-full border-danger/30 text-danger hover:bg-danger/10 sm:w-auto"><Trash2 className="ml-2 h-4 w-4" />إلغاء وتحرير الحجز</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function Summary({ label, value, tone = "text-foreground", money = true }: { label: string; value: number; tone?: string; money?: boolean }) {
  return <div className="rounded-2xl border border-border/30 bg-foreground/[0.03] p-3 text-right"><span className="block text-[11px] text-muted-foreground">{label}</span><strong className={`mt-1 block text-lg font-black ${tone}`}>{money ? `${fmt(value)} ج.م` : value}</strong></div>;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof FileClock; label: string; value: string; tone: string }) {
  return <BezelCard innerClassName="flex items-center justify-between gap-3 p-4"><div className="text-right"><div className="text-xs font-bold text-muted-foreground">{label}</div><div className={`mt-2 text-xl font-black ${tone}`}>{value}</div></div><span className={`grid h-10 w-10 place-items-center rounded-full bg-foreground/[0.06] ${tone}`}><Icon className="h-5 w-5" /></span></BezelCard>;
}
