import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDB, db, fmt } from "@/lib/store";
import type { SalesDraft } from "@/types";
import { FileClock, Search, ArrowRight, Play, Trash2, Plus, WalletCards, PackageCheck } from "lucide-react";
import { toast } from "sonner";

export default function SalesDrafts() {
  return <AppShell><PageTransition><SalesDraftsPage /></PageTransition></AppShell>;
}

function SalesDraftsPage() {
  const data = useDB();
  const [drafts, setDrafts] = useState<SalesDraft[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setDrafts(await db.listSalesDrafts()); }
    catch (error: any) { toast.error(error?.message ?? "تعذر تحميل المسودات"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return drafts;
    return drafts.filter((draft) => {
      const customer = data.customers.find((item) => item.id === draft.customerId)?.name ?? "";
      return [`D-${String(draft.draftNumber).padStart(4, "0")}`, customer, ...draft.items.map((item) => item.name)]
        .some((value) => value.toLocaleLowerCase().includes(q));
    });
  }, [data.customers, drafts, query]);

  const cancel = async (draft: SalesDraft) => {
    try {
      await db.cancelSalesDraft(draft.id, true);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      toast.success("تم إلغاء المسودة وتحرير الكمية");
    } catch (error: any) { toast.error(error?.message ?? "تعذر إلغاء المسودة"); }
  };

  const continueDraft = (draft: SalesDraft) => {
    window.location.assign(`/invoices/new?draft=${encodeURIComponent(draft.id)}`);
  };

  const totalValue = drafts.reduce((sum, draft) => sum + draft.total, 0);
  const deposits = drafts.reduce((sum, draft) => sum + draft.depositTotal, 0);
  const reservedLines = drafts.reduce((sum, draft) => sum + draft.items.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="الفواتير والمبيعات"
        title="مسودات فواتير البيع"
        subtitle="راجع الفواتير المحجوزة، استكمل البيع، أو حرّر الكميات بأمان."
        icon={<FileClock className="h-7 w-7" />}
        action={<div className="flex items-center gap-2"><Button asChild variant="outline" className="rounded-full"><Link to="/invoices"><ArrowRight className="ml-2 h-4 w-4" />الفواتير</Link></Button><Button asChild className="rounded-full"><Link to="/invoices/new"><Plus className="ml-2 h-4 w-4" />فاتورة جديدة</Link></Button></div>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat icon={FileClock} label="المسودات النشطة" value={String(drafts.length)} tone="text-primary" />
        <Stat icon={PackageCheck} label="الأصناف المحجوزة" value={String(reservedLines)} tone="text-warning" />
        <Stat icon={WalletCards} label="إجمالي المسودات" value={`${fmt(totalValue)} ج.م · عربون ${fmt(deposits)} ج.م`} tone="text-success" />
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-[1.75rem] border border-border/30 bg-foreground/[0.02] p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم المسودة أو العميل أو الصنف..." className="h-11 rounded-2xl pr-10" /></div>
        <Badge variant="outline" className="h-9 self-end rounded-full px-4 sm:self-auto">{visible.length} مسودة</Badge>
      </div>

      {loading ? <div className="py-20 text-center text-muted-foreground">جاري تحميل المسودات...</div> : visible.length === 0 ? (
        <BezelCard className="min-h-[280px]" innerClassName="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <FileClock className="h-12 w-12 text-muted-foreground/50" />
          <div><h2 className="text-lg font-black">لا توجد مسودات محفوظة</h2><p className="mt-2 text-sm text-muted-foreground">احفظ فاتورة كمسودة من شاشة الكاشير لتظهر هنا.</p></div>
          <Button asChild className="rounded-full"><Link to="/invoices/new"><Plus className="ml-2 h-4 w-4" />إنشاء فاتورة</Link></Button>
        </BezelCard>
      ) : (
        <div className="space-y-3">
          {visible.map((draft) => {
            const customer = data.customers.find((item) => item.id === draft.customerId)?.name ?? "عميل نقدي";
            return <BezelCard key={draft.id} innerClassName="p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => continueDraft(draft)} className="rounded-full"><Play className="ml-2 h-4 w-4" />استكمال البيع</Button>
                  <Button onClick={() => void cancel(draft)} variant="outline" className="rounded-full border-danger/30 text-danger hover:bg-danger/10"><Trash2 className="ml-2 h-4 w-4" />إلغاء وتحرير الحجز</Button>
                </div>
                <div className="min-w-0 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2"><Badge className="rounded-full bg-primary/10 text-primary">D-{String(draft.draftNumber).padStart(4, "0")}</Badge><h2 className="text-lg font-black">{customer}</h2></div>
                  <p className="mt-1 text-xs text-muted-foreground">{draft.items.length} أصناف · {fmt(draft.total)} ج.م · عربون {fmt(draft.depositTotal)} ج.م</p>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">{draft.items.slice(0, 4).map((item) => <span key={item.id} className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] text-muted-foreground">{item.name} × {item.quantity}</span>)}{draft.items.length > 4 && <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] text-muted-foreground">+{draft.items.length - 4}</span>}</div>
                </div>
              </div>
            </BezelCard>;
          })}
        </div>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof FileClock; label: string; value: string; tone: string }) {
  return <BezelCard innerClassName="flex items-center justify-between gap-3 p-4"><div className="text-right"><div className="text-xs font-bold text-muted-foreground">{label}</div><div className={`mt-2 text-xl font-black ${tone}`}>{value}</div></div><span className={`grid h-10 w-10 place-items-center rounded-full bg-foreground/[0.06] ${tone}`}><Icon className="h-5 w-5" /></span></BezelCard>;
}
