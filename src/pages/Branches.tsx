import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, Building2, Boxes, ArrowLeftRight, Wallet, Receipt, BarChart3, Users, Truck } from "lucide-react";
import { fmt } from "@/lib/store";
import { BranchesProvider, useBranches, BranchesListTab, InventoryTab, TransfersTab, CashboxTab, ProfitabilityTab, AnalyticsTab, StaffTab, BranchDialog, CreateTransferDialog, ReceiveTransferDialog, RemittanceDialog, ZReportDialog, StaffDialog } from "@/components/branches";

function BranchesPageInner() {
  const { branches, stockItems, transfers, staffList, cur, totalValuation, activeTab, setActiveTab, selectedBranchId, setSelectedBranchId } = useBranches();

  return (
    <AppShell>
      <PageTransition>
        <div className="flex flex-col gap-6" dir="rtl">
          <PageHeader
            title="إدارة الفروع والمخزون المتعدد"
            icon={<GitBranch className="h-7 w-7 text-primary" />}
            subtitle="المنظومة المركزية لإدارة الفروع، حركة المخزون، التحويلات، الخزن والورديات، وقوائم الأرباح"
          />

          <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>إجمالي الفروع النشطة</span>
                <Building2 className="h-4 w-4 text-primary" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums mt-1">
                <CountUp value={branches.length} />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {branches.filter((b) => b.isMain).length} فرع رئيسي معتمد
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>تقييم مخزون الفروع (تكلفة)</span>
                <Boxes className="h-4 w-4 text-emerald-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(totalValuation.cost)} <span className="text-xs font-normal">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                القيمة البيعية: {fmt(totalValuation.retail)} {cur}
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>التحويلات الجارية</span>
                <Truck className="h-4 w-4 text-amber-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {transfers.filter((t) => t.status === "in_transit").length}
              </div>
              <span className="text-[11px] text-muted-foreground">
                من إجمالي {transfers.length} أمر تحويل مسجل
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>كادر وموظفي الفروع</span>
                <Users className="h-4 w-4 text-indigo-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                {staffList.filter((s) => s.active).length}
              </div>
              <span className="text-[11px] text-muted-foreground">
                موزعين على {branches.length} مواقع تشغيلية
              </span>
            </div>
          </Reveal>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <TabsList className="h-auto p-1.5 bg-card/80 border border-foreground/10 rounded-2xl flex-wrap justify-start gap-1">
                <TabsTrigger value="branches" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  1. الفروع والمقرات
                </TabsTrigger>
                <TabsTrigger value="inventory" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Boxes className="h-3.5 w-3.5" />
                  2. مخزون الفروع
                </TabsTrigger>
                <TabsTrigger value="transfers" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  3. التحويلات والنقل
                  {transfers.filter((t) => t.status === "in_transit").length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="cashbox" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  4. الخزن والورديات (Z-Report)
                </TabsTrigger>
                <TabsTrigger value="profitability" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  5. الأرباح والمصروفات (P&L)
                </TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  6. المقارنات والتحليلات
                </TabsTrigger>
                <TabsTrigger value="staff" className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Users className="h-3.5 w-3.5" />
                  7. الموظفين والصلاحيات
                </TabsTrigger>
              </TabsList>

              {activeTab !== "branches" && activeTab !== "analytics" && (
                <div className="flex items-center gap-2 bg-card/60 border border-foreground/10 px-3 py-1.5 rounded-full">
                  <span className="text-xs text-muted-foreground font-semibold">عرض بيانات الفرع:</span>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="h-8 w-44 rounded-full text-xs font-bold border-none bg-primary/10 text-primary">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name} {b.isMain ? "⭐ (رئيسي)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="branches" className="space-y-6">
              <BranchesListTab />
            </TabsContent>
            <TabsContent value="inventory" className="space-y-6">
              <InventoryTab />
            </TabsContent>
            <TabsContent value="transfers" className="space-y-6">
              <TransfersTab />
            </TabsContent>
            <TabsContent value="cashbox" className="space-y-6">
              <CashboxTab />
            </TabsContent>
            <TabsContent value="profitability" className="space-y-6">
              <ProfitabilityTab />
            </TabsContent>
            <TabsContent value="analytics" className="space-y-6">
              <AnalyticsTab />
            </TabsContent>
            <TabsContent value="staff" className="space-y-6">
              <StaffTab />
            </TabsContent>
          </Tabs>

          <BranchDialog />
          <CreateTransferDialog />
          <ReceiveTransferDialog />
          <RemittanceDialog />
          <ZReportDialog />
          <StaffDialog />
        </div>
      </PageTransition>
    </AppShell>
  );
}

export default function BranchesPage() {
  return (
    <BranchesProvider>
      <BranchesPageInner />
    </BranchesProvider>
  );
}
