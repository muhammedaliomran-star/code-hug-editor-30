import { EmptyState } from "@/components/EmptyState";
import { PageLoadingSkeleton } from "@/components/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { getProductStockInBranch, calculateBranchStockValuation } from "@/lib/branch-system";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
import { ActionButton } from "@/components/ActionButton";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  fetchStockHistory,
  findStockByBarcode,
  lowStockThreshold,
  useShopSettings,
  PRODUCT_TYPES,
  WAREHOUSE_SEASONS,
  WAREHOUSE_CATEGORIES,
  type WarehouseSeason,
  type StockItem,
  type StockHistoryEntry,
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
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  ScanLine,
  Plus,
  Sparkles,
  PackagePlus,
  Scale,
  Loader2,
  Tag,
  Copy,
  RotateCcw,
  Undo2,
  MoreVertical,
} from "lucide-react";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";
import { invalidateCache } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { generateBarcode } from "@/lib/barcode";
import { AddProductDialog } from "@/components/AddProductDialog";
import { posNum, NUM_CLS, GroupLabel } from "@/components/ProductForm";
import { BarcodeLabelModal } from "@/components/BarcodeLabelModal";
import { InventoryExcelDialog } from "@/components/InventoryExcelDialog";

const LOW_STOCK = lowStockThreshold;

const REASONS = [
  { value: "damage", label: "تلف / كسر" },
  { value: "correction", label: "تصحيح جرد" },
  { value: "gift", label: "هدية / عينة" },
  { value: "return", label: "مرتجع" },
  { value: "loss", label: "فقدان" },
  { value: "other", label: "أخرى" },
];

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
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [moveItem, setMoveItem] = useState<StockItem | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefillBarcode, setAddPrefillBarcode] = useState<string | undefined>(undefined);
  const [labelItem, setLabelItem] = useState<StockItem | null>(null);
  const [excelOpen, setExcelOpen] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"qty" | "name" | "price" | "newest" | "low">("qty");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // Realtime: refresh stock_items across devices when anything changes.
  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (!uid || cancelled) return;
        channel = supabase
          .channel("inventory-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `user_id=eq.${uid}` }, () => {
            invalidateCache("stock_items");
          })
          .subscribe();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      if (channel) {
        import("@/integrations/supabase/client").then(({ supabase }) => supabase.removeChannel(channel)).catch(() => {});
      }
    };
  }, []);
  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const normalizeAr = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/[إأآا]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[ًٌٍَُِّْ]/g, "")
      .trim();

  const onScanned = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (found) {
      setSearchInput(found.name);
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
      const out = data.stockItems.filter((it) => getProductStockInBranch(activeBranch.id, it.id, it.quantity).quantity <= 0).length;
      const low = data.stockItems.filter((it) => {
        const st = getProductStockInBranch(activeBranch.id, it.id, it.quantity);
        return st.quantity > 0 && st.quantity < (st.minStock || it.minStock || LOW_STOCK());
      }).length;
      return { totalItems, value: val.totalCostValue, retailValue: val.totalRetailValue, profit: val.potentialProfit, low, out };
    }
    const value = data.stockItems.reduce((s, it) => s + it.quantity * it.lastUnitCost, 0);
    const retailValue = data.stockItems.reduce((s, it) => s + it.quantity * it.salePrice, 0);
    const profit = retailValue - value;
    const out = data.stockItems.filter((it) => it.quantity <= 0).length;
    const low = data.stockItems.filter((it) => it.quantity > 0 && it.quantity < (it.minStock || LOW_STOCK())).length;
    return { totalItems, value, retailValue, profit, low, out };
  }, [data.stockItems, isAllBranches, activeBranch]);

  const list = useMemo(() => {
    return data.stockItems
      .filter((it) => (showArchived ? true : !it.archived))
      .filter((it) => (categoryFilter === "all" ? true : (it.category || "") === categoryFilter))
      .filter((it) => {
        const qty = branchQty(it.id, it.quantity);
        const threshold = it.minStock || LOW_STOCK();
        if (tab === "out") return qty <= 0;
        if (tab === "low") return qty > 0 && qty < threshold;
        return true;
      })
      .filter((it) => {
        if (!debouncedQ) return true;
        const nq = normalizeAr(debouncedQ);
        return (
          normalizeAr(it.name).includes(nq) ||
          (it.barcode ?? "").toLowerCase().includes(debouncedQ.toLowerCase()) ||
          normalizeAr(it.size ?? "").includes(nq) ||
          normalizeAr(it.itemType ?? "").includes(nq)
        );
      })
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name, "ar");
        if (sortKey === "price") return b.salePrice - a.salePrice;
        if (sortKey === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortKey === "low") return (a.minStock || LOW_STOCK()) - (b.minStock || LOW_STOCK());
        return branchQty(a.id, a.quantity) - branchQty(b.id, b.quantity);
      });
  }, [data.stockItems, debouncedQ, tab, isAllBranches, activeBranchId]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedList = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        "نسبة الربح": it.salePrice - it.lastUnitCost,
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
    const lowCount = list.filter((it) => it.quantity > 0 && it.quantity < (it.minStock || LOW_STOCK())).length;
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
      const cls = it.quantity <= 0 ? "out" : it.quantity < (it.minStock || LOW_STOCK()) ? "low" : "";
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

  const printPageLabels = () => {
    const items = paginatedList.filter((it) => it.barcode);
    if (items.length === 0) { toast.error("لا توجد منتجات بباركود في هذه الصفحة"); return; }
    const w = window.open("", "_blank");
    if (!w) { toast.error("المتصفح منع فتح نافذة"); return; }
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ملصقات</title><style>@page{size:50mm 30mm;margin:2mm}body{margin:0;font-family:Tahoma,sans-serif}.label{width:46mm;text-align:center;margin:2mm}.name{font-size:9pt;font-weight:700}.price{font-size:11pt;font-weight:800;margin-top:1mm}.bars{height:11mm;display:flex;align-items:stretch;justify-content:center;gap:1px;margin:1.5mm 0 .5mm}.bars i{background:#0b1220;display:block}.bars b{background:#fff;display:block}.code{font-family:monospace;font-size:8pt;letter-spacing:1px;direction:ltr}</style></head><body>` +
      items.map((it) => {
        const bars = Array.from(it.barcode || "").map((d) => `<i style="width:${1 + (Number(d) % 4)}px"></i><b style="width:${1 + ((Number(d) + 2) % 3)}px"></b>`).join("");
        return `<div class="label"><div class="name">${it.name}${it.size ? " — " + it.size : ""}</div><div class="price">${it.salePrice} ج.م</div><div class="bars">${bars}</div><div class="code">${it.barcode}</div></div>`;
      }).join("") + `</body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 300);
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
              title="استيراد بيانات المنتجات من Excel"
              icon={<FileSpreadsheet className="h-4 w-4 shrink-0" />}
            >
              <span className="hidden sm:inline">استيراد Excel</span>
            </ActionButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton
                  tone="surface"
                  title="تصدير البيانات"
                  icon={<Download className="h-4 w-4 shrink-0" />}
                >
                  <span className="hidden sm:inline">تصدير</span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-foreground" /> تصدير Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-foreground" /> PDF (للجرد)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ActionButton
              tone={privacy ? "primary" : "surface"}
              onClick={toggle}
              title={privacy ? "إظهار الأرقام" : "إخفاء الأرقام"}
              icon={privacy ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
            >
            </ActionButton>
            <ActionButton
              onClick={() => {
                setAddPrefillBarcode(undefined);
                setAddOpen(true);
              }}
               icon={<PackagePlus className="h-4 w-4 shrink-0" />}
            >
              <span className="hidden sm:inline">إضافة منتج</span>
            </ActionButton>
          </div>
        }
      />

      <div className="mb-14 grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          className="h-full"
          icon={Boxes}
          label="إجمالي الأصناف"
          value={totals.totalItems}
          tone="info"
          format={(n) => String(Math.round(n))}
          sub="عدد الأصناف الفريدة"
        />
        <MetricCard
          className="h-full"
          icon={Wallet}
          label="قيمة المخزن"
          value={totals.value}
          tone="info"
          format={(n) => `${fmt(n)} ج.م`}
          masked={privacy}
          sub="الكمية × سعر الشراء"
        />
        <MetricCard
          className="h-full"
          icon={Wallet}
          label="قيمة البيع المتوقعة"
          value={totals.retailValue}
          tone="info"
          format={(n) => `${fmt(n)} ج.م`}
          masked={privacy}
          sub="الكمية × سعر البيع"
        />
        <MetricCard
          className="h-full"
          icon={TrendingUp}
          label="الربح المتوقع"
          value={totals.profit}
          tone={totals.profit >= 0 ? "positive" : "danger"}
          format={(n) => `${fmt(n)} ج.م`}
          masked={privacy}
          sub="قيمة البيع − التكلفة"
        />
        <MetricCard
          className="h-full"
          icon={AlertTriangle}
          label="منخفض"
          value={totals.low}
          tone={totals.low > 0 ? "warning" : "positive"}
          format={(n) => String(Math.round(n))}
          sub={totals.low > 0 ? "أقل من الحد الأدنى • يحتاج متابعة" : "لا توجد أصناف منخفضة"}
        />
        <MetricCard
          className="h-full"
          icon={AlertTriangle}
          label="نافد"
          value={totals.out}
          tone={totals.out > 0 ? "danger" : "positive"}
          format={(n) => String(Math.round(n))}
          sub={totals.out > 0 ? "يحتاج إعادة توريد" : "لا توجد أصناف نافدة"}
        />
      </div>

      <div className="sticky-search-bar">
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم، الباركود، المقاس أو النوع..."
              className="h-10 pr-10 pl-10"
            />
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-[color,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.08] hover:text-foreground"
              title="مسح باركود"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>
        </div>

        <StatTabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          className="mb-3"
          options={[
            { value: "all", label: "الكل", count: data.stockItems.length },
            {
              value: "low",
              label: "ناقص",
              count: data.stockItems.filter((it) => it.quantity > 0 && it.quantity < (it.minStock || LOW_STOCK())).length,
            },
            {
              value: "out",
              label: "نفذ",
              count: data.stockItems.filter((it) => it.quantity <= 0).length,
            },
          ]}
        />

        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={sortKey} onValueChange={(v) => { setSortKey(v as any); setPage(1); }}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-[150px]">
              <SelectValue placeholder="فرز" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qty">حسب الكمية</SelectItem>
              <SelectItem value="name">حسب الاسم</SelectItem>
              <SelectItem value="price">حسب السعر</SelectItem>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="low">الأكثر نقصًا</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-[140px]">
              <SelectValue placeholder="تصنيف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {Array.from(new Set(data.stockItems.map((it) => it.category).filter(Boolean))).map((c) => (
                <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant={showArchived ? "default" : "outline"} className="h-9 w-full rounded-xl text-xs sm:w-auto" onClick={() => { setShowArchived((v) => !v); setPage(1); }}>
            {showArchived ? "إخفاء المؤرشف" : "عرض المؤرشف"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 w-full gap-2 rounded-xl text-xs sm:ml-auto sm:w-auto">
                <MoreVertical className="h-4 w-4" /> إجراءات
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl" className="min-w-48">
              <DropdownMenuItem onSelect={() => setProfitOpen(true)}><TrendingUp className="ml-2 h-4 w-4" />تقرير الأرباح</DropdownMenuItem>
              <DropdownMenuItem onSelect={printPageLabels}><FileText className="ml-2 h-4 w-4" />طباعة ملصقات الصفحة</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-xs font-bold">{selectedIds.size} محدد</span>
          <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => setSelectedIds(new Set())}>إلغاء التحديد</Button>
          <Button size="sm" variant="destructive" className="h-8 rounded-xl text-xs" onClick={async () => {
            if (!confirm(`أرشفة ${selectedIds.size} منتج؟`)) return;
            for (const id of selectedIds) { try { await db.archiveStockItem(id); } catch {} }
            setSelectedIds(new Set());
            toast.success("تمت الأرشفة");
          }}>أرشفة جماعية</Button>
        </div>
      )}
      <Reveal delay={140}>
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {list.length} صنف
            </div>
          </div>
        </div>

        {paginatedList.length === 0 && list.length === 0 ? (
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
              {paginatedList.map((it, idx) => {
                const shownQty = branchQty(it.id, it.quantity);
                const out = shownQty <= 0;
                const low = !out && shownQty < (it.minStock || LOW_STOCK());
                const profit = it.salePrice - it.lastUnitCost;
                const margin = it.salePrice > 0 ? (profit / it.salePrice) * 100 : 0;
                const stockLabel = out ? "نافد" : low ? "منخفض" : "متوفر";
                const stockTone = out ? "text-danger bg-danger/10 ring-danger/20" : low ? "text-warning bg-warning/10 ring-warning/20" : "text-success bg-success/10 ring-success/20";

                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button, input, a, [role='menuitem']")) return;
                      setDetailItem(it);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailItem(it);
                      }
                    }}
                    className="group bezel-shell bezel-lift cursor-pointer animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                  >
                    <div dir="ltr" className="bezel-core grid grid-cols-1 items-center gap-5 p-4 md:grid-cols-[auto_minmax(0,1.25fr)_minmax(0,1.1fr)] md:gap-6 md:p-5">
                      {/* الهوية */}
                      <div dir="rtl" className="min-w-0 md:order-3 md:justify-self-end md:text-right">
                        <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold",
                            "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border",
                          )}
                        >
                          {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-5 w-5 rounded object-cover" /> : <Package className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-base font-black leading-tight"><span className="me-2 font-mono text-xs text-primary">#{it.productCode ?? "—"}</span>{it.name}</div>
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
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", stockTone)}>{stockLabel}</span>
                          {it.barcode && <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">كود: {it.barcode}</span>}
                        </div>
                      </div>

                      {/* المقاييس */}
                      <div dir="rtl" className="min-w-0 md:order-2">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                            <div className="text-[10px] text-muted-foreground mb-0.5">التكلفة</div>
                            <div className={cn("text-numeric font-bold leading-none", privacy && "privacy-blur")}>{fmt(it.lastUnitCost)} <span className="text-[10px]">ج.م</span></div>
                          </div>

                          <div className="flex flex-col">
                            <div className="text-[10px] text-muted-foreground mb-0.5">سعر البيع</div>
                            <div className={cn("text-numeric font-bold leading-none text-primary", privacy && "privacy-blur")}>{fmt(it.salePrice)} <span className="text-[10px]">ج.م</span></div>
                          </div>
                          <div className="flex flex-col">
                            <div className="text-[10px] text-muted-foreground mb-0.5">الربح</div>
                            <div className={cn("text-numeric font-bold leading-none", profit >= 0 ? "text-success" : "text-danger", privacy && "privacy-blur")}>
                              {profit >= 0 ? <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> : <TrendingDown className="mr-1 inline h-3.5 w-3.5" />}
                              {fmt(profit)} <span className="text-[10px]">ج.م</span>
                            </div>
                            <div className={cn("mt-1 text-[10px] font-bold", profit >= 0 ? "text-success/80" : "text-danger/80")}>هامش {margin.toFixed(1)}%</div>
                          </div>
                        </div>
                        {(() => {
                          const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
                          const sold = data.invoiceItems
                            .filter((ii) => (ii.stockItemId === it.id || ii.name === it.name) && new Date(ii.createdAt).getTime() >= since)
                            .reduce((s, ii) => s + (ii.quantity || 1), 0);
                          const daily = sold / 30;
                          const suggested = Math.max(0, Math.ceil(daily * 14) - shownQty);
                          if (suggested <= 0) return null;
                          return <div className="mt-2 text-[10px] font-bold text-warning">مقترح إعادة طلب: {suggested} وحدة (معدل بيع {daily.toFixed(1)}/يوم)</div>;
                        })()}
                      </div>

                      {/* الإجراءات */}
                      <div dir="ltr" className="flex items-center justify-start gap-2 md:order-1 md:justify-self-start">
                        <input aria-label={`تحديد ${it.name}`} type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer" checked={selectedIds.has(it.id)} onChange={(e) => { const ns = new Set(selectedIds); if (e.target.checked) ns.add(it.id); else ns.delete(it.id); setSelectedIds(ns); }} />
                        <Button size="sm" className="h-9 gap-1.5 rounded-xl px-3" onClick={() => setEditing(it)}>
                          <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">تعديل</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" aria-label="إجراءات إضافية">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" dir="rtl" className="min-w-48">
                            <DropdownMenuItem onSelect={() => setLabelItem(it)}><Tag className="ml-2 h-4 w-4" />طباعة ملصق باركود</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setAdjustItem(it)}><Scale className="ml-2 h-4 w-4" />تسوية كمية</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setHistoryItem(it)}><History className="ml-2 h-4 w-4" />سجل الحركة</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setMoveItem(it)}><Boxes className="ml-2 h-4 w-4" />نقل لمخزن آخر</DropdownMenuItem>
                            <DropdownMenuItem onSelect={async () => { try { await db.addStockItem({ name: `${it.name} (نسخة)`, quantity: it.quantity, lastUnitCost: it.lastUnitCost, salePrice: it.salePrice, size: it.size, itemType: it.itemType, minStock: it.minStock, barcode: null }); toast.success("تم نسخ المنتج"); } catch (e: any) { toast.error(e?.message ?? "تعذر النسخ"); } }}><Copy className="ml-2 h-4 w-4" />نسخ المنتج</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { window.location.assign(`/returns?product=${encodeURIComponent(it.name)}`); }}><Undo2 className="ml-2 h-4 w-4" />مرتجع للمورد</DropdownMenuItem>
                            {it.archived && <DropdownMenuItem onSelect={async () => { try { await db.restoreStockItem(it.id); toast.success("تمت استعادة المنتج"); } catch (e: any) { toast.error(e?.message ?? "تعذر الاستعادة"); } }}><RotateCcw className="ml-2 h-4 w-4" />استعادة المنتج</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {!it.archived && <Button size="icon" variant="ghost" aria-label="حذف المنتج" className="h-9 w-9 rounded-xl text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setDeleteId(it.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Reveal>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
          <span className="text-xs text-muted-foreground">{safePage} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>التالي</Button>
        </div>
      )}
      <AdjustDialog item={adjustItem} onClose={() => setAdjustItem(null)} />
      <MoveToWarehouseDialog item={moveItem} onClose={() => setMoveItem(null)} />
      <EditDialog
        item={editing}
        onClose={() => setEditing(null)}
        existingBarcodes={data.stockItems.map((s) => s.barcode)}
        productCode={Math.max(0, ...data.stockItems.map((s) => s.productCode || 0)) + 1}
        suppliers={data.suppliers}
      />
      <ProductDetailsDialog item={detailItem} onClose={() => setDetailItem(null)} onEdit={(product) => setEditing(product)} />

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
                  await db.archiveStockItem(deleteId);
                  void recordAuditLog({
                    action: "STOCK_DELETE",
                    module: "inventory",
                    title: "أرشفة صنف",
                    entityId: deleteId,
                    entityName: deleteId,
                  });
                  toast.success("تمت أرشفة المنتج");
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

      <Dialog open={profitOpen} onOpenChange={setProfitOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right">تقرير أرباح المنتجات</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(() => {
              const map = new Map<string, { name: string; revenue: number; cost: number; qty: number }>();
              for (const ii of data.invoiceItems) {
                const key = ii.stockItemId || ii.name;
                const cur = map.get(key) || { name: ii.name, revenue: 0, cost: 0, qty: 0 };
                cur.revenue += (ii.price || 0) * (ii.quantity || 1);
                cur.cost += (ii.cost || 0) * (ii.quantity || 1);
                cur.qty += (ii.quantity || 1);
                map.set(key, cur);
              }
              const rows = Array.from(map.values()).sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));
              if (rows.length === 0) return <div className="text-center text-muted-foreground py-8 text-sm">لا توجد مبيعات.</div>;
              return rows.map((r, i) => {
                const profit = r.revenue - r.cost;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">كمية: {r.qty} • إيراد: {fmt(r.revenue)} • تكلفة: {fmt(r.cost)}</div>
                    </div>
                    <div className={`font-extrabold tabular-nums ${profit >= 0 ? "text-success" : "text-danger"}`}>{fmt(profit)} ج.م</div>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Quick manual reconciliation: signed delta + required reason, logged in stock_adjustments. */
function AdjustDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [mode, setMode] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("correction");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setMode("out");
      setAmount("1");
      setReason("correction");
      setNotes("");
    }
  }, [item]);

  const qty = Math.abs(Number(amount) || 0);
  const delta = mode === "in" ? qty : -qty;
  const next = item ? Math.max(0, item.quantity + delta) : 0;

  const submit = async () => {
    if (!item) return;
    if (qty <= 0) {
      toast.error("أدخل كمية أكبر من صفر");
      return;
    }
    setBusy(true);
    try {
      await db.adjustStock(
        item.id,
        delta,
        REASONS.find((r) => r.value === reason)?.label ?? reason,
        notes.trim() || undefined,
      );
      void recordAuditLog({
        action: "STOCK_DELTA",
        module: "inventory",
        title: `تسوية كمية: ${item.name}`,
        entityId: item.id,
        entityName: item.name,
        oldValue: item.quantity,
        newValue: Math.max(0, item.quantity + delta),
        details: REASONS.find((r) => r.value === reason)?.label ?? reason,
      });
      toast.success("تمت تسوية الكمية");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حفظ التسوية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تسوية كمية — {item?.name}</DialogTitle>
          <DialogDescription className="text-right">
            زوّد أو نقّص الكمية بسبب واضح، والحركة هتتسجل في سجل المنتج.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "in" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setMode("in")}
            >
              <ArrowUp className="w-4 h-4" /> إضافة
            </Button>
            <Button
              type="button"
              variant={mode === "out" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setMode("out")}
            >
              <ArrowDown className="w-4 h-4" /> خصم
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label>الكمية</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              سبب التسوية <span className="text-danger">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تفاصيل إضافية..."
              maxLength={200}
            />
          </div>
          <div className="rounded-2xl border-2 border-border bg-foreground/[0.03] p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">الكمية بعد التسوية</span>
            <span className="font-extrabold tabular-nums">
              {fmt(item?.quantity ?? 0)} ← {fmt(next)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={busy}>
            حفظ التسوية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** نقل جزء من كمية منتج إلى المخزن (warehouse_items) مع خصمها من المنتجات. */
function MoveToWarehouseDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [qty, setQty] = useState("1");
  const [season, setSeason] = useState<WarehouseSeason>("all");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setQty(String(Math.max(1, item.quantity)));
      setSeason("all");
      setCategory("other");
      setNotes("");
    }
  }, [item]);

  const nQty = Math.max(0, Number(qty) || 0);
  const over = !!item && nQty > item.quantity;

  const submit = async () => {
    if (!item) return;
    if (nQty <= 0) {
      toast.error("اكتب كمية أكبر من صفر");
      return;
    }
    if (over) {
      toast.error("الكمية أكبر من المتاح في المنتجات");
      return;
    }
    setBusy(true);
    try {
      await db.addWarehouseItem({
        name: item.name,
        quantity: nQty,
        unitCost: item.lastUnitCost,
        salePrice: item.salePrice,
        season,
        category,
        notes: notes.trim() || null,
      });
      const remaining = item.quantity - nQty;
      if (remaining <= 0) {
        // نقل كل الكمية → المنتج يختفي من قسم المنتجات
        await db.removeStockItem(item.id);
        toast.success("تم نقل المنتج للمخزن وحذفه من المنتجات");
      } else {
        await db.updateStockItem(
          item.id,
          { quantity: remaining },
          { delta: -nQty, reason: "نقل للمخزن", notes: notes.trim() || undefined },
        );
        toast.success(`تم نقل ${fmt(nQty)} وحدة للمخزن`);
      }

      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر النقل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">نقل للمخزن</DialogTitle>
          <DialogDescription className="text-right">
            {item?.name} — المتاح: {fmt(item?.quantity ?? 0)} وحدة. الكمية المنقولة تُخصم من
            المنتجات.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>الكمية المنقولة</Label>
            <Input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(posNum(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              className={cn("rounded-2xl", NUM_CLS)}
            />
            {over && (
              <div className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> الكمية أكبر من المتاح.
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>الموسم</Label>
              <Select value={season} onValueChange={(v) => setSeason(v as WarehouseSeason)}>
                <SelectTrigger className="rounded-2xl text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-2xl text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="سبب النقل أو مكان التخزين..."
              className="rounded-2xl text-right"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            إلغاء
          </Button>
          <Button className="rounded-full" onClick={submit} disabled={busy || nQty <= 0 || over}>
            {busy ? (
              <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="me-1.5 h-4 w-4" />
            )}
            نقل للمخزن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  item,
  onClose,
  existingBarcodes,
  suppliers = [],
}: {
  item: StockItem | null;
  onClose: () => void;
  existingBarcodes: Array<string | null>;
  suppliers?: Array<{ id: string; name: string }>;
}) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [itemType, setItemType] = useState<string>(PRODUCT_TYPES[0]);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [minStock, setMinStock] = useState("");
  const [variantsJson, setVariantsJson] = useState("[]");
  const [imageUrl, setImageUrl] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState<string>("correction");
  const [reasonNotes, setReasonNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setSize(item.size ?? "");
      setItemType(item.itemType || PRODUCT_TYPES[0]);
      setQty(String(item.quantity));
      setCost(String(item.lastUnitCost));
      setPrice(String(item.salePrice));
      setBarcode(item.barcode ?? "");
      setMinStock(String(item.minStock ?? 0));
      setVariantsJson(JSON.stringify(item.variants ?? [], null, 2));
      setImageUrl(item.imageUrl ?? "");
      setSupplierId(item.supplierId ?? "");
      setCategory(item.category ?? "");
      setReason("correction");
      setReasonNotes("");
    }
  }, [item]);

  const newQty = Math.max(0, Number(qty) || 0);
  const newCost = Math.max(0, Number(cost) || 0);
  const newPrice = Math.max(0, Number(price) || 0);
  const delta = item ? newQty - item.quantity : 0;
  const profit = newPrice - newCost;
  const margin = newPrice > 0 ? (profit / newPrice) * 100 : 0;
  const reasonRequired = delta !== 0;

  const code = barcode.trim();
  const codeDuplicate = useMemo(() => {
    if (!code) return false;
    const taken = new Set(existingBarcodes.filter(Boolean).map((b) => String(b).trim()));
    if (item?.barcode) taken.delete(item.barcode.trim());
    return taken.has(code);
  }, [code, existingBarcodes, item]);

  const submit = async () => {
    if (!item) return;
    if (!name.trim()) {
      toast.error("اكتب اسم المنتج");
      return;
    }
    if (codeDuplicate) {
      toast.error("الباركود مستخدم بالفعل مع منتج آخر");
      return;
    }
    if (reasonRequired && !reason) {
      toast.error("اختر سبب التعديل");
      return;
    }
    setBusy(true);
    try {
      await db.updateStockItem(
        item.id,
        {
          name: name.trim(),
          size: size.trim() || null,
          itemType,
          quantity: newQty,
          lastUnitCost: newCost,
          salePrice: newPrice,
          barcode: code || null,
          minStock: Math.max(0, Number(minStock) || 0),
          variants: (() => { try { const v = JSON.parse(variantsJson || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } })(),
          imageUrl: imageUrl.trim() || null,
          supplierId: supplierId || null,
          category: category.trim() || null,
        },
        reasonRequired
          ? {
              delta,
              reason: REASONS.find((r) => r.value === reason)?.label ?? reason,
              notes: reasonNotes.trim() || undefined,
            }
          : undefined,
      );
      void recordAuditLog({
        action: "STOCK_UPDATE",
        module: "inventory",
        title: `تحديث صنف: ${item.name}`,
        entityId: item.id,
        entityName: item.name,
        oldValue: `${item.quantity} وحدة / ${item.lastUnitCost} / ${item.salePrice}`,
        newValue: `${newQty} وحدة / ${newCost} / ${newPrice}`,
      });
      toast.success("تم تحديث المنتج");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل المنتج</DialogTitle>
          <DialogDescription className="text-right">
            عدّل كل تفاصيل المنتج. أي تغيير في الكمية يحتاج سبب.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="py-2 border-t border-border/40 first:border-t-0">
            <GroupLabel icon={Tag}>هوية المنتج</GroupLabel>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>
                  اسم المنتج <span className="text-danger">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="rounded-2xl text-right"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>المقاس (اختياري)</Label>
                  <Input
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    maxLength={30}
                    placeholder="مثال: L / ٤٢"
                    className="rounded-2xl text-right"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-primary" /> نوع المنتج
                  </Label>
                  <Select value={itemType} onValueChange={setItemType}>
                    <SelectTrigger className="rounded-2xl text-right">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="py-2 border-t border-border/40 first:border-t-0">
            <GroupLabel icon={Wallet}>التسعير والكمية</GroupLabel>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>الكمية</Label>
                <Input
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(posNum(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn("rounded-2xl", NUM_CLS)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>سعر الشراء</Label>
                <Input
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(posNum(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn("rounded-2xl", NUM_CLS)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>سعر البيع</Label>
                <Input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(posNum(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn("rounded-2xl", NUM_CLS)}
                />
              </div>
            </div>

            <div
              className={cn(
                "mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 p-3",
                profit >= 0 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5",
              )}
            >
              <div className="flex items-center gap-2">
                {profit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-danger" />
                )}
                <span className="text-xs text-muted-foreground">الربح المتوقع للوحدة</span>
              </div>
              <div
                className={cn(
                  "font-extrabold tabular-nums",
                  profit >= 0 ? "text-success" : "text-danger",
                )}
              >
                {newPrice > 0 ? (
                  <>{fmt(profit)} ج.م</>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {newPrice > 0 && (
                  <span className="me-2 text-xs font-normal text-muted-foreground">
                    (هامش {fmt(Number(margin.toFixed(1)))}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="py-2 border-t border-border/40 first:border-t-0">
            <GroupLabel icon={ScanLine}>الباركود والمخزون</GroupLabel>
            <div className="grid gap-1.5">
              <Label>الباركود (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="امسح أو اكتب الكود..."
                  dir="ltr"
                  data-latin-digits=""
                  className="rounded-2xl font-mono tabular-nums"
                  maxLength={64}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    setBarcode(generateBarcode(existingBarcodes));
                    toast.success("تم توليد كود فريد");
                  }}
                  title="توليد كود فريد"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => setScanOpen(true)}
                  title="مسح بالكاميرا"
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
              {codeDuplicate && (
                <div className="flex items-center gap-1.5 text-[11px] text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" /> الكود ده مستخدم مع منتج آخر.
                </div>
              )}
            </div>
            <div className="mt-3 grid gap-1.5">
              <Label>الحد الأدنى للمخزون</Label>
              <Input
                inputMode="decimal"
                value={minStock}
                onChange={(e) => setMinStock(posNum(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
                className={cn("rounded-2xl", NUM_CLS)}
              />
              <div className="text-[11px] text-muted-foreground">
                يعتبر المنتج منخفضًا إذا كانت الكمية أقل من هذا الرقم.
              </div>
            </div>
          </div>

             <div className="mt-3 grid gap-1.5">
               <Label>رابط الصورة (URL)</Label>
               <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-2xl text-right" />
             </div>
             <div className="mt-3 grid gap-1.5">
               <Label>المورد</Label>
               <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="rounded-2xl border border-border bg-background p-2 text-sm">
                 <option value="">— بدون مورد —</option>
                 {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
               </select>
             </div>
             <div className="mt-3 grid gap-1.5">
               <Label>التصنيف</Label>
               <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثال: ملابس" className="rounded-2xl text-right" />
             </div>
             <div className="mt-3 grid gap-1.5">
               <Label>متغيرات (Variants) - JSON</Label>
               <textarea
                 value={variantsJson}
                 onChange={(e) => setVariantsJson(e.target.value)}
                 rows={3}
                 className="rounded-2xl border border-border bg-background p-2 font-mono text-xs"
                 placeholder='[{"id":"1","name":"أحمر","size":"L","salePrice":1200}]'
               />
             </div>

          {reasonRequired && (
            <div className="grid gap-2.5 rounded-2xl border-2 border-warning/30 bg-warning/5 p-3 animate-[fade-in_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" />
                تعديل كمية:{" "}
                {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span className="tabular-nums">{fmt(Math.abs(delta))} وحدة</span>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  سبب التعديل <span className="text-danger">*</span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-2xl text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">ملاحظات (اختياري)</Label>
                <Input
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  placeholder="تفاصيل إضافية..."
                  maxLength={200}
                  className="rounded-2xl text-right"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            className="rounded-full"
            onClick={submit}
            disabled={busy || !name.trim() || codeDuplicate}
          >
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={(code) => {
            setBarcode(code);
            setScanOpen(false);
            toast.success("تم التقاط الكود");
          }}
          title="مسح باركود المنتج"
        />
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailsDialog({ item, onClose, onEdit }: { item: StockItem | null; onClose: () => void; onEdit: (item: StockItem) => void }) {
  const profit = item ? item.salePrice - item.lastUnitCost : 0;
  const margin = item && item.salePrice > 0 ? (profit / item.salePrice) * 100 : 0;
  const out = !item || item.quantity <= 0;
  const low = !out && item.quantity < (item.minStock || LOW_STOCK());

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-right">تفاصيل المنتج</DialogTitle>
          <DialogDescription className="text-right">مراجعة سريعة للبيانات والأسعار والمخزون.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-lg font-black">{item?.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item?.barcode && <span className="font-mono">الباركود: {item.barcode}</span>}
              {item?.itemType && <span>{item.itemType}</span>}
              {item?.size && <span>المقاس: {item.size}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DetailStat label="الكمية" value={fmt(item?.quantity ?? 0)} tone={out ? "danger" : low ? "warning" : "default"} />
            <DetailStat label="التكلفة" value={`${fmt(item?.lastUnitCost ?? 0)} ج.م`} />
            <DetailStat label="سعر البيع" value={`${fmt(item?.salePrice ?? 0)} ج.م`} tone="primary" />
            <DetailStat label="الربح" value={`${fmt(profit)} ج.م`} tone={profit >= 0 ? "success" : "danger"} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">حالة المخزون</span>
            <span className={cn("font-bold", out ? "text-danger" : low ? "text-warning" : "text-success")}>{out ? "نافد" : low ? "منخفض" : "متوفر"}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-foreground/[0.03] px-3 py-2 text-sm">
            <span className="text-muted-foreground">نسبة الربح</span>
            <span className={cn("font-bold", profit >= 0 ? "text-success" : "text-danger")}>{margin.toFixed(1)}%</span>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={() => { if (item) onEdit(item); onClose(); }}>
            <Pencil className="ml-2 h-4 w-4" /> تعديل المنتج
          </Button>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" | "success" | "warning" | "danger" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-foreground/[0.025] p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-black", tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground")}>{value}</div>
    </div>
  );
}

function HistoryDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    fetchStockHistory(item.id, item.name)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل حركة المنتج
          </DialogTitle>
          <DialogDescription className="text-right">
            {item?.name} — كل زيادة (شراء) ونقص (بيع/تعديل).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 -mx-2 px-2">
          {loading && (
            <div className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</div>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              لا يوجد حركة مسجلة لهذا المنتج.
            </div>
          )}
          {entries.map((e) => {
            const positive = e.qty > 0;
            const cls =
              e.type === "purchase"
                ? "border-success/30 bg-success/5"
                : e.type === "sale"
                  ? "border-primary/30 bg-primary/5"
                  : positive
                    ? "border-success/30 bg-success/5"
                    : "border-warning/30 bg-warning/5";
            const Icon = positive ? ArrowUp : ArrowDown;
            const iconCls = positive
              ? "text-success"
              : e.type === "sale"
                ? "text-primary"
                : "text-warning";
            const label = e.type === "purchase" ? "شراء" : e.type === "sale" ? "بيع" : "تعديل";
            return (
              <div
                key={e.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border-2 p-3",
                  cls,
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn("w-5 h-5 shrink-0", iconCls)} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {label}
                      {e.reason && (
                        <span className="text-xs font-normal text-muted-foreground">
                          — {e.reason}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {new Date(e.date).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                      {e.notes ? ` • ${e.notes}` : e.ref ? ` • ${e.ref}` : ""}
                    </div>
                  </div>
                </div>
                <div className={cn("font-extrabold tabular-nums shrink-0", iconCls)}>
                  {positive ? "+" : ""}
                  {fmt(e.qty)}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
