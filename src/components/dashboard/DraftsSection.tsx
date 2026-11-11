import { Link } from "@/lib/router-compat";
import { Clock3, FileClock, PackageCheck, WalletCards, ArrowLeft } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { useDashboard } from "./context";

const cards = [
  {
    key: "active",
    label: "المسودات النشطة",
    icon: FileClock,
    tone: "text-primary",
    href: "/invoices/drafts",
    filter: "",
  },
  {
    key: "reserved",
    label: "الوحدات المحجوزة",
    icon: PackageCheck,
    tone: "text-warning",
    href: "/invoices/drafts?filter=reserved",
    filter: "reserved",
  },
  {
    key: "value",
    label: "قيمة المسودات",
    icon: WalletCards,
    tone: "text-info",
    href: "/invoices/drafts?filter=value",
    filter: "value",
  },
  {
    key: "deposit",
    label: "العربون المحتجز",
    icon: WalletCards,
    tone: "text-success",
    href: "/invoices/drafts?filter=deposit",
    filter: "deposit",
  },
  {
    key: "expiring",
    label: "مسودات تنتهي قريبًا",
    icon: Clock3,
    tone: "text-warning",
    href: "/invoices/drafts?filter=expiring",
    filter: "expiring",
  },
] as const;

export function DraftsSection() {
  const { draftsStats, draftsLoading, money } = useDashboard();
  const hasExpired = draftsStats.expiredCount > 0;

  const values: Record<(typeof cards)[number]["key"], string> = {
    active: String(draftsStats.activeCount),
    reserved: String(draftsStats.reservedUnits),
    value: money(draftsStats.totalValue),
    deposit: money(draftsStats.deposits),
    expiring: String(draftsStats.expiringSoonCount + draftsStats.expiredCount),
  };

  return (
    <section className="mb-14" aria-labelledby="drafts-section-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">مراقبة التشغيل</span>
          <h2 id="drafts-section-title" className="mt-1 text-xl font-black text-foreground">المسودات والحجوزات</h2>
          <p className="mt-1 text-sm text-muted-foreground">حجوزات مؤقتة تؤثر على المخزون والعربون قبل اكتمال البيع.</p>
        </div>
        <Link to="/invoices/drafts" className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-muted-foreground transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.05] hover:text-foreground">
          فتح كل المسودات
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-x-1" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const expiringTone = card.key === "expiring" && hasExpired ? "text-danger" : card.tone;
          return (
            <Reveal key={card.key} delay={index * 70} className="h-full">
              <Link to={card.href} className="group block h-full rounded-[1.45rem] bg-foreground/[0.035] p-1 ring-1 ring-inset ring-[var(--hairline)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:bg-foreground/[0.06]">
                <div className="flex h-full min-h-[148px] flex-col justify-between rounded-[1.2rem] bg-background/80 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl bg-foreground/[0.06] ${expiringTone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground transition-colors group-hover:text-foreground">عرض التفاصيل</span>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-bold text-muted-foreground">{card.label}</p>
                    <p className={`mt-1 text-2xl font-black tracking-tight ${expiringTone}`}>
                      {draftsLoading ? "…" : values[card.key]}
                      {card.key === "reserved" && <span className="ms-1 text-xs font-bold text-muted-foreground">وحدة</span>}
                      {(card.key === "value" || card.key === "deposit") && <span className="ms-1 text-xs font-bold text-muted-foreground">ج.م</span>}
                    </p>
                    {card.key === "expiring" && hasExpired && <p className="mt-1 text-[11px] font-bold text-danger">منها {draftsStats.expiredCount} منتهية</p>}
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
