import { PageTransition } from "@/components/PageTransition";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CardsSkeleton, BlockSkeleton } from "@/components/LoadingSkeletons";
import { QuickActionsFab } from "@/components/QuickActionsFab";
import {
  DashboardCustomizationModal,
} from "@/components/DashboardCustomization";
import { ShieldCheck, Crown, Eye, EyeOff, Printer, SlidersHorizontal } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/components/dashboard";
import {
  DashboardProvider,
  useDashboard,
  QuickActionsSection,
  BentoKPIsSection,
  SecondaryKPIsSection,
  TopProductsSection,
  InsightsSection,
  ChartsSection,
  ExpensesSection,
  AtRiskSection,
  DueTodaySection,
  QuickLinksSection,
} from "@/components/dashboard";

function DashboardInner() {
  const {
    data,
    privacy,
    toggle,
    timeRange,
    setTimeRange,
    customizationOpen,
    setCustomizationOpen,
    sections,
    toggleSection,
    moveSection,
    resetToDefault,
    reconciliationSummary,
    handleExportExecutiveReport,
  } = useDashboard();

  if (data.loading && data.invoices.length === 0 && data.customers.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Live overview"
          title="لوحة التحكم الرئيسية"
          subtitle="جاري تجهيز وتدقيق مؤشراتك المالية والتشغيلية…"
        />
        <section className="mb-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardsSkeleton count={4} height="h-36" />
        </section>
        <section className="mb-14 grid gap-4 lg:grid-cols-3">
          <BlockSkeleton className="h-72 lg:col-span-2" />
          <BlockSkeleton className="h-72" />
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Live overview"
        title="لوحة التحكم الرئيسية"
        subtitle="مركز القيادة والرقابة اللحظية على الخزينة، الديون، المخزون، المبيعات والشحن."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/owner"
              className="island-btn group bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/25 font-bold"
            >
              <span>تطبيق المالك (سِجلّي Boss)</span>
              <span className="island-btn-icon text-amber-400">
                <Crown className="h-4 w-4" />
              </span>
            </Link>

            <div className="flex items-center rounded-lg bg-foreground/[0.05] p-1 ring-1 ring-border text-xs">
              {(["today", "7d", "month", "all"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all",
                    timeRange === r
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r === "today" ? "اليوم" : r === "7d" ? "7 أيام" : r === "month" ? "الشهر" : "الكل"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCustomizationOpen(true)}
              title="تخصيص وترتيب البطاقات"
              className="island-btn group ring-1 bg-foreground/[0.05] text-foreground ring-border hover:bg-foreground/[0.1] transition-all"
            >
              <span className="hidden sm:inline">تخصيص العرض</span>
              <span className="island-btn-icon">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportExecutiveReport}
              title="تصدير الموجز التنفيذي للوحة التحكم PDF"
              className="island-btn group ring-1 bg-primary text-primary-foreground ring-primary/30 hover:bg-primary/90 shadow-sm transition-all"
            >
              <span className="hidden sm:inline">تقرير تنفيذي (PDF)</span>
              <span className="island-btn-icon">
                <Printer className="h-4 w-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={toggle}
              title="إخفاء الأرقام"
              className={cn(
                "island-btn group ring-1",
                privacy
                  ? "bg-foreground/[0.08] text-foreground ring-foreground/15"
                  : "bg-transparent text-muted-foreground ring-border hover:text-foreground",
              )}
            >
              <span className="hidden sm:inline">
                {privacy ? "إظهار الأرقام" : "إخفاء الأرقام"}
              </span>
              <span className="island-btn-icon">
                {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </span>
            </button>

            <Link
              to="/reconciliation"
              className={cn(
                "island-btn group ring-1 transition-all",
                reconciliationSummary.healthScore >= 90
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 ring-amber-500/20 hover:bg-amber-500/20"
              )}
            >
              <span>المطابقة {reconciliationSummary.healthScore}%</span>
              <span className="island-btn-icon">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </Link>
          </div>
        }
      />

      {sections.map((section) => {
        if (!section.visible) return null;

        switch (section.id) {
          case "quick_actions":
            return <QuickActionsSection key={section.id} />;
          case "bento_kpis":
            return <BentoKPIsSection key={section.id} />;
          case "secondary_kpis":
            return <SecondaryKPIsSection key={section.id} />;
          case "top_products":
            return <TopProductsSection key={section.id} />;
          case "insights":
            return <InsightsSection key={section.id} />;
          case "charts":
            return <ChartsSection key={section.id} />;
          case "expenses":
            return <ExpensesSection key={section.id} />;
          case "at_risk":
            return <AtRiskSection key={section.id} />;
          case "due_today":
            return <DueTodaySection key={section.id} />;
          case "quick_links":
            return <QuickLinksSection key={section.id} />;
          default:
            return null;
        }
      })}

      <DashboardCustomizationModal
        open={customizationOpen}
        onOpenChange={setCustomizationOpen}
        sections={sections}
        onToggle={toggleSection}
        onMove={moveSection}
        onReset={resetToDefault}
      />

      <QuickActionsFab />
    </>
  );
}

function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardInner />
    </DashboardProvider>
  );
}

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <Dashboard />
      </PageTransition>
    </AppShell>
  );
}