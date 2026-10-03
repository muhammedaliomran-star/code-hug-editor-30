import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
import { ActionButton } from "@/components/ActionButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt } from "@/lib/store";
import {
  CashboxProvider,
  useCashbox,
  OverviewTab,
  LedgerTab,
  AnalyticsTab,
  TransfersTab,
  AuditsTab,
  ManualTxDialog,
  TransferDialog,
  AuditDialog,
  AccountManageDialog,
} from "@/components/cashbox";
import {
  Wallet,
  ArrowLeftRight,
  Calculator,
  Printer,
  Plus,
  PiggyBank,
  Banknote,
  Smartphone,
  CreditCard,
  Layers,
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react";

function CashboxPageContent() {
  const {
    cur,
    accounts,
    accountBalances,
    totalLiquidity,
    activeTab,
    setActiveTab,
    selectedAccountId,
    setSelectedAccountId,
    transfers,
    audits,
    handlePrintStatement,
    setIsTransferOpen,
    setIsAuditModalOpen,
    setIsManualTxOpen,
    setManualTxType,
  } = useCashbox();

  return (
    <AppShell>
      <PageTransition>
        <div className="flex flex-col gap-6" dir="rtl">
          {/* Header */}
          <PageHeader
            title="إدارة الصندوق والسيولة النقدية"
            icon={<Wallet className="h-7 w-7 text-primary" />}
            subtitle="المنظومة المركزية لإدارة الخزن النقدية، المحافظ الإلكترونية، الحسابات البنكية، الجرد، والتحويلات"
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <ActionButton
                  tone="surface"
                  onClick={handlePrintStatement}
                  icon={<Printer className="h-4 w-4" />}
                >
                  طباعة كشف الحساب
                </ActionButton>

                <ActionButton
                  tone="surface"
                  onClick={() => setIsTransferOpen(true)}
                  icon={<ArrowLeftRight className="h-4 w-4" />}
                >
                  تحويل بين الخزن
                </ActionButton>

                <ActionButton
                  tone="surface"
                  onClick={() => setIsAuditModalOpen(true)}
                  icon={<Calculator className="h-4 w-4" />}
                >
                  جرد الدرج والفئات
                </ActionButton>

                <ActionButton
                  onClick={() => {
                    setManualTxType("in");
                    setIsManualTxOpen(true);
                  }}
                  icon={<Plus className="h-4 w-4" />}
                >
                  تسجيل إيداع / سحب
                </ActionButton>
              </div>
            }
          />

          {/* High-Level Liquidity Summary Cards */}
          <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={PiggyBank}
              label="إجمالي السيولة الكلية (جميع الخزن)"
              value={totalLiquidity}
              format={(n) => `${fmt(n)} ${cur}`}
              sub={`موزعة على ${accounts.length} حسابات وخزائن`}
            />
            <MetricCard
              icon={Banknote}
              label="الدرج النقدي الرئيسي (الكاش)"
              value={accountBalances["acc-cash-main"]?.currentBalance || 0}
              format={(n) => `${fmt(n)} ${cur}`}
              sub="السيولة الحاضرة المتاحة فوراً"
            />
            <MetricCard
              icon={Smartphone}
              label="المحافظ الإلكترونية وإنستاباي"
              value={accounts
                .filter((a) => a.type === "ewallet")
                .reduce((s, a) => s + (accountBalances[a.id]?.currentBalance || 0), 0)}
              format={(n) => `${fmt(n)} ${cur}`}
              sub="فودافون كاش، أورانج، InstaPay"
            />
            <MetricCard
              icon={CreditCard}
              label="الحسابات البنكية وماكينات الدفع"
              value={accounts
                .filter((a) => a.type === "bank" || a.type === "pos")
                .reduce((s, a) => s + (accountBalances[a.id]?.currentBalance || 0), 0)}
              format={(n) => `${fmt(n)} ${cur}`}
              sub="أرصدة البنوك وماكينات POS"
            />
          </Reveal>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <StatTabs
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: "overview", label: "1. الخزن والحسابات والسيولة", icon: <Layers className="h-3.5 w-3.5" /> },
                  { value: "ledger", label: "2. سجل الحركات المالي (Ledger)", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
                  { value: "analytics", label: "3. الرسوم والتدفقات النقدية", icon: <TrendingUp className="h-3.5 w-3.5" /> },
                  { value: "transfers", label: "4. سجل التحويلات الداخلية", count: transfers.length || undefined, icon: <ArrowLeftRight className="h-3.5 w-3.5" /> },
                  { value: "audits", label: "5. محاضر الجرد وتصفية الدرج", count: audits.length || undefined, icon: <Calculator className="h-3.5 w-3.5" /> },
                ]}
              />

              {/* Account Quick Filter */}
              <div className="flex items-center gap-2 bg-card/60 border border-foreground/10 px-3 py-1.5 rounded-full">
                <span className="text-xs text-muted-foreground font-semibold">تصفية حسب الخزينة:</span>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 w-48 rounded-full text-xs font-bold border-none bg-primary/10 text-primary">
                    <SelectValue placeholder="كل الخزن والحسابات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold">
                      عرض كل الحسابات (مجمّع)
                    </SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name} ({fmt(accountBalances[acc.id]?.currentBalance || 0)} {cur})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <OverviewTab />
            </TabsContent>

            <TabsContent value="ledger" className="space-y-4">
              <LedgerTab />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <AnalyticsTab />
            </TabsContent>

            <TabsContent value="transfers" className="space-y-4">
              <TransfersTab />
            </TabsContent>

            <TabsContent value="audits" className="space-y-4">
              <AuditsTab />
            </TabsContent>
          </Tabs>

          {/* Dialogs */}
          <ManualTxDialog />
          <TransferDialog />
          <AuditDialog />
          <AccountManageDialog />
        </div>
      </PageTransition>
    </AppShell>
  );
}

export default function CashboxPage() {
  return (
    <CashboxProvider>
      <CashboxPageContent />
    </CashboxProvider>
  );
}
