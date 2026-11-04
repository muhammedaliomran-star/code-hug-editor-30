import { EmptyState } from "@/components/EmptyState";
import { PageLoadingSkeleton } from "@/components/LoadingScreen";
import { useMemo, useState } from "react";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { getProductStockInBranch, calculateBranchStockValuation } from "@/lib/branch-system";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
import { ActionButton } from "@/components/ActionButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Reveal } from "@/components/Reveal";
import {
  db,
  useDB,
  fmt,
  findStockByBarcode,
  lowStockThreshold,
  useShopSettings,
  type StockItem,
} from "@/lib/store";
import {
  Package,
  Search,
  Eye,
  EyeOff,
  AlertTriangle,
  Boxes,
  Wallet,
  Pencil,
  Trash2,
  History,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  ScanLine,
  Plus,
  PackagePlus,
  Scale,
  Tag,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { motion } from "framer-motion";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { AddProductDialog } from "@/components/AddProductDialog";
import { BarcodeLabelModal } from "@/components/BarcodeLabelModal";
import { InventoryExcelDialog } from "@/components/InventoryExcelDialog";
import { AdjustDialog } from "@/components/inventory/AdjustDialog";
import { MoveToWarehouseDialog } from "@/components/inventory/MoveToWarehouseDialog";
import { EditDialog } from "@/components/inventory/EditDialog";
import { HistoryDialog } from "@/components/inventory/HistoryDialog";

const LOW_STOCK = lowStockThreshold;

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <InventoryPage />
      </PageTransition>
    </AppShell>
  );
}

type Tab = "all" | "out" | "low";

function InventoryPage() {
  useShopSettings(); // re-render when the low-stock threshold changes
  const data = useDB();
  const { activeBranchId, activeBranch, isAllBranches } = useActiveBranch();
  const { privacy, toggle } = usePrivacy();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [moveItem, setMoveItem] = useState<StockItem | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefillBarcode, setAddPrefillBarcode] = useState<string | undefined>(undefined);
  const [labelItem, setLabelItem] = useState<StockItem | null>(null);
  const [excelOpen, setExcelOpen] = useState(false);

  const onScanned = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (found) {
      setQ(found.name);
      toast.success(`تم العثور على: ${found.name}`);
    } else {
      toast.error("الكود غير موجود في المخزن", {
        description: `الباركود: ${code}`,
        action: {
          label: "إضافة منتج جديد",
          onClick: () => {
            setAddPrefillBarcode(code);
            setAddOpen(true);
          },
        },
      });
    }
  };

  // أرصدة الفرع النشط (Multi-Location view)
  const branchQty = (itemId: string, fallback: number) =>
    isAllBranches ? fallback : getProductStockInBranch(activeBranchId, itemId, fallback).quantity;

  const totals = useMemo(() => {
    const totalItems = data.stockItems.length;
    if (!isAllBranches && activeBranch) {
      const val = calculateBranchStockValuation(activeBranch.id, data.stockItems);
      const low = data.stockItems.filter((it) => {
        const st = getProductStockInBranch(activeBranch.id, it.id, it.quantity);
        return st.quantity <= (st.minStock || LOW_STOCK());
      }).length;
      const avgCost = totalItems > 0 ? data.stockItems.reduce((s, it) => s + it.lastUnitCost, 0) / totalItems : 0;
      return { totalItems, value: val.totalCostValue, low, avgCost };
    }
    const value = data.stockItems.reduce((s, it) => s + it.quantity * it.lastUnitCost, 0);
    const avgCost =
      totalItems > 0 ? data.stockItems.reduce((s, it) => s + it.lastUnitCost, 0) / totalItems : 0;
    const low = data.stockItems.filter((it) => it.quantity < LOW_STOCK()).length;
    return { totalItems, value, low, avgCost };
  }, [data.stockItems, isAllBranches, activeBranch]);

  const list = useMemo(() => {
    return data.stockItems
      .filter((it) => {
        const qty = branchQty(it.id, it.quantity);
        if (tab === "out") return qty <= 0;
        if (tab === "low") return qty > 0 && qty < LOW_STOCK();
        return true;
      })
      .filter((it) => (q ? it.name.includes(q) || (it.barcode ?? "").includes(q) : true))
      .sort((a, b) => branchQty(a.id, a.quantity) - branchQty(b.id, b.quantity));
  }, [data.stockItems, q, tab, isAllBranches, activeBranchId]);

  if (data.loading) return <PageLoadingSkeleton type="table" />;

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = list.map((it) => ({
        "اسم المنتج": it.name,
        الكمية: it.quantity,
        "سعر الشراء": it.lastUnitCost,
        "سعر البيع": it.salePrice,
        "قيمة المخزن": it.quantity * it.lastUnitCost,
        "هامش الربح": it.salePrice - it.lastUnitCost,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "المخزن");
      XLSX.writeFile(wb, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف Excel");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التصدير");
    }
  };

  const exportPDF = () => {
    const totalValue = list.reduce((s, it) => s + it.quantity * it.lastUnitCost, 0);
    const lowCount = list.filter((it) => it.quantity > 0 && it.quantity < LOW_STOCK()).length;
    const outCount = list.filter((it) => it.quantity <= 0).length;
    const body = `
<h2 class="sec">قائمة الأصناف</h2>
<div class="t-wrap"><table><thead><tr>
  <th>اسم المنتج</th><th class="num">الكمية النظامية</th><th class="num">سعر الشراء</th><th class="num">سعر البيع</th>
  <th class="num">قيمة المخزن</th><th>جرد فعلي</th><th>فرق</th>
</tr></thead><tbody>
${
  list
    .map((it) => {
      const cls = it.quantity <= 0 ? "out" : it.quantity < LOW_STOCK() ? "low" : "";
      return `<tr class="${cls}">
    <td>${esc(it.name)}</td>
    <td class="num">${fmt(it.quantity)}</td>
    <td class="num">${fmt(it.lastUnitCost)}</td>
    <td class="num">${fmt(it.salePrice)}</td>
    <td class="num">${fmt(it.quantity * it.lastUnitCost)}</td>
    <td style="min-width:70px"></td><td style="min-width:70px"></td>
  </tr>`;
    })
    .join("") || `<tr><td colspan="7" class="empty">لا توجد أصناف</td></tr>`
}
</tbody></table></div>
<div class="sig"><div>توقيع القائم بالجرد</div><div>توقيع المراجع</div></div>`;
    const html = pdfDocument({
      docTitle: "تقرير المخزن — سِجلّي",
      badge: "كشف جرد",
      title: "تقرير المخزن — جرد فعلي",
      lede: "قائمة الأصناف مع الكميات النظامية وخانات فارغة لتسجيل الجرد الفعلي والفروقات.",
      meta: [
        { label: "تاريخ التقرير", value: new Date().toLocaleDateString("en-US") },
        { label: "عدد الأصناف", value: String(list.length) },
      ],
      kpis: [
        { label: "عدد الأصناف", value: String(list.length) },
        { label: "قيمة المخزن", value: `${fmt(totalValue)} ج.م`, tone: "brand" },
        { label: "أصناف قاربت النفاد", value: String(lowCount), tone: "warn" },
        { label: "أصناف منتهية", value: String(outCount), tone: "danger" },
      ],
      body,
      page: "A4 landscape",
    });
    if (!openPdfDocument(html, { autoPrint: true })) toast.error("اسمح بفتح النوافذ المنبثقة");
  };

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle="إدارة الأصناف والكميات وأسعار الشراء والبيع."
        icon={<Package className="w-7 h-7" />}
        action={
          <div className="flex items-center gap-2">
            <ActionButton
              tone="surface"
              onClick={() => setExcelOpen(true)}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">إكسيل (استيراد/تصدير)</span>
            </ActionButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton
                  tone="surface"
                  icon={<Download className="h-4 w-4" />}
                >
                  <span className="hidden sm:inline">تصدير</span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-foreground" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2">
                  <FileText className="w-4 h-4 text-foreground" /> PDF (للجرد)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ActionButton
              tone={privacy ? "primary" : "surface"}
              onClick={toggle}
              title="إخفاء الأرقام"
              icon={privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </ActionButton>
            <ActionButton
              onClick={() => {
                setAddPrefillBarcode(undefined);
                setAddOpen(true);
              }}
              icon={<PackagePlus className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">إضافة منتج</span>
            </ActionButton>
          </div>
        }
      />

      <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4 mb-14">
        <MetricCard
          className="h-full"
          icon={Boxes}
          label="إجمالي الأصناف"
          value={totals.totalItems}
          format={(n) => String(Math.round(n))}
          sub="عدد الأصناف الفريدة"
        />
        <MetricCard
          className="h-full"
          icon={Wallet}
          label="قيمة المخزن"
          value={totals.value}
          format={(n) => `${fmt(n)} ج.م`}
          masked={privacy}
          sub="الكمية × سعر الشراء"
        />
        <MetricCard
          className="h-full"
          icon={TrendingUp}
          label="متوسط سعر الشراء"
          value={totals.avgCost}
          format={(n) => `${fmt(n)} ج.م`}
          masked={privacy}
          sub="متوسط على كل الأصناف"
        />
        <MetricCard
          className="h-full"
          icon={AlertTriangle}
          label="نواقص"
          value={totals.low}
          tone={totals.low > 0 ? "danger" : "neutral"}
          format={(n) => String(Math.round(n))}
          sub={`أقل من ${LOW_STOCK()} وحدات • مرتبط بالمنبه`}
        />
      </div>

      <div className="sticky-search-bar">
        <StatTabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          className="mb-4"
          options={[
            { value: "all", label: "الكل", count: data.stockItems.length },
            {
              value: "low",
              label: "ناقص",
              count: data.stockItems.filter((it) => it.quantity > 0 && it.quantity < LOW_STOCK()).length,
            },
            {
              value: "out",
              label: "نفذ",
              count: data.stockItems.filter((it) => it.quantity <= 0).length,
            },
          ]}
        />

        <div className="mb-5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم المنتج أو الباركود..."
              className="pr-10 pl-10"
            />
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-[color,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              title="مسح باركود"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <Reveal delay={140}>
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {list.length} صنف
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="bezel-shell">
            <div className="bezel-core px-6 py-10">
              <EmptyState
                icon={Package}
                title="المخزن فاضي."
                hint="أضف فاتورة شراء وهيتعبّى المخزن تلقائيًا بأصنافها."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setAddPrefillBarcode(undefined);
                      setAddOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" /> إضافة أول منتج
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[64vh]">
            <div className="flex flex-col gap-3 pl-1">
              {list.map((it, idx) => {
                const shownQty = branchQty(it.id, it.quantity);
                const out = shownQty <= 0;
                const low = !out && shownQty < LOW_STOCK();
                const profit = it.salePrice - it.lastUnitCost;
                const margin = it.salePrice > 0 ? (profit / it.salePrice) * 100 : 0;

                return (
                  <div
                    key={it.id}
                    className="group bezel-shell bezel-lift animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both"
                    style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                  >
                    <div className="bezel-core grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                      {/* الهوية */}
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold",
                            "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border",
                          )}
                        >
                          <Package className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-bold leading-tight">{it.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {(it.itemType || it.size) && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Scale className="h-3 w-3" />
                                {it.itemType || "غير محدد"}
                                {it.size ? ` — ${it.size}` : ""}
                              </span>
                            )}
                            {it.barcode && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                <ScanLine className="h-3 w-3" /> {it.barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* المقاييس */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="text-[10px] text-muted-foreground mb-0.5">الكمية</div>
                            <div
                              className={cn(
                                "text-numeric text-xl font-extrabold leading-none",
                                out ? "text-danger" : low ? "text-warning" : "text-foreground",
                                privacy && "privacy-blur",
                              )}
                            >
                              {fmt(shownQty)}
                            </div>
                            {!isAllBranches && activeBranch && (
                              <div className="text-[9px] text-primary font-bold mt-0.5">
                                رصيد {activeBranch.name}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col">
                            <div className="text-[10px] text-muted-foreground mb-0.5">
                              الربح المتوقع
                            </div>
                            <div
                              className={cn(
                                "text-numeric font-bold leading-none flex items-center gap-1",
                                profit >= 0 ? "text-success" : "text-danger",
                                privacy && "privacy-blur",
                              )}
                            >
                              {profit >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                              {fmt(profit)} <span className="text-[10px]">ج.م</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div
                            className={cn(
                              "rounded-lg bg-foreground/[0.03] p-1.5 text-center",
                              privacy && "privacy-blur",
                            )}
                          >
                            <div className="text-[9px] text-muted-foreground uppercase">
                              التكلفة
                            </div>
                            <div className="text-xs font-bold">{fmt(it.lastUnitCost)}</div>
                          </div>
                          <div
                            className={cn(
                              "rounded-lg bg-primary/5 p-1.5 text-center",
                              privacy && "privacy-blur",
                            )}
                          >
                            <div className="text-[9px] text-primary/70 uppercase">البيع</div>
                            <div className="text-xs font-bold text-primary">
                              {fmt(it.salePrice)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* الإجراءات */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:duration-500 md:ease-[cubic-bezier(0.32,0.72,0,1)] md:group-hover:opacity-100 md:focus-within:opacity-100">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
                                onClick={() => setLabelItem(it)}
                              >
                                <Tag className="w-4 h-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">طباعة ملصق باركود</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
                                onClick={() => setAdjustItem(it)}
                              >
                                <Scale className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">تسوية كمية</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
                                onClick={() => setHistoryItem(it)}
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">سجل الحركة</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
                                onClick={() => setEditing(it)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">تعديل الصنف</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
                                onClick={() => setMoveItem(it)}
                              >
                                <Boxes className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">نقل للمخازن</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn danger rounded-full text-danger hover:bg-danger/10 hover:text-danger"
                                onClick={() => setDeleteId(it.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">حذف</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Reveal>
      <AdjustDialog item={adjustItem} onClose={() => setAdjustItem(null)} />
      <MoveToWarehouseDialog item={moveItem} onClose={() => setMoveItem(null)} />
      <EditDialog
        item={editing}
        onClose={() => setEditing(null)}
        existingBarcodes={data.stockItems.map((s) => s.barcode)}
      />

      <BarcodeLabelModal
        open={!!labelItem}
        onOpenChange={(v) => !v && setLabelItem(null)}
        product={labelItem}
      />

      <InventoryExcelDialog
        open={excelOpen}
        onOpenChange={setExcelOpen}
        stockItems={data.stockItems}
      />

      <AddProductDialog
        open={addOpen}
        onOpenChange={(v: boolean) => {
          setAddOpen(v);
          if (!v) setAddPrefillBarcode(undefined);
        }}
        prefillBarcode={addPrefillBarcode}
        existingBarcodes={data.stockItems.map((s) => s.barcode)}
      />
      <HistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />
      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={onScanned}
        title="مسح باركود — بحث في المخزن"
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف المنتج؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف المنتج من المخزن. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try {
                  await db.removeStockItem(deleteId);
                  toast.success("تم حذف المنتج");
                } catch (e: any) {
                  toast.error(e?.message ?? "تعذر الحذف");
                } finally {
                  setDeleteId(null);
                }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
