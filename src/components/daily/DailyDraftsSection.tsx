import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Clock3, FileClock, PackageCheck, WalletCards } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { db, fmt } from "@/lib/store";
import type { SalesDraft } from "@/types";

function reservedUnits(draft: SalesDraft) {
  return draft.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
}

export function DailyDraftsSection() {
  const [drafts, setDrafts] = useState<SalesDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    db.listSalesDrafts()
      .then((items) => { if (mounted) setDrafts(items); })
      .catch((error) => console.warn("تعذر تحميل مسودات اليومية", error))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return {
      active: drafts.length,
      reserved: drafts.reduce((sum, draft) => sum + reservedUnits(draft), 0),
      value: drafts.reduce((sum, draft) => sum + draft.total, 0),
      deposit: drafts.reduce((sum, draft) => sum + draft.depositTotal, 0),
      expiring: drafts.filter((draft) => {
        const diff = draft.expiresAt ? new Date(draft.expiresAt).getTime() - now : Number.POSITIVE_INFINITY;
        return diff <= day;
      }).length,
    };
  }, [drafts]);

  const cards = [
    { label: "المسودات النشطة", value: String(stats.active), icon: FileClock, tone: "text-primary", href: "/invoices/drafts" },
    { label: "الوحدات المحجوزة", value: String(stats.reserved), icon: PackageCheck, tone: "text-warning", href: "/invoices/drafts?filter=reserved", suffix: "وحدة" },
    { label: "قيمة المسودات", value: fmt(stats.value), icon: WalletCards, tone: "text-info", href: "/invoices/drafts?filter=value", suffix: "ج.م" },
    { label: "العربون المحتجز", value: fmt(stats.deposit), icon: WalletCards, tone: "text-success", href: "/invoices/drafts?filter=deposit", suffix: "ج.م" },
    { label: "تنتهي خلال 24 ساعة", value: String(stats.expiring), icon: Clock3, tone: stats.expiring > 0 ? "text-warning" : "text-muted-foreground", href: "/invoices/drafts?filter=expiring" },
  ];

  return (
    <section className="mt-8 mb-8" aria-labelledby="daily-drafts-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">حركة يومية</span>
          <h2 id="daily-drafts-title" className="mt-1 text-xl font-black text-foreground">المسودات والحجوزات</h2>
          <p className="mt-1 text-sm text-muted-foreground">تابع الحجز والعربون والعمليات التي تحتاج استكمالًا أو تحريرًا.</p>
        </div>
        <Link to="/invoices/drafts" className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-muted-foreground transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.05] hover:text-foreground">
          فتح كل المسودات
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-x-1" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Reveal key={card.label} delay={index * 70} className="h-full">
              <Link to={card.href} className="group block h-full rounded-[1.45rem] bg-foreground/[0.035] p-1 ring-1 ring-inset ring-[var(--hairline)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:bg-foreground/[0.06]">
                <div className="flex h-full min-h-[142px] flex-col justify-between rounded-[1.2rem] bg-background/80 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl bg-foreground/[0.06] ${card.tone}`}><Icon className="h-4 w-4" /></span>
                    <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground">عرض التفاصيل</span>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-bold text-muted-foreground">{card.label}</p>
                    <p className={`mt-1 text-2xl font-black tracking-tight ${card.tone}`}>{loading ? "…" : card.value}{card.suffix && <span className="ms-1 text-xs font-bold text-muted-foreground">{card.suffix}</span>}</p>
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
