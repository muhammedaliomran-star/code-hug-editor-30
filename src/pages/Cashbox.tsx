import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintStatement}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5 h-9"
                >
                  <Printer className="h-4 w-4" />
                  طباعة كشف الحساب
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransferOpen(true)}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5 h-9"
                >
                  <ArrowLeftRight className="h-4 w-4 text-amber-500" />
                  تحويل بين الخزن
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAuditModalOpen(true)}
                  className="rounded-full px-4 text-xs font-semibold gap-1.5 h-9"
                >
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  جرد الدرج والفئات
                </Button>

                <Button
                  onClick={() => {
                    setManualTxType("in");
                    setIsManualTxOpen(true);
                  }}
                  className="rounded-full px-5 text-xs font-bold gap-1.5 h-9 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  تسجيل إيداع / سحب
                </Button>
              </div>
            }
          />

          {/* High-Level Liquidity Summary Cards */}
          <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>إجمالي السيولة الكلية (جميع الخزن)</span>
                <PiggyBank className="h-4 w-4 text-primary" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-primary mt-1">
                {fmt(totalLiquidity)} <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                موزعة على {accounts.length} حسابات وخزائن
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>الدرج النقدي الرئيسي (الكاش)</span>
                <Banknote className="h-4 w-4 text-emerald-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(accountBalances["acc-cash-main"]?.currentBalance || 0)}{" "}
                <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                السيولة الحاضرة المتاحة فوراً
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>المحافظ الإلكترونية وإنستاباي</span>
                <Smartphone className="h-4 w-4 text-indigo-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                {fmt(
                  accounts
                    .filter((a) => a.type === "ewallet")
                    .reduce((s, a) => s + (accountBalances[a.id]?.currentBalance || 0), 0)
                )}{" "}
                <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                فودافون كاش، أورانج، InstaPay
              </span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-muted-foreground text-xs font-semibold flex items-center justify-between">
                <span>الحسابات البنكية وماكينات الدفع</span>
                <CreditCard className="h-4 w-4 text-blue-500" />
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-blue-600 dark:text-blue-400 mt-1">
                {fmt(
                  accounts
                    .filter((a) => a.type === "bank" || a.type === "pos")
                    .reduce((s, a) => s + (accountBalances[a.id]?.currentBalance || 0), 0)
                )}{" "}
                <span className="text-xs font-normal text-muted-foreground">{cur}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                أرصدة البنوك وماكينات POS
              </span>
            </div>
          </Reveal>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <TabsList className="h-auto p-1.5 bg-card/80 border border-foreground/10 rounded-2xl flex-wrap justify-start gap-1">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Layers className="h-3.5 w-3.5" />
                  1. الخزن والحسابات والسيولة
                </TabsTrigger>

                <TabsTrigger
                  value="ledger"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  2. سجل الحركات المالي (Ledger)
                </TabsTrigger>

                <TabsTrigger
                  value="analytics"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  3. الرسوم والتدفقات النقدية
                </TabsTrigger>

                <TabsTrigger
                  value="transfers"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  4. سجل التحويلات الداخلية
                  {transfers.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                      {transfers.length}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="audits"
                  className="rounded-xl px-4 py-2 text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  5. محاضر الجرد وتصفية الدرج
                  {audits.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                      {audits.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

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
