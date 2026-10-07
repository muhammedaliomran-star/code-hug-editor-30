import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
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

          <Reveal className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
            className="h-full"
              icon={Building2}
              label="إجمالي الفروع النشطة"
              value={branches.length}
              format={(n) => String(Math.round(n))}
              sub={`${branches.filter((b) => b.isMain).length} فرع رئيسي معتمد`}
            />

            <MetricCard
            className="h-full"
              icon={Boxes}
              label="تقييم مخزون الفروع (تكلفة)"
              value={totalValuation.cost}
              format={(n) => `${fmt(n)} ${cur}`}
              sub={`القيمة البيعية: ${fmt(totalValuation.retail)} ${cur}`}
            />
            <MetricCard
            className="h-full"
              icon={Truck}
              label="التحويلات الجارية"
              value={transfers.filter((t) => t.status === "in_transit").length}
              format={(n) => String(Math.round(n))}
              sub={`من إجمالي ${transfers.length} أمر تحويل مسجل`}
            />
            <MetricCard
            className="h-full"
              icon={Users}
              label="كادر وموظفي الفروع"
              value={staffList.filter((s) => s.active).length}
              format={(n) => String(Math.round(n))}
              sub={`موزعين على ${branches.length} مواقع تشغيلية`}
            />
          </Reveal>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <StatTabs<string>
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: "branches", label: "1. الفروع والمقرات", icon: <Building2 className="h-3.5 w-3.5" /> },
                  { value: "inventory", label: "2. مخزون الفروع", icon: <Boxes className="h-3.5 w-3.5" /> },
                  { value: "transfers", label: "3. التحويلات والنقل", icon: <ArrowLeftRight className="h-3.5 w-3.5" />, dot: transfers.some((t) => t.status === "in_transit") ? "amber" : undefined },
                  { value: "cashbox", label: "4. الخزن والورديات (Z-Report)", icon: <Wallet className="h-3.5 w-3.5" /> },
                  { value: "profitability", label: "5. الأرباح والمصروفات (P&L)", icon: <Receipt className="h-3.5 w-3.5" /> },
                  { value: "analytics", label: "6. المقارنات والتحليلات", icon: <BarChart3 className="h-3.5 w-3.5" /> },
                  { value: "staff", label: "7. الموظفين والصلاحيات", icon: <Users className="h-3.5 w-3.5" /> },
                ]}
              />

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
 {b.name} {b.isMain ? " (رئيسي)" : ""}
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
