import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { useDB, fmt, db } from "@/lib/store";
import { PageLoadingSkeleton } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  runComprehensiveReconciliation,
  executeReconciliationFix,
  executeAutoFixAll,
  exportReconciliationToExcel,
  exportReconciliationToPdf,
  ReconciliationCategory,
  ReconciliationSeverity,
  ReconciliationFinding,
  saveAuditRun,
  getAuditRuns,
  deleteAuditRun,
  type AuditRunRecord,
} from "@/lib/reconciliation-engine";
import { AuditRunsHistory } from "@/components/reconciliation/AuditRunsHistory";
import {
  ClipboardCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  TrendingDown,
  Boxes,
  Users,
  Truck,
  Receipt,
  RotateCcw,
  ArrowUpRight,
  HelpCircle,
  Wrench,
  ChevronRight,
  Info,
  DollarSign,
  Check,
  X,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
import { FilterChips } from "@/components/FilterChips";
import { ActionButton } from "@/components/ActionButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@tanstack/react-router";

export default function Reconciliation() {
  const data = useDB();
  const navigate = useNavigate();

  const [movements, setMovements] = useState<Array<{ stock_item_id: string; quantity: number }>>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ReconciliationCategory>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | ReconciliationSeverity>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAutoFixable, setOnlyAutoFixable] = useState(false);

  // States for fixing actions
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [isBatchFixing, setIsBatchFixing] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // Stock cost quick modal
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costTargetItem, setCostTargetItem] = useState<{ id: string; name: string; currentCost: number } | null>(null);
  const [newCostInput, setNewCostInput] = useState<string>("");
  const [savingCost, setSavingCost] = useState(false);

  // Load stock movements
  const loadMovements = async () => {
    try {
      setLoadingMovements(true);
      const { data: rows, error } = await supabase.from("stock_movements").select("stock_item_id,quantity");
      if (error) {
        console.error("[stock_movements] Load error:", error.message);
        toast.error("فشل تحميل حركات المخزون", { description: error.message });
        return;
      }
      if (rows) {
        setMovements(rows.map((r: any) => ({ stock_item_id: r.stock_item_id, quantity: Number(r.quantity ?? 0) })));
      }
    } catch (e) {
      console.error("[stock_movements] Unexpected error:", e);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, []);

  // Audit runs history
  const [auditRuns, setAuditRuns] = useState<AuditRunRecord[]>([]);
  const [pendingRunSave, setPendingRunSave] = useState<"manual" | "auto" | "after_fix" | null>(null);
  const loadAuditRuns = async () => setAuditRuns(await getAuditRuns(30));
  useEffect(() => {
    loadAuditRuns();
  }, []);

  const handleManualScan = async () => {
    setIsScanning(true);
    await db.invalidate();
    await loadMovements();
    setTimeout(() => {
      setIsScanning(false);
      setPendingRunSave("manual");
      toast.success("تم الانتهاء من الفحص والتدقيق الشامل وتحديث النتائج");
    }, 400);
  };

  const handleDeleteRun = async (id: string) => {
    await deleteAuditRun(id);
    setAuditRuns((prev) => prev.filter((r) => r.id !== id));
  };

  // Run comprehensive reconciliation
  const summary = useMemo(() => {
    return runComprehensiveReconciliation(data, movements);
  }, [data, movements]);

  // Persist an audit run once the fresh summary is computed
  useEffect(() => {
    if (!pendingRunSave) return;
    const source = pendingRunSave;
    setPendingRunSave(null);
    saveAuditRun(summary, source).then((rec) => {
      if (rec) setAuditRuns((prev) => [rec, ...prev].slice(0, 30));
    });
  }, [pendingRunSave, summary]);

  // Auto-record a daily snapshot on first visit each day
  useEffect(() => {
    if (loadingMovements || data.loading) return;
    const key = "segilly_recon_last_auto_run";
    const todayKey = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === todayKey) return;
    localStorage.setItem(key, todayKey);
    setPendingRunSave("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMovements, data.loading]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return summary.findings.filter((f) => {
      // Category filter
      if (activeCategory !== "all" && f.category !== activeCategory) return false;

      // Severity filter
      if (selectedSeverity !== "all" && f.severity !== selectedSeverity) return false;

      // Auto-fixable toggle
      if (onlyAutoFixable && !f.autoFixable) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = f.title.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        const matchesTarget = f.targetLabel.toLowerCase().includes(q);
        const matchesId = f.targetId.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTarget && !matchesId) return false;
      }

      return true;
    });
  }, [summary.findings, activeCategory, selectedSeverity, onlyAutoFixable, searchQuery]);

  if (data.loading) return <PageLoadingSkeleton type="table" />;

  // Execute single fix
  const handleSingleFix = async (finding: ReconciliationFinding) => {
    if (finding.fixType === "fix_stock_cost") {
      const item = data.stockItems.find((s) => s.id === finding.targetId);
      setCostTargetItem({
        id: finding.targetId,
        name: finding.targetLabel,
        currentCost: item?.lastUnitCost || 0,
      });
      setNewCostInput(item?.lastUnitCost ? String(item.lastUnitCost) : "");
      setCostModalOpen(true);
      return;
    }

    setFixingId(finding.id);
    try {
      const ok = await executeReconciliationFix(finding);
      if (ok) setPendingRunSave("after_fix");
    } finally {
      setFixingId(null);
    }
  };

  // Execute batch fix
  const handleBatchFixSubmit = async () => {
    setIsBatchFixing(true);
    try {
      const res = await executeAutoFixAll(summary.findings);
      toast.success(`تم بنجاح إصلاح وتصحيح ${res.successCount} مشكلة حسابية ومزامنة القيود`);
      setBatchDialogOpen(false);
      setPendingRunSave("after_fix");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الإصلاح الشامل");
    } finally {
      setIsBatchFixing(false);
    }
  };

  // Save stock cost
  const handleSaveStockCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costTargetItem) return;
    const cost = parseFloat(newCostInput);
    if (isNaN(cost) || cost <= 0) {
      toast.error("يرجى إدخال تكلفة صالحة أكبر من صفر");
      return;
    }
    setSavingCost(true);
    try {
      await db.updateStockCost(costTargetItem.id, cost);
      toast.success(`تم تحديث تكلفة «${costTargetItem.name}» إلى ${fmt(cost)} ج.م بنجاح`);
      setCostModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر تحديث التكلفة");
    } finally {
      setSavingCost(false);
    }
  };

  // Navigate to related target view
  const handleNavigateToTarget = (finding: ReconciliationFinding) => {
    if (finding.targetType === "invoice") {
      navigate({ to: "/invoices" });
    } else if (finding.targetType === "customer") {
      navigate({ to: "/customers" });
    } else if (finding.targetType === "supplier") {
      navigate({ to: "/suppliers" });
    } else if (finding.targetType === "stock_item") {
      navigate({ to: "/inventory" });
    } else if (finding.targetType === "shipment") {
      navigate({ to: "/shipping" as any });
    } else if (finding.targetType === "return") {
      navigate({ to: "/returns" });
    }
  };

  return (
    <AppShell>
      <div dir="rtl" className="space-y-6 pb-24 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="مركز المطابقة والرقابة المالية"
            subtitle="تدقيق شامل وفوري بين الفواتير والدفعات، حسابات العملاء والموردين، حركة المخزون ومتحصلات الشحن."
            icon={<ClipboardCheck className="h-7 w-7 text-primary" />}
          />

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              id="reconcile-scan-btn"
              tone="surface"
              onClick={handleManualScan}
              disabled={isScanning}
              icon={<RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />}
            >
              {isScanning ? "جاري الفحص..." : "إعادة التدقيق"}
            </ActionButton>

            {summary.autoFixableCount > 0 && (
              <ActionButton
                id="reconcile-batch-fix-btn"
                onClick={() => setBatchDialogOpen(true)}
                icon={<Sparkles className="h-4 w-4" />}
              >
                <span>إصلاح تلقائي ({summary.autoFixableCount})</span>
              </ActionButton>
            )}

            <ActionButton
              id="reconcile-export-pdf-btn"
              tone="surface"
              onClick={() => exportReconciliationToPdf(summary)}
              icon={<Printer className="h-4 w-4" />}
            >
              <span>تقرير PDF</span>
            </ActionButton>

            <ActionButton
              id="reconcile-export-excel-btn"
              tone="surface"
              onClick={() => exportReconciliationToExcel(summary)}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            >
              <span>Excel</span>
            </ActionButton>
          </div>
        </div>

        {/* Top KPI Metrics */}
        <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            className="h-full"
            icon={ShieldCheck}
            label="مؤشر الصحة المحاسبية"
            value={summary.healthScore}
            tone={summary.healthScore >= 90 ? "positive" : "danger"}
            format={(n) => `%${Math.round(n)}`}
            sub={`تم فحص ${summary.totalAuditedRecords.invoices + summary.totalAuditedRecords.stockItems + summary.totalAuditedRecords.customers} سجلاً إجمالياً`}
          />
          <MetricCard
            className="h-full"
            icon={AlertCircle}
            label="أخطاء حرجة"
            value={summary.criticalCount}
            tone="danger"
            format={(n) => String(Math.round(n))}
            sub="فروق تحصيل مباشرة أو تكاليف مفقودة"
          />
          <MetricCard
            className="h-full"
            icon={TrendingDown}
            label="فروق المبالغ المعلقة"
            value={summary.totalDiscrepancyAmount}
            format={(n) => `${fmt(n)} ج.م`}
            sub={`${summary.warningCount} تحذيرات + ${summary.noticeCount} تنبيهات`}
          />
          <MetricCard
            className="h-full"
            icon={Sparkles}
            label="إصلاح بنقرة واحدة"
            value={summary.autoFixableCount}
            tone="positive"
            format={(n) => String(Math.round(n))}
            sub={
              summary.autoFixableCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setBatchDialogOpen(true)}
                  className="font-bold text-emerald-600 hover:underline inline-flex items-center gap-1"
                >
                  إصلاح الكل <ChevronRight className="h-3 w-3" />
                </button>
              ) : (
                "تصحيح بدون فقد أي بيانات"
              )
            }
          />
        </div>

        {/* Audit Runs History */}
        <AuditRunsHistory runs={auditRuns} currentScore={summary.healthScore} onDelete={handleDeleteRun} />

        {/* Filter Tabs & Search Controls */}
        <div className="space-y-4">
          {/* Category Tabs */}
          <StatTabs
            value={activeCategory}
            onChange={setActiveCategory}
            options={[
              { value: "all", label: "الكل", count: summary.categoryCounts.all, icon: <Layers className="h-4 w-4" /> },
              { value: "invoices", label: "فواتير ودفعات", count: summary.categoryCounts.invoices, icon: <Receipt className="h-4 w-4" /> },
              { value: "customers", label: "عملاء وأقساط", count: summary.categoryCounts.customers, icon: <Users className="h-4 w-4" /> },
              { value: "stock", label: "مخزون وتكاليف", count: summary.categoryCounts.stock, icon: <Boxes className="h-4 w-4" /> },
              { value: "suppliers", label: "موردين ومشتريات", count: summary.categoryCounts.suppliers, icon: <Truck className="h-4 w-4" /> },
              { value: "shipments", label: "شحنات COD", count: summary.categoryCounts.shipments, icon: <Truck className="h-4 w-4" /> },
              { value: "returns", label: "مرتجعات", count: summary.categoryCounts.returns, icon: <RotateCcw className="h-4 w-4" /> },
            ]}
          />

          {/* Search & Severity Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reconciliation-search-input"
                placeholder="بحث في المشاكل بالاسم، رقم الفاتورة أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterChips
                value={selectedSeverity}
                onChange={setSelectedSeverity}
                options={[
                  { value: "all", label: "كافة المستويات" },
                  { value: "critical", label: "حرج", count: summary.criticalCount },
                  { value: "warning", label: "تحذير", count: summary.warningCount },
                  { value: "notice", label: "تنبيه", count: summary.noticeCount },
                ]}
              />

              {/* Only Auto-Fixable Toggle */}
              <Button
                variant={onlyAutoFixable ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyAutoFixable(!onlyAutoFixable)}
                className={`gap-1.5 h-9 text-xs ${
                  onlyAutoFixable ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>إصلاح تلقائي فقط</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Findings List */}
        {summary.findings.length === 0 ? (
          /* Zero-state: Completely Balanced System */
          <BezelCard className="p-12 text-center border-emerald-500/30 bg-emerald-500/5">
            <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-600 mb-4 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h3 className="text-xl font-bold text-foreground">الحسابات والمخزون متطابقة بنسبة 100%!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2 leading-relaxed">
              لم يكتشف محرك التدقيق أي فروق حسابية أو تكاليف مفقودة أو شحنات غير مسواة. جميع القيود المالية منسجمة تماماً.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={handleManualScan} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                فحص مجدداً
              </Button>
            </div>
          </BezelCard>
        ) : filteredFindings.length === 0 ? (
          /* Filter returned no results */
          <BezelCard className="p-10 text-center">
            <SlidersHorizontal className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <h4 className="font-bold text-foreground">لا توجد نتائج تطابق الفلاتر المحددة</h4>
            <p className="text-xs text-muted-foreground mt-1">جرب تغيير كلمات البحث أو إزالة بعض الفلاتر.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setActiveCategory("all");
                setSelectedSeverity("all");
                setOnlyAutoFixable(false);
                setSearchQuery("");
              }}
            >
              إعادة ضبط الفلاتر
            </Button>
          </BezelCard>
        ) : (
          /* Findings Cards Grid */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>عرض {filteredFindings.length} من أصل {summary.findings.length} مشكلة</span>
              <span>مرتبة حسب الأولوية ومستوى الخطورة</span>
            </div>

            {filteredFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                isFixing={fixingId === finding.id}
                onFix={() => handleSingleFix(finding)}
                onNavigate={() => handleNavigateToTarget(finding)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Batch Auto-Fix Confirmation Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Sparkles className="h-5 w-5" />
              تأكيد الإصلاح والمزامنة التلقائية
            </DialogTitle>
            <DialogDescription className="text-sm">
              سيقوم النظام بإصلاح ومزامنة كافة الفروق الحسابية القابلة للحل الآمن دفعة واحدة:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="p-3 bg-muted/60 rounded-lg space-y-2 border">
              <div className="flex justify-between font-medium">
                <span>عدد العمليات القابلة للتصحيح:</span>
                <span className="font-bold text-emerald-600">{summary.autoFixableCount} بند</span>
              </div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>إعادة حساب المبالغ المسددة في الفواتير حسب إيصالات الدفع الفعلية.</li>
                <li>تحديث حالات الفواتير المسددة بالكامل تلقائياً.</li>
                <li>تسوية وتوريد متحصلات الشحن المسلّمة إلى الصندوق.</li>
              </ul>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-md">
              ⚠️ هذه العملية آمنة تماماً ولا تؤدي إلى حذف أي فواتير أو دفعات أصلية.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBatchDialogOpen(false)}
              disabled={isBatchFixing}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleBatchFixSubmit}
              disabled={isBatchFixing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isBatchFixing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جاري التنفيذ...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  تنفيذ الإصلاح الآن ({summary.autoFixableCount})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Cost Quick Dialog */}
      <Dialog open={costModalOpen} onOpenChange={setCostModalOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <form onSubmit={handleSaveStockCost}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                تحديد تكلفة الصنف
              </DialogTitle>
              <DialogDescription>
                الصنف «{costTargetItem?.name}» مسجل بتكلفة 0 ج.م. حدد تكلفة الشراء للقطعة لتصحيح حساب الأرباح:
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="stock-cost-input" className="text-xs font-semibold">
                  سعر التكلفة للقطعة (ج.م) *
                </Label>
                <div className="relative">
                  <Input
                    id="stock-cost-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="مثال: 150.00"
                    value={newCostInput}
                    onChange={(e) => setNewCostInput(e.target.value)}
                    className="pl-12 font-bold"
                    autoFocus
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    ج.م
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCostModalOpen(false)}
                disabled={savingCost}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={savingCost} className="gap-2">
                {savingCost ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                حفظ وتحديث التكلفة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

interface FindingCardProps {
  key?: React.Key;
  finding: ReconciliationFinding;
  isFixing: boolean;
  onFix: () => void | Promise<void>;
  onNavigate: () => void;
}

// Finding Item Card Component
function FindingCard({
  finding,
  isFixing,
  onFix,
  onNavigate,
}: FindingCardProps) {
  const severityConfig = {
    critical: {
      border: "border-rose-500/30 hover:border-rose-500/50",
      badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      label: "حرج 🔴",
      icon: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    },
    warning: {
      border: "border-amber-500/30 hover:border-amber-500/50",
      badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      label: "تحذير 🟡",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    },
    notice: {
      border: "border-blue-500/30 hover:border-blue-500/50",
      badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      label: "تنبيه 🔵",
      icon: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
    },
  }[finding.severity];

  const categoryName = {
    invoices: "فواتير ودفعات",
    customers: "عملاء وأقساط",
    suppliers: "موردين ومشتريات",
    stock: "مخزون وتكاليف",
    shipments: "شحنات COD",
    returns: "مرتجعات",
    all: "عام",
  }[finding.category];

  return (
    <BezelCard className={`p-4 transition-all duration-200 ${severityConfig.border}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5">{severityConfig.icon}</div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityConfig.badge}`}>
                {severityConfig.label}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {categoryName}
              </span>
              {finding.differenceAmount !== undefined && finding.differenceAmount > 0 && (
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                  فرق: {fmt(finding.differenceAmount)} ج.م
                </span>
              )}
            </div>

            <h4 className="font-bold text-sm text-foreground">{finding.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{finding.description}</p>

            {/* Impact indicator */}
            <div className="text-[11px] text-amber-700 dark:text-amber-400/90 font-medium flex items-center gap-1.5 pt-1">
              <span className="font-bold">الأثر الرقابي:</span>
              <span>{finding.impact}</span>
            </div>

            {/* Key Comparison Values if present */}
            {finding.details && (
              <div className="flex flex-wrap gap-2 pt-2 text-[11px]">
                {Object.entries(finding.details).map(([key, val]) => (
                  <div key={key} className="bg-muted/70 px-2 py-1 rounded border text-muted-foreground">
                    <span className="font-semibold text-foreground">{key}:</span> {val}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
          {finding.autoFixable ? (
            <Button
              size="sm"
              onClick={onFix}
              disabled={isFixing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8 font-semibold w-full sm:w-auto shadow-sm"
            >
              {isFixing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>إصلاح تلقائي</span>
            </Button>
          ) : finding.fixType === "fix_stock_cost" ? (
            <Button
              size="sm"
              onClick={onFix}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-8 font-semibold w-full sm:w-auto shadow-sm"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>ضبط التكلفة</span>
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            onClick={onNavigate}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8 w-full sm:w-auto"
          >
            <span>فتح السجل</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </BezelCard>
  );
}
