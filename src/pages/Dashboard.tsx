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
import { ActionButton } from "@/components/ActionButton";
import { FilterChips } from "@/components/FilterChips";
import { Input } from "@/components/ui/input";
import {
  DashboardProvider,
  useDashboard,
  QuickActionsSection,
  BentoKPIsSection,
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
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
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
        title="لوحة التحكم الرئيسية"
        subtitle="مركز القيادة والرقابة اللحظية على الخزينة، الديون، المخزون، المبيعات والشحن."
        action={
          <div className="flex flex-col gap-2">
            {/* الصف الأول: التطبيق المالك + فلاتر الوقت */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/owner"
                className="island-btn group bg-foreground/[0.05] text-amber-300 ring-1 ring-border hover:bg-foreground/[0.09] font-bold"
              >
                <span>تطبيق المالك (سِجلّي Boss)</span>
                <span className="island-btn-icon text-amber-400">
                  <Crown className="h-4 w-4" />
                </span>
              </Link>

              <FilterChips
                options={[
                  { value: "today", label: "اليوم" },
                  { value: "7d", label: "7 أيام" },
                  { value: "month", label: "الشهر" },
                  { value: "all", label: "الكل" },
                  { value: "custom", label: "مخصص" },
                ]}
                value={timeRange}
                onChange={setTimeRange}
              />

              {timeRange === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    من
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      dir="ltr"
                      className="text-numeric h-9 text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    إلى
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      dir="ltr"
                      className="text-numeric h-9 text-xs"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* الصف الثاني: التقرير + أدوات العرض (أيقونات) + المطابقة */}
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                onClick={handleExportExecutiveReport}
                title="تصدير الموجز التنفيذي للوحة التحكم PDF"
                icon={<Printer className="h-4 w-4" />}
              >
                <span className="hidden sm:inline">تقرير تنفيذي (PDF)</span>
              </ActionButton>

              <ActionButton
                tone="surface"
                onClick={() => setCustomizationOpen(true)}
                title="تخصيص وترتيب البطاقات"
                aria-label="تخصيص وترتيب البطاقات"
                className="[padding-inline-start:0.4rem]!"
                icon={<SlidersHorizontal className="h-4 w-4" />}
              />

              <ActionButton
                tone="surface"
                onClick={toggle}
                title={privacy ? "إظهار الأرقام" : "إخفاء الأرقام"}
                aria-label={privacy ? "إظهار الأرقام" : "إخفاء الأرقام"}
                className="[padding-inline-start:0.4rem]!"
                icon={privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              />

              <Link
                to="/reconciliation"
                className={cn(
                  "island-btn group ring-1 ring-border transition-[background-color,box-shadow]",
                  reconciliationSummary.healthScore >= 90
                    ? "bg-foreground/[0.05] text-success hover:bg-foreground/[0.09]"
                    : "bg-foreground/[0.05] text-warning hover:bg-foreground/[0.09]"
                )}
              >
                <span>المطابقة {reconciliationSummary.healthScore}%</span>
                <span className="island-btn-icon">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </Link>
            </div>
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