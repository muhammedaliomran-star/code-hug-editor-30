import { BezelCard } from "@/components/BezelCard";
import { EmptyState } from "@/components/EmptyState";
import { Users } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CustomerImportDialog } from "@/components/CustomerImportDialog";
import { QuickPayCustomerDialog } from "@/components/QuickPayCustomerDialog";
import { CustomerCardModal } from "@/components/CustomerCardModal";
import { getCustomerCode } from "@/lib/customer-utils";
import { isoToDDMMYYYY } from "@/lib/date-utils";
import {
  useDB,
  db,
  fmt,
  aiScript,
  type Customer,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  FileDown,
  FileSpreadsheet,
  Upload,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Banknote,
  QrCode,
  CalendarClock,
  Lock,
  MessageCircle,
  Pencil,
  Trash2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import { usePrivacy } from "@/lib/privacy";
import { StarRating } from "@/components/StarRating";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";

// Extracted components
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { PaymentHistoryDialog } from "@/components/customers/PaymentHistoryDialog";
import { AiScriptDialog } from "@/components/customers/AiScriptDialog";
import { CustomerViewDrawer } from "@/components/customers/CustomerViewDrawer";
import {
  SortChip,
  customerMetrics,
  WhatsAppIcon,
  escapeHtml,
  type SortKey,
  type SortDir,
  type FilterTab,
} from "@/components/customers/customer-helpers";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <CustomersPage />
      </PageTransition>
    </AppShell>
  );
}

const FILTERS: { value: FilterTab; label: string; activeCls: string }[] = [
  {
    value: "all",
    label: "الكل",
    activeCls: "bg-primary text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]",
  },
  {
    value: "installment",
    label: "عملاء قسط",
    activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
  {
    value: "dueToday",
    label: "مستحق اليوم",
    activeCls: "bg-warning text-warning-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
  {
    value: "overdue",
    label: "المتأخرون",
    activeCls: "bg-danger text-danger-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
  {
    value: "cash",
    label: "عملاء فوري",
    activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
  {
    value: "frozen",
    label: "المجمدون",
    activeCls: "bg-destructive text-destructive-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
  {
    value: "bajah",
    label: "عملاء بجحين",
    activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
  {
    value: "settled",
    label: "الخالصون",
    activeCls: "bg-foreground text-background shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.4)]",
  },
];

function CustomersPage() {
  const data = useDB();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [dueDayFilter, setDueDayFilter] = useState<string>("all");
  const [scriptFor, setScriptFor] = useState<Customer | null>(null);
  const [viewFor, setViewFor] = useState<Customer | null>(null);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [quickPayFor, setQuickPayFor] = useState<{ customer: Customer; balance: number } | null>(null);
  const [cardFor, setCardFor] = useState<{ customer: Customer; balance: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { privacy, toggle } = usePrivacy();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const todayDay = useMemo(() => new Date().getDate(), []);

  const enriched = useMemo(
    () => data.customers.map((c) => ({ c, m: customerMetrics(data.invoices, c) })),
    [data.customers, data.invoices],
  );

  const counts = useMemo(() => {
    let overdue = 0,
      bajah = 0,
      settled = 0,
      installment = 0,
      cash = 0,
      frozen = 0,
      dueToday = 0;
    for (const { c, m } of enriched) {
      if (m.worstLate > 1) overdue++;
      if (c.status === "defaulter" || m.worstLate > 30) bajah++;
      if (m.balance <= 0) settled++;
      if (c.frozen) frozen++;
      if (c.customerType === "cash") cash++;
      else {
        installment++;
        if (c.dueDay === todayDay && m.balance > 0) dueToday++;
      }
    }
    return { all: enriched.length, installment, cash, overdue, dueToday, bajah, frozen, settled };
  }, [enriched, todayDay]);

  const debtStats = useMemo(() => {
    const totalDebt = enriched.reduce((s, x) => s + Math.max(0, x.m.balance), 0);
    const now = Date.now();
    const week = 7 * 86400000;
    let thisWeek = 0,
      prevWeek = 0;
    for (const p of data.payments) {
      const t = new Date(p.paidAt).getTime();
      if (now - t <= week) thisWeek += p.amount;
      else if (now - t <= 2 * week) prevWeek += p.amount;
    }
    const debtors = enriched.filter((x) => x.m.balance > 0).length;
    const trendPct =
      prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : thisWeek > 0 ? 100 : 0;
    return { totalDebt, thisWeek, trendPct, debtors };
  }, [enriched, data.payments]);

  const list = useMemo(() => {
    const filtered = enriched
      .filter(({ c, m }) => {
        if (filter === "installment") return c.customerType !== "cash";
        if (filter === "dueToday") return c.customerType !== "cash" && c.dueDay === todayDay;
        if (filter === "cash") return c.customerType === "cash";
        if (filter === "overdue") return m.worstLate > 1;
        if (filter === "frozen") return !!c.frozen;
        if (filter === "bajah") return c.status === "defaulter" || m.worstLate > 30;
        if (filter === "settled") return m.balance <= 0;
        return true;
      })
      .filter(({ c }) => {
        if (dueDayFilter === "all") return true;
        return c.customerType !== "cash" && String(c.dueDay) === dueDayFilter;
      })
      .filter(({ c }) => {
        if (!q) return true;
        const qClean = q.trim().toLowerCase();
        const code = getCustomerCode(c).toLowerCase();
        return (
          c.name.toLowerCase().includes(qClean) ||
          c.phone.includes(qClean) ||
          (c.address && c.address.toLowerCase().includes(qClean)) ||
          code.includes(qClean)
        );
      });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "balance") return (a.m.balance - b.m.balance) * dir;
      return a.c.name.localeCompare(b.c.name, "ar") * dir;
    });
  }, [enriched, q, filter, dueDayFilter, sortKey, sortDir, todayDay]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "balance" ? "desc" : "asc");
    }
  };

  const exportExcel = () => {
    if (list.length === 0) {
      toast.error("لا توجد بيانات عملاء لتصديرها");
      return;
    }

    const exportData = list.map(({ c, m }, idx) => ({
      "م": idx + 1,
      "كود العميل": getCustomerCode(c),
      "اسم العميل": c.name,
      "رقم الهاتف": c.phone,
      "العنوان": c.address || "—",
      "نوع العميل": c.customerType === "cash" ? "فوري (نقدي)" : "أقساط",
      "حالة الالتزام": c.status === "committed" ? "ملتزم" : c.status === "defaulter" ? "مماطل" : "عادي",
      "التقييم (من 5)": c.rating,
      "إجمالي المعاملات (ج.م)": m.totalCharged,
      "إجمالي المسدد (ج.م)": m.totalPaid,
      "المديونية المتبقية (ج.م)": m.balance,
      "يوم القسط الشهري": c.customerType === "installment" ? `يوم ${c.dueDay}` : "—",
      "سقف المديونية (ج.م)": c.creditLimit > 0 ? c.creditLimit : "بدون حد",
      "أقصى تأخير (أيام)": m.worstLate > 0 ? m.worstLate : 0,
      "حالة الحساب": c.frozen ? "مجمد" : "نشط",
      "تاريخ الانضمام": isoToDDMMYYYY(c.joiningDate),
      "ملاحظات": c.notes || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 24 },
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف العملاء");
    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `كشف_العملاء_${todayStr}.xlsx`);
    toast.success("تم تصدير كشف العملاء بصيغة Excel بنجاح");
  };

  const exportPDF = () => {
    const tabLabel: Record<FilterTab, string> = {
      all: "كل العملاء",
      installment: "عملاء الأقساط",
      dueToday: "مستحقات اليوم",
      cash: "العملاء الفوريون",
      overdue: "العملاء المتأخرون",
      frozen: "العملاء المجمدون",
      bajah: "العملاء البجحون",
      settled: "العملاء الخالصون",
    };
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const rows = list
      .map(
        ({ c, m }, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(c.name)}</td>
        <td dir="ltr">${escapeHtml(c.phone)}</td>
        <td>${escapeHtml(c.address || "—")}</td>
        <td class="num">${fmt(m.totalCharged)}</td>
        <td class="num ok">${fmt(m.totalPaid)}</td>
        <td class="num ${m.balance > 0 ? "due" : ""}">${fmt(m.balance)}</td>
        <td>${m.worstLate > 0 ? `<span class="tag purchase">${m.worstLate} يوم</span>` : "—"}</td>
      </tr>`,
      )
      .join("");
    const totalDue = list.reduce((s, x) => s + Math.max(0, x.m.balance), 0);
    const totalCharged = list.reduce((s, x) => s + x.m.totalCharged, 0);
    const totalPaid = list.reduce((s, x) => s + x.m.totalPaid, 0);
    const body = `
<h2 class="sec">بيانات العملاء</h2>
<div class="t-wrap"><table>
  <thead><tr>
    <th>م</th><th>اسم العميل</th><th>الهاتف</th><th>العنوان</th>
    <th class="num">إجمالي المعاملات</th><th class="num">إجمالي المسدد</th><th class="num">المتبقي</th><th>أقصى تأخير</th>
  </tr></thead>
  <tbody>${rows || `<tr><td colspan="8" class="empty">لا توجد بيانات</td></tr>`}</tbody>
  <tfoot><tr>
    <td colspan="4">الإجماليات</td>
    <td class="num">${fmt(totalCharged)}</td>
    <td class="num">${fmt(totalPaid)}</td>
    <td class="num">${fmt(totalDue)}</td>
    <td>—</td>
  </tr></tfoot>
</table></div>
<div class="sig"><div>توقيع المسؤول</div><div>الختم الرسمي</div></div>`;
    const html = pdfDocument({
      docTitle: "كشف حساب العملاء — سِجلّي",
      badge: "كشف حساب عملاء",
      title: "كشف حساب العملاء",
      lede: `تقرير رسمي يوضّح أرصدة العملاء والمتأخرات — ${tabLabel[filter]}.`,
      meta: [
        { label: "تاريخ التقرير", value: today },
        { label: "التصنيف", value: tabLabel[filter] },
        { label: "عدد العملاء", value: String(list.length) },
      ],
      kpis: [
        { label: "عدد العملاء", value: String(list.length) },
        { label: "إجمالي المعاملات", value: `${fmt(totalCharged)} ج.م`, tone: "brand" },
        { label: "إجمالي المسدد", value: `${fmt(totalPaid)} ج.م` },
        { label: "الديون بالخارج", value: `${fmt(totalDue)} ج.م`, tone: "danger" },
      ],
      body,
      page: "A4 landscape",
    });
    if (!openPdfDocument(html, { autoPrint: true, features: "width=980,height=760" })) {
      toast.error("الرجاء السماح بفتح النوافذ المنبثقة لتصدير PDF");
      return;
    }
    toast.success("جاري تجهيز كشف الحساب...");
  };

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="إدارة بيانات العملاء، تقييم الائتمان، ومتابعة الأقساط والمديونيات"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={privacy ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={toggle}
                    aria-pressed={privacy}
                  >
                    {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {privacy ? "إظهار" : "إخفاء الأرقام"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  يطمس كل المبالغ المالية في الجدول لإخفائها عن أعين المتطفلين.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-success hover:text-success hover:bg-success/10 border-success/30"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="w-4 h-4" />
              استيراد من Excel
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={exportExcel}
              disabled={list.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4 text-success" />
              تصدير (Excel)
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={exportPDF}
              disabled={list.length === 0}
            >
              <FileDown className="w-4 h-4" />
              تصدير (PDF)
            </Button>

            <CustomerDialog
              trigger={
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> إضافة عميل
                </Button>
              }
            />
          </div>
        }
      />

      {/* ===== Bento: KPI + بحث + فلاتر ===== */}
      <Reveal className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* البطاقة الكبيرة */}
        <BezelCard
          variant="flat"
          className="md:col-span-7 flex h-full flex-col justify-between gap-6 p-6 md:p-7"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <span className="mb-1 inline-flex items-center rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-muted-foreground ring-1 ring-border">
                Outstanding
              </span>
              <div className="mt-3 text-xs font-medium text-muted-foreground">
                إجمالي الديون بالخارج
              </div>
              <div
                className={cn(
                  "text-numeric mt-1.5 text-4xl font-extrabold leading-none text-foreground md:text-5xl",
                  privacy && "privacy-blur",
                )}
              >
                {fmt(debtStats.totalDebt)}
                <span className="ms-2 align-middle text-base font-bold text-muted-foreground">
                  ج.م
                </span>
              </div>
            </div>
            <div
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-foreground/[0.06] text-muted-foreground ring-1 ring-border",
              )}
            >
              {debtStats.trendPct >= 0 ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {debtStats.trendPct >= 0 ? "تحصيل" : "تراجع"} {Math.abs(debtStats.trendPct)}٪
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            موزعة على {debtStats.debtors} عميل من إجمالي {counts.all}
          </div>
        </BezelCard>

        {/* عمود مصغّر */}
        <div className="grid gap-4 md:col-span-5">
          <BezelCard variant="flat" className="p-6">
            <div className="text-xs font-medium text-muted-foreground">محصّل هذا الأسبوع</div>
            <div
              className={cn(
                "text-numeric mt-1.5 text-3xl font-extrabold leading-none text-success",
                privacy && "privacy-blur",
              )}
            >
              {fmt(debtStats.thisWeek)}
              <span className="ms-2 align-middle text-sm font-bold text-muted-foreground">ج.م</span>
            </div>
          </BezelCard>
          <BezelCard variant="flat" className="grid grid-cols-2 gap-4 p-6">
            <div>
              <div className="text-xs font-medium text-muted-foreground">متأخرون</div>
              <div className="text-numeric mt-1 text-2xl font-extrabold leading-none text-warning">
                {counts.overdue}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">خالصون</div>
              <div className="text-numeric mt-1 text-2xl font-extrabold leading-none text-success">
                {counts.settled}
              </div>
            </div>
          </BezelCard>
        </div>
      </Reveal>

      {/* شريط التحكّم: فلاتر + بحث + يوم القسط */}
      <Reveal delay={80} className="sticky-search-bar mb-8">
        <BezelCard
          variant="flat"
          className="flex flex-col gap-3.5 p-3.5"
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاسم، الهاتف، العنوان، أو كود العميل (مثال: C-8F4A2)..."
                className="h-11 rounded-full border-0 bg-background/40 pr-11 shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.06)] focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
              />
            </div>
            
            {/* Due day filter selector */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">يوم القسط:</span>
              <Select value={dueDayFilter} onValueChange={setDueDayFilter}>
                <SelectTrigger className="h-9 w-[130px] rounded-full text-xs bg-background/60 border-border/60">
                  <SelectValue placeholder="يوم القسط" />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-60">
                  <SelectItem value="all">كل الأيام</SelectItem>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      يوم {d} من الشهر
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/20">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
                    active
                      ? f.activeCls
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "text-numeric grid h-4.5 min-w-4.5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
                      active ? "bg-background/25" : "bg-foreground/[0.06]",
                    )}
                  >
                    {counts[f.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </BezelCard>
      </Reveal>

      {/* ===== قائمة العملاء: صفوف-بطاقات ===== */}
      <Reveal delay={140}>
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <SortChip
              label="الاسم"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => toggleSort("name")}
            />
            <SortChip
              label="الديون"
              active={sortKey === "balance"}
              dir={sortDir}
              onClick={() => toggleSort("balance")}
            />
          </div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {list.length} / {counts.all}
          </div>
        </div>

        {list.length === 0 ? (
          <BezelCard variant="flat" className="px-6 py-10">
            <EmptyState
              icon={Users}
              title="لا يوجد عملاء بعد."
              hint="أضف أول عميل وابدأ تسجيل فواتيره وأقساطه من مكان واحد."
              action={
                <CustomerDialog
                  trigger={
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" /> إضافة أول عميل
                    </Button>
                  }
                />
              }
            />
          </BezelCard>
        ) : (
          <ScrollArea className="max-h-[64vh]">
            <div className="flex flex-col gap-3 pl-1">
              {list.map(({ c, m }, idx) => {
                const overdue7 = m.worstLate > 7;
                const lateLabel = m.worstLate > 0 ? `متأخر ${m.worstLate} يوم` : null;
                const message = aiScript(c, m.balance, m.worstLate);
                const waPhone = c.phone.replace(/^0/, "20");
                const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
                const overLimit = c.creditLimit > 0 && m.balance >= c.creditLimit;
                const initial = c.name.trim().slice(0, 1) || "؟";
                return (
                  <div
                    key={c.id}
                    className="group bezel-shell bezel-lift animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)_both]"
                    style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                  >
                    <div className="bezel-core grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                      {/* الهوية */}
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold",
                            c.status === "defaulter"
                              ? "bg-danger/12 text-danger ring-1 ring-danger/25"
                              : c.status === "committed"
                                ? "bg-success/12 text-success ring-1 ring-success/25"
                                : "bg-primary/12 text-primary ring-1 ring-primary/25",
                          )}
                        >
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-bold leading-tight">{c.name}</span>
                            <button
                              type="button"
                              onClick={() => setCardFor({ customer: c, balance: m.balance })}
                              className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.05] hover:bg-primary/15 hover:text-primary px-2 py-0.5 text-[11px] font-mono font-bold text-muted-foreground transition-colors shrink-0"
                              title="عرض بطاقة و QR العميل"
                            >
                              <QrCode className="h-3 w-3" />
                              {getCustomerCode(c)}
                            </button>
                          </div>
                          <div
                            className="text-numeric mt-0.5 truncate text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {c.phone}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {c.frozen && (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] font-bold gap-1">
                                <Lock className="w-3 h-3" />
                                مجمد
                              </Badge>
                            )}
                            {c.status === "defaulter" && c.notes ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      <StatusBadge status={c.status} />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-right">
                                    <div className="mb-1 font-bold">ملاحظات سابقة:</div>
                                    <div className="whitespace-pre-wrap text-xs">{c.notes}</div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <StatusBadge status={c.status} />
                            )}
                            <CustomerTypeBadge type={c.customerType} />
                            {c.customerType === "installment" && (
                              <Badge variant="outline" className="bg-foreground/[0.04] text-muted-foreground text-[10px] gap-1 font-medium">
                                <CalendarClock className="w-3 h-3" />
                                يوم {c.dueDay}
                              </Badge>
                            )}
                            <StarRating value={c.rating} />
                          </div>
                        </div>
                      </div>

                      {/* المديونية */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "text-numeric text-xl font-extrabold leading-none",
                              overdue7 ? "text-danger" : "text-foreground",
                              privacy && "privacy-blur",
                            )}
                          >
                            {fmt(m.balance)}{" "}
                            <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                          </div>
                          {lateLabel && (
                            <span className="rounded-full bg-danger/12 px-2 py-0.5 text-[10px] font-bold text-danger ring-1 ring-danger/25">
                              {lateLabel}
                            </span>
                          )}
                          {overLimit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="grid h-6 w-6 shrink-0 cursor-help place-items-center rounded-full bg-danger/15 text-danger ring-1 ring-danger/40"
                                    aria-label="تجاوز سقف المديونية"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-right">
                                  <div className="mb-0.5 font-bold text-danger">
                                    ⚠ تجاوز سقف المديونية
                                  </div>
                                  <div className="text-xs">
                                    المديونية ({fmt(m.balance)} ج.م) وصلت لسقف الائتمان (
                                    {fmt(c.creditLimit)} ج.م). يُمنع البيع الآجل لهذا العميل.
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <Progress value={m.paidPct} className="mt-2.5 h-1" />
                        <div
                          className={cn(
                            "mt-1.5 text-[11px] text-muted-foreground",
                            privacy && "privacy-blur",
                          )}
                        >
                          مسدد {m.paidPct}٪ من {fmt(m.totalCharged)}
                        </div>
                      </div>

                      {/* الإجراءات */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:duration-500 md:ease-[cubic-bezier(0.32,0.72,0,1)] md:group-hover:opacity-100 md:focus-within:opacity-100">
                        {/* زر السداد السريع المباشر */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8.5 gap-1.5 rounded-full border-success/40 bg-success/10 text-success hover:bg-success/20 font-bold px-3 text-xs"
                          onClick={() => setQuickPayFor({ customer: c, balance: m.balance })}
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          تسجيل دفعة
                        </Button>

                        <button
                          type="button"
                          onClick={() => setScriptFor(c)}
                          className="island-btn group/cta bg-primary/12 text-primary ring-1 ring-primary/25 hover:bg-primary/18"
                        >
                          هقوله إيه؟
                          <span className="island-btn-icon bg-primary/20 text-primary transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cta:-translate-x-0.5 group-hover/cta:scale-105">
                            <MessageCircle className="h-4 w-4" />
                          </span>
                        </button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn grid h-9 w-9 place-items-center rounded-full text-success hover:bg-success/10"
                                aria-label="إرسال واتساب"
                              >
                                <WhatsAppIcon className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              إرسال الرسالة المقترحة على واتساب
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-primary hover:bg-primary/10"
                                onClick={() => setHistoryFor(c)}
                                aria-label="سجل المدفوعات"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">عرض سجل المدفوعات الكامل</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="action-btn rounded-full text-muted-foreground hover:bg-muted/50"
                                onClick={() => setViewFor(c)}
                                aria-label="تفاصيل العميل"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">تفاصيل العميل وكشف الحساب</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <CustomerDialog
                          customer={c}
                          trigger={
                            <Button
                              size="icon"
                              variant="ghost"
                              className="action-btn rounded-full"
                              aria-label="تعديل"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="action-btn danger rounded-full text-danger hover:bg-danger/10 hover:text-danger"
                              aria-label="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف العميل</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف {c.name}؟ سيتم حذف كل فواتيره أيضاً.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  db.removeCustomer(c.id);
                                  toast.success("تم حذف العميل");
                                }}
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Reveal>

      <PaymentHistoryDialog
        customer={historyFor}
        open={!!historyFor}
        onOpenChange={(o) => !o && setHistoryFor(null)}
        invoices={data.invoices}
        payments={data.payments}
        privacy={privacy}
      />

      <AiScriptDialog
        customer={scriptFor}
        open={!!scriptFor}
        onOpenChange={(o) => !o && setScriptFor(null)}
        invoices={data.invoices}
      />

      <CustomerViewDrawer
        customer={viewFor}
        open={!!viewFor}
        onOpenChange={(o) => !o && setViewFor(null)}
        invoices={data.invoices}
        payments={data.payments}
        privacy={privacy}
      />

      {/* نافذة استيراد العملاء من Excel */}
      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingPhones={new Set(data.customers.map((c) => c.phone))}
      />

      {/* نافذة السداد السريع للعميل مع وصل واتساب */}
      <QuickPayCustomerDialog
        customer={quickPayFor?.customer ?? null}
        balance={quickPayFor?.balance ?? 0}
        invoices={data.invoices}
        open={!!quickPayFor}
        onOpenChange={(o) => !o && setQuickPayFor(null)}
      />

      {/* نافذة بطاقة العميل ورمز QR */}
      <CustomerCardModal
        customer={cardFor?.customer ?? null}
        balance={cardFor?.balance ?? 0}
        open={!!cardFor}
        onOpenChange={(o) => !o && setCardFor(null)}
      />
    </>
  );
}

