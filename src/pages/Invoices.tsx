import { Link, useNavigate } from "@tanstack/react-router";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useEffect, useMemo, useState } from "react";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { getInvoicesForBranch, getInvoiceBranchId } from "@/lib/branch-system";
import { format, addMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useDB, db, daysLate, fmt, customerBalance, getShopSettings, invoiceNumber, useShopSettings, type Invoice, type Customer, type InvoiceItem } from "@/lib/store";
import { getTreasuryAccounts, addManualTransaction } from "@/lib/cashbox-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { InstallmentScheduleMatrix } from "@/components/InstallmentScheduleMatrix";
import { CreateInvoiceShipmentDialog } from "@/components/CreateInvoiceShipmentDialog";
import { InvoicePrintCustomizerDialog } from "@/components/InvoicePrintCustomizerDialog";
import { Plus, Search, Wallet, AlertTriangle, Printer, ShieldAlert, Eye, Pencil, Trash2, Bell, History, TrendingUp, CalendarDays, AlertCircle, MessageCircle, EyeOff, Download, FileSpreadsheet, FileText, X, ChevronsUpDown, Check, Package, ScanLine, Info, CreditCard, Receipt, Undo2, Copy, Share2, MoreVertical, Layers, CheckCircle2, Truck, CheckSquare, Square, GitBranch } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { EmptyState } from "@/components/EmptyState";
import { PageLoadingSkeleton } from "@/components/LoadingScreen";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";

import { findStockByBarcode } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote } from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { toArabicDigits } from "@/lib/arabic-digits";
import { cn } from "@/lib/utils";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";
import {
  StatCard,
  HistoryDialog,
  EditInvoiceItemDialog,
  InvoiceReturnDialog,
  ShareInvoiceDialog,
  ReminderDialog,
  EditInvoiceDialog,
  ViewInvoiceDialog,
  PaymentDialog,
  StockProductPicker,
} from "@/components/invoices";

type Tab = "active" | "overdue" | "settled" | "all";

function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export default function Page() { return (<AppShell><PageTransition><InvoicesPage /></PageTransition></AppShell>); }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function InvoicesPage() {
  const data = useDB();
  const { activeBranchId, activeBranch, mainBranchId, isAllBranches } = useActiveBranch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [reminderInv, setReminderInv] = useState<Invoice | null>(null);
  const [returnInv, setReturnInv] = useState<Invoice | null>(null);
  const [shareInv, setShareInv] = useState<Invoice | null>(null);
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  const { settings: shopSettings } = useShopSettings();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchScanOpen, setSearchScanOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customPrintInv, setCustomPrintInv] = useState<Invoice | null>(null);
  const [shipmentInv, setShipmentInv] = useState<Invoice | null>(null);
  const [directPayState, setDirectPayState] = useState<{
    invoiceId: string;
    max: number;
    invoiceNo?: string;
    customerName?: string;
    initialAmount?: number;
  } | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === list.length && list.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((i) => i.id)));
    }
  };

  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return toast.error("حدد فواتير للطباعة أولاً");
    const targetInvoices = list.filter((i) => selectedIds.has(i.id));
    const cur = shopSettings.currency || "ج.م";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    let sumTotal = 0;
    let sumPaid = 0;
    let sumRemaining = 0;

    const invoicesHtml = targetInvoices.map((inv, idx) => {
      const cust = findCustomer(inv.customerId);
      const remaining = Math.max(0, inv.total - inv.paid);
      sumTotal += inv.total;
      sumPaid += inv.paid;
      sumRemaining += remaining;
      const invItems = data.invoiceItems.filter((it) => it.invoiceId === inv.id);

      return `
        <div style="page-break-after: always; padding: 20px 0; border-bottom: 2px dashed #cbd5e1; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; color: #0f172a;">فاتورة مبيعات #${invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}</h3>
              <span style="font-size: 11px; color: #64748b;">تاريخ: ${format(new Date(inv.createdAt), "dd/MM/yyyy")}</span>
            </div>
            <div style="text-align: left;">
              <b style="font-size: 14px; color: #0f172a;">${escapeHtml(cust?.name || "عميل")}</b>
              <span style="font-size: 11px; color: #64748b; display: block;" dir="ltr">${escapeHtml(cust?.phone || "—")}</span>
            </div>
          </div>

          <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 14px;">
            <thead>
              <tr style="background: #f8fafc; text-align: right;">
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">الصنف</th>
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">الكمية</th>
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">السعر</th>
                <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${invItems.length > 0 ? invItems.map((it) => `
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${escapeHtml(it.name)}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${it.quantity || 1}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${fmt(it.price)} ${cur}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${fmt(it.price * (it.quantity || 1))} ${cur}</td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="4" style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${escapeHtml(inv.notes || "مبيعات عامة")}</td>
                </tr>
              `}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: bold;">
            <span>الإجمالي: ${fmt(inv.total)} ${cur}</span>
            <span style="color: #16a34a;">المدفوع: ${fmt(inv.paid)} ${cur}</span>
            <span style="color: ${remaining > 0 ? '#dc2626' : '#16a34a'};">المتبقي: ${fmt(remaining)} ${cur}</span>
          </div>
        </div>
      `;
    }).join("");

    const html = pdfDocument({
      docTitle: `طباعة مجمعة — ${targetInvoices.length} فاتورة`,
      badge: "طباعة مجمعة",
      title: "دفتر الفواتير المحددة",
      lede: `طباعة مجمعة لعدد ${targetInvoices.length} فاتورة مختارة.`,
      brandSub: shopSettings.shopName || undefined,
      meta: [
        { label: "تاريخ الطباعة", value: today },
        { label: "عدد الفواتير", value: String(targetInvoices.length) },
      ],
      kpis: [
        { label: "إجمالي المبيعات", value: `${fmt(sumTotal)} ${cur}`, tone: "brand" },
        { label: "إجمالي المحصل", value: `${fmt(sumPaid)} ${cur}` },
        { label: "إجمالي المتبقي", value: `${fmt(sumRemaining)} ${cur}`, tone: sumRemaining > 0 ? "danger" : "brand" },
      ],
      body: invoicesHtml,
      footerNote: shopSettings.footerNote || undefined,
    });

    openPdfDocument(html, { autoPrint: true });
  };

  const handleBulkExportCSV = () => {
    if (selectedIds.size === 0) return toast.error("حدد فواتير للتصدير أولاً");
    const targetInvoices = list.filter((i) => selectedIds.has(i.id));
    const headers = ["رقم الفاتورة", "العميل", "الهاتف", "العنوان", "الإجمالي", "المسدد", "المتبقي", "القسط الشهري", "تاريخ الاستحقاق", "تاريخ الإنشاء", "الحالة"];
    const rows = targetInvoices.map((inv) => {
      const c = findCustomer(inv.customerId);
      const remaining = inv.total - inv.paid;
      const late = daysLate(inv);
      const status = remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة";
      return [
        invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix),
        c?.name ?? "—",
        c?.phone ?? "—",
        c?.address ?? "—",
        inv.total,
        inv.paid,
        remaining,
        inv.monthlyInstallment,
        isoToDDMMYYYY(inv.firstDueDate),
        format(new Date(inv.createdAt), "dd/MM/yyyy"),
        status,
      ];
    });

    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-invoices-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${targetInvoices.length} فاتورة بنجاح`);
  };

  const handleBulkWhatsApp = () => {
    if (selectedIds.size === 0) return toast.error("حدد فواتير أولاً");
    const targetInvoices = list.filter((i) => selectedIds.has(i.id));
    const overdueOnes = targetInvoices.filter((i) => (i.total - i.paid) > 0);

    if (overdueOnes.length === 0) {
      return toast.info("جميع الفواتير المحددة مسددة بالكامل ولا توجد عليها مديونيات!");
    }

    // Prepare reminders and copy or open first one
    const firstOverdue = overdueOnes[0];
    const firstCust = findCustomer(firstOverdue.customerId);
    if (firstCust?.phone) {
      const remaining = firstOverdue.total - firstOverdue.paid;
      const msg = `مرحباً ${firstCust.name}، نود تذكيركم بموعد سداد القسط المستحق على فاتورتكم #${invoiceNumber(data.invoices, firstOverdue.id, shopSettings.invoicePrefix)} بقيمة ${fmt(remaining)} ج.م لدى ${shopSettings.shopName || "المحل"}. شكراً لتعاملكم معنا.`;
      const cleanPhone = firstCust.phone.replace(/\D/g, "");
      const waPhone = cleanPhone.startsWith("0") ? "2" + cleanPhone : cleanPhone;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
      toast.success(`تم فتح واتساب للعميل ${firstCust.name} (${overdueOnes.length} فاتورة عليها متبقي)`);
    } else {
      toast.error("لا يوجد رقم هاتف مسجل لأول فاتورة متأخرة");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      for (const id of Array.from(selectedIds) as string[]) {
        await db.removeInvoice(id);
      }
      setSelectedIds(new Set());
      toast.success(`تم حذف ${count} فاتورة بنجاح`);
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء الحذف الجماعي");
    }
  };
  const handleCloneInvoice = (inv: Invoice) => {
    const invItems = data.invoiceItems.filter((it) => it.invoiceId === inv.id);
    const monthsCount = inv.monthlyInstallment > 0
      ? Math.max(1, Math.round((inv.total - inv.downPayment) / Math.max(1, inv.monthlyInstallment)))
      : 6;
    const payload = {
      customerId: inv.customerId,
      products: invItems.map((it) => ({
        name: it.name,
        cost: it.cost,
        price: it.price,
        quantity: it.quantity || 1,
        discount: it.discountPct,
        taxPct: it.taxPct,
        serialNumbers: it.serialNumbers.join(", "),
      })),
      notes: inv.notes,
      saleType: inv.monthlyInstallment > 0 ? "installments" : "cash",
      down: inv.downPayment,
      monthly: inv.monthlyInstallment,
      count: monthsCount,
      discountPct: inv.discountPct,
      taxPct: inv.taxPct,
    };
    sessionStorage.setItem("segilly_clone_invoice", JSON.stringify(payload));
    navigate({ to: "/invoices/new" });
  };

  const counts = useMemo(() => {
    let active = 0, overdue = 0, settled = 0;
    for (const i of data.invoices) {
      const remaining = i.total - i.paid;
      if (remaining <= 0) settled++;
      else if (daysLate(i) > 0) { overdue++; active++; }
      else active++;
    }
    return { active, overdue, settled, all: data.invoices.length };
  }, [data.invoices, data.returns]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    let totalPaid = 0;
    let totalSales = 0;
    let invoiceCount = data.invoices.length;
    let overdueCount = 0;
    let monthCollections = 0;
    let activeSalesTotal = 0;
    let monthSales = 0;

    for (const i of data.invoices) {
      totalSales += i.total;
      totalPaid += i.paid;
      const remaining = i.total - i.paid;
      if (remaining > 0) activeSalesTotal += remaining;
      if (remaining > 0 && daysLate(i) > 0) overdueCount++;
      
      const invDate = new Date(i.createdAt);
      if (invDate >= monthStart && invDate <= monthEnd) {
        monthSales += i.total;
      }
    }

    for (const p of data.payments) {
      const d = new Date(p.paidAt);
      if (d >= monthStart && d <= monthEnd) monthCollections += p.amount;
    }

    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
    const avgInvoiceValue = invoiceCount > 0 ? totalSales / invoiceCount : 0;

    return { 
      totalPaid, 
      totalSales, 
      invoiceCount, 
      overdueCount, 
      monthCollections, 
      activeSalesTotal, 
      collectionRate, 
      avgInvoiceValue, 
      monthSales 
    };
  }, [data.invoices, data.payments]);

  const list = useMemo(() => {
    // Filtered list based on tab, search and active branch
    const branchScoped = isAllBranches
      ? data.invoices
      : getInvoicesForBranch(activeBranchId, data.invoices, mainBranchId);
    const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
    const toTs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59).getTime() : null;
    return branchScoped
      .filter((i) => {
        const remaining = i.total - i.paid;
        if (tab === "active") return remaining > 0;
        if (tab === "overdue") return remaining > 0 && daysLate(i) > 0;
        if (tab === "settled") return remaining <= 0;
        return true;
      })
      .filter((i) => {
        if (!q) return true;
        const c = data.customers.find((c) => c.id === i.customerId);
        return c?.name.includes(q) || c?.phone.includes(q);
      })
      .filter((i) => {
        if (!fromTs && !toTs) return true;
        const t = new Date(i.createdAt).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
        return true;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [data, q, tab, dateFrom, dateTo, isAllBranches, activeBranchId, mainBranchId]);

  if (data.loading) return <PageLoadingSkeleton type="table" />;

  const findCustomer = (id: string) => data.customers.find((c) => c.id === id);

  const exportCSV = () => {
    const headers = ["رقم الفاتورة", "العميل", "الهاتف", "الإجمالي", "المسدد", "المتبقي", "القسط الشهري", "تاريخ أول قسط", "تاريخ الإنشاء", "الحالة"];
    const rows = list.map((inv) => {
      const c = findCustomer(inv.customerId);
      const remaining = inv.total - inv.paid;
      const late = daysLate(inv);
      const status = remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة";
      return [inv.id.slice(0, 6), c?.name ?? "—", c?.phone ?? "—", inv.total, inv.paid, remaining, inv.monthlyInstallment, isoToDDMMYYYY(inv.firstDueDate), format(new Date(inv.createdAt), "dd/MM/yyyy"), status];
    });
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invoices-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الملف");
  };

  const exportPDF = () => {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    let sumTotal = 0, sumPaid = 0, sumRemaining = 0, lateCount = 0;
    const rowsHtml = list.map((inv) => {
      const c = findCustomer(inv.customerId);
      const remaining = inv.total - inv.paid;
      const late = daysLate(inv);
      sumTotal += inv.total; sumPaid += inv.paid; sumRemaining += Math.max(0, remaining);
      if (remaining > 0 && late > 0) lateCount++;
      const status = remaining === 0 ? "مسددة" : late > 0 ? `متأخرة ${late} يوم` : "نشطة";
      const tag = remaining === 0 ? "payment" : late > 0 ? "purchase" : "opening";
      return `<tr><td>#${escapeHtml(inv.id.slice(0,6))}</td><td>${escapeHtml(c?.name ?? "—")}</td><td class="num">${fmt(inv.total)}</td><td class="num ok">${fmt(inv.paid)}</td><td class="num ${remaining > 0 ? "due" : ""}">${fmt(remaining)}</td><td dir="ltr">${escapeHtml(isoToDDMMYYYY(inv.firstDueDate))}</td><td><span class="tag ${tag}">${escapeHtml(status)}</span></td></tr>`;
    }).join("");
    const body = `
<h2 class="sec">قائمة الفواتير</h2>
<div class="t-wrap"><table><thead><tr><th>رقم</th><th>العميل</th><th class="num">الإجمالي</th><th class="num">المسدد</th><th class="num">المتبقي</th><th>الاستحقاق</th><th>الحالة</th></tr></thead>
<tbody>${rowsHtml || `<tr><td colspan="7" class="empty">لا توجد فواتير</td></tr>`}</tbody>
<tfoot><tr><td colspan="2">الإجماليات</td><td class="num">${fmt(sumTotal)}</td><td class="num">${fmt(sumPaid)}</td><td class="num">${fmt(sumRemaining)}</td><td colspan="2">—</td></tr></tfoot></table></div>`;
    const html = pdfDocument({
      docTitle: "تقرير الفواتير — سِجلّي",
      badge: "تقرير فواتير",
      title: "تقرير الفواتير والمبيعات",
      lede: "ملخّص الفواتير مع حالة السداد والاستحقاقات.",
      meta: [
        { label: "تاريخ التقرير", value: today },
        { label: "عدد الفواتير", value: String(list.length) },
      ],
      kpis: [
        { label: "إجمالي الفواتير", value: fmt(sumTotal), tone: "brand" },
        { label: "المسدد", value: fmt(sumPaid) },
        { label: "المتبقي", value: fmt(sumRemaining), tone: "danger" },
        { label: "فواتير متأخرة", value: String(lateCount), tone: "warn" },
      ],
      body,
      page: "A4 landscape",
    });
    if (!openPdfDocument(html)) toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
  };


  return (
    <>
      <PageHeader
        title="الفواتير والمبيعات"
        subtitle="إدارة الأقساط والمبيعات."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={privacy ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggle}
              title="إخفاء الأرقام"
            >
              {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">إخفاء الأرقام</span>
            </Button>
            <Button asChild className="gap-2"><Link to="/invoices/new"><Plus className="w-4 h-4" /> فاتورة جديدة</Link></Button>
          </div>
        }
      />

      {!isAllBranches && activeBranch && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs font-bold text-primary">
          <GitBranch className="h-4 w-4" />
          عرض فواتير فرع «{activeBranch.name}» فقط ({list.length} فاتورة) — بدّل من محدد الفرع لعرض الكل.
        </div>
      )}


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatCard icon={<Wallet className="w-5 h-5" />} label="إجمالي المسدد" value={`${fmt(stats.totalPaid)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="إجمالي المبيعات" value={`${fmt(stats.totalSales)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="عدد الفواتير" value={String(stats.invoiceCount)} tone="neutral" valueClassName={blurCls} />
        
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="الفواتير المتعثرة" value={String(stats.overdueCount)} tone="danger" trend="down" valueClassName={blurCls} />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="تحصيلات الشهر الحالي" value={`${fmt(stats.monthCollections)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="إجمالي المبيعات النشطة" value={`${fmt(stats.activeSalesTotal)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />

        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="نسبة التحصيل" value={`%${stats.collectionRate.toFixed(1)}`} tone="neutral" trend="up" valueClassName={blurCls} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="متوسط قيمة الفاتورة" value={`${fmt(stats.avgInvoiceValue)} ج.م`} tone="neutral" valueClassName={blurCls} />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="مبيعات الشهر الحالي" value={`${fmt(stats.monthSales)} ج.م`} tone="neutral" trend="up" valueClassName={blurCls} />
      </div>

      <div className="sticky-search-bar">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
          <TabsTrigger value="active" className="gap-1.5 data-[state=active]:bg-foreground/[0.06] data-[state=active]:text-foreground">
            فواتير نشطة <Badge variant="secondary" className="rounded-full">{counts.active}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5 data-[state=active]:bg-danger/15 data-[state=active]:text-danger">
            متأخرة <Badge variant="secondary" className="rounded-full">{counts.overdue}</Badge>
          </TabsTrigger>
          <TabsTrigger value="settled" className="gap-1.5 data-[state=active]:bg-success/15 data-[state=active]:text-success">
            تم التحصيل <Badge variant="secondary" className="rounded-full">{counts.settled}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            الكل <Badge variant="secondary" className="rounded-full">{counts.all}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

        <div className="mb-5 flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative md:w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." className="pr-10 pl-10" />
            <button
              type="button"
              onClick={() => setSearchScanOpen(true)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              title="مسح باركود"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 justify-start font-normal">
                <CalendarIcon className="w-4 h-4" />
                {dateFrom || dateTo ? (
                  <span dir="ltr" className="text-xs">
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "..."} – {dateTo ? format(dateTo, "dd/MM/yy") : "..."}
                  </span>
                ) : <span>تصفية بالتاريخ</span>}
                {(dateFrom || dateTo) && (
                  <X
                    className="w-3.5 h-3.5 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setDateFrom(undefined); setDateTo(undefined); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateFrom, to: dateTo }}
                onSelect={(r: any) => { setDateFrom(r?.from); setDateTo(r?.to); }}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                تصدير التقرير
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV} className="gap-2">
                <FileSpreadsheet className="w-4 h-4 text-success" /> Excel (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF} className="gap-2">
                <FileText className="w-4 h-4 text-danger" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {list.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-foreground/[0.03] border border-border/50 text-xs">
              <Checkbox
                checked={selectedIds.size === list.length && list.length > 0}
                onCheckedChange={toggleSelectAll}
                id="select-all-invoices"
              />
              <label htmlFor="select-all-invoices" className="cursor-pointer text-muted-foreground font-medium select-none">
                تحديد الكل ({list.length})
              </label>
            </div>
          )}

          <div className="md:ms-auto text-xs text-muted-foreground">
            {list.length} فاتورة
          </div>
        </div>

        {/* شريط الإجراءات الجماعية العائم */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="p-3 rounded-2xl bg-foreground/95 text-background shadow-xl flex flex-wrap items-center justify-between gap-3 border border-border"
            >
              <div className="flex items-center gap-2.5">
                <Badge variant="secondary" className="font-bold text-xs bg-background text-foreground">
                  {selectedIds.size} فاتورة محددة
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 text-xs text-background/70 hover:text-background hover:bg-background/10"
                >
                  إلغاء التحديد
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkPrint}
                  className="h-8 gap-1.5 text-xs font-bold bg-background text-foreground hover:bg-background/90"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" /> طباعة مجمعة
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkExportCSV}
                  className="h-8 gap-1.5 text-xs font-bold bg-background text-foreground hover:bg-background/90"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-success" /> تصدير إكسل
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkWhatsApp}
                  className="h-8 gap-1.5 text-xs font-bold bg-background text-foreground hover:bg-background/90"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-success" /> تذكير واتساب
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1.5 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف المحدد
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">حذف الفواتير المحددة ({selectedIds.size})</AlertDialogTitle>
                      <AlertDialogDescription className="text-right">
                        هل أنت متأكد من حذف {selectedIds.size} فاتورة نهائياً؟ سيتم إرجاع كميات المخزون وحذف كافة السجلات المالية المرتبطة بها.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-danger text-danger-foreground">
                        نعم، حذف الكل
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Reveal delay={140}>
        <div className="flex flex-col gap-3">
          {list.length === 0 ? (
            <BezelCard variant="flat" className="px-6 py-10">
                <EmptyState
                  icon={Receipt}
                  title={tab === "active" ? "لا توجد فواتير نشطة." : tab === "overdue" ? "لا توجد فواتير متأخرة." : "لا توجد فواتير."}
                  hint={tab === "active" ? "كل الفواتير مسددة بالكامل." : tab === "overdue" ? "لا توجد مديونيات متأخرة حالياً." : "سجّل أول فاتورة وابدأ تتبع التحصيلات."}
                />
            </BezelCard>
          ) : (
            list.map((inv, idx) => {
              const remaining = inv.total - inv.paid;
              const late = daysLate(inv);
              const isOverdue = remaining > 0 && late > 0;
              const status = remaining === 0 ? "مسددة" : isOverdue ? `متأخرة (${late} يوم)` : "نشطة";
              const cust = findCustomer(inv.customerId);
              const isSelected = selectedIds.has(inv.id);
              
              return (
                <div
                  key={inv.id}
                  className={cn(
                    "group bezel-shell bezel-lift animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both transition-all",
                    isSelected ? "ring-2 ring-primary bg-primary/[0.02]" : ""
                  )}
                  style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                >
                  <div className="bezel-core grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                    {/* الهوية */}
                    <div className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(inv.id)}
                        className="shrink-0"
                      />
                      <div className={cn(
                        "text-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold ring-1",
                        remaining === 0 ? "bg-success/12 text-success ring-success/25" : 
                        isOverdue ? "bg-danger/12 text-danger ring-danger/25" : 
                        "bg-primary/12 text-primary ring-primary/25"
                      )}>
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="font-mono text-xs font-bold text-muted-foreground">#{invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}</div>
                        <div className="font-bold truncate">{cust?.name ?? "عميل محذوف"}</div>
                      </div>
                    </div>

                    {/* المبالغ */}
                    <div className="min-w-0 w-full md:w-auto">
                      <div className="flex items-center justify-between md:justify-start gap-4">
                        <div className="flex flex-col text-right">
                          <div className="text-[10px] text-muted-foreground mb-0.5">الإجمالي</div>
                          <div className={cn("text-numeric font-bold", privacy && "privacy-blur")}>{fmt(inv.total)}</div>
                        </div>
                        <div className="flex flex-col text-right">
                          <div className="text-[10px] text-muted-foreground mb-0.5">المتبقي</div>
                          <div className={cn("text-numeric text-xl font-extrabold", remaining > 0 ? "text-danger" : "text-success", privacy && "privacy-blur")}>{fmt(remaining)}</div>
                        </div>
                      </div>
                    </div>

                    {/* الإجراءات */}
                    <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:group-hover:opacity-100">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setViewInv(inv)}>
                              <Info className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>تفاصيل البنود والتقسيط</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-success hover:bg-success/10" onClick={() => setShareInv(inv)}>
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>مشاركة واتساب</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setCustomPrintInv(inv)}>
                              <Printer className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>تخصيص وطباعة الفاتورة</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {remaining > 0 && (
                        <PaymentDialog
                          invoiceId={inv.id}
                          max={remaining}
                          invoiceNo={invoiceNumber(data.invoices, inv.id, shopSettings.invoicePrefix)}
                          customerName={cust?.name}
                        />
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="action-btn rounded-full text-muted-foreground hover:bg-foreground/5">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-right w-52">
                          <DropdownMenuItem onClick={() => setViewInv(inv)} className="gap-2 justify-end">
                            <span>عرض التفاصيل وجدول الأقساط</span>
                            <Eye className="w-4 h-4 text-primary" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCustomPrintInv(inv)} className="gap-2 justify-end">
                            <span>تخصيص وطباعة الإيصال (حراري/A4)</span>
                            <Printer className="w-4 h-4 text-primary" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShipmentInv(inv)} className="gap-2 justify-end">
                            <span>تحويل إلى شحنة وبوليصة توصيل</span>
                            <Truck className="w-4 h-4 text-indigo-500" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReturnInv(inv)} className="gap-2 justify-end">
                            <span>مرتجع بضاعة من الفاتورة</span>
                            <Undo2 className="w-4 h-4 text-warning" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShareInv(inv)} className="gap-2 justify-end">
                            <span>إيصال رقمي / واتساب</span>
                            <Share2 className="w-4 h-4 text-success" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCloneInvoice(inv)} className="gap-2 justify-end">
                            <span>استنساخ / تكرار الفاتورة</span>
                            <Copy className="w-4 h-4 text-blue-500" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditInv(inv)} className="gap-2 justify-end">
                            <span>تعديل الفاتورة</span>
                            <Pencil className="w-4 h-4 text-amber-500" />
                          </DropdownMenuItem>
                          {remaining > 0 && (
                            <DropdownMenuItem onClick={() => setReminderInv(inv)} className="gap-2 justify-end">
                              <span>تذكير بالقسط المستحق</span>
                              <Bell className="w-4 h-4 text-danger" />
                            </DropdownMenuItem>
                          )}
                          {cust && (
                            <DropdownMenuItem onClick={() => setHistoryFor(cust)} className="gap-2 justify-end">
                              <span>سجل حساب العميل</span>
                              <History className="w-4 h-4 text-indigo-500" />
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إرجاع المنتجات للمخزن وحذف القيود المتعلقة بها.")) {
                                db.removeInvoice(inv.id);
                                toast.success("تم حذف الفاتورة");
                              }
                            }}
                            className="gap-2 justify-end text-danger focus:text-danger focus:bg-danger/10"
                          >
                            <span>حذف الفاتورة</span>
                            <Trash2 className="w-4 h-4" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Reveal>
      <HistoryDialog customer={historyFor} onClose={() => setHistoryFor(null)} invoices={data.invoices} payments={data.payments} items={data.invoiceItems} blurCls={blurCls} onEditInvoice={(i) => { setHistoryFor(null); setEditInv(i); }} />
      <ViewInvoiceDialog
        inv={viewInv}
        customer={viewInv ? findCustomer(viewInv.customerId) ?? null : null}
        items={data.invoiceItems}
        payments={data.payments}
        onClose={() => setViewInv(null)}
        onOpenReturn={(i) => { setViewInv(null); setReturnInv(i); }}
        onOpenShare={(i) => { setViewInv(null); setShareInv(i); }}
        onOpenCustomPrint={(i) => { setViewInv(null); setCustomPrintInv(i); }}
        onOpenShipment={(i) => { setViewInv(null); setShipmentInv(i); }}
        onClone={(i) => handleCloneInvoice(i)}
        onEdit={(i) => { setViewInv(null); setEditInv(i); }}
        onDirectPay={(i, amount) => {
          const cust = findCustomer(i.customerId);
          const remaining = Math.max(0, i.total - i.paid);
          setDirectPayState({
            invoiceId: i.id,
            max: remaining,
            invoiceNo: invoiceNumber(data.invoices, i.id, shopSettings.invoicePrefix),
            customerName: cust?.name,
            initialAmount: Math.min(amount, remaining),
          });
        }}
      />
      <InvoiceReturnDialog
        inv={returnInv}
        customer={returnInv ? findCustomer(returnInv.customerId) ?? null : null}
        items={data.invoiceItems}
        onClose={() => setReturnInv(null)}
      />
      <ShareInvoiceDialog
        inv={shareInv}
        customer={shareInv ? findCustomer(shareInv.customerId) ?? null : null}
        items={data.invoiceItems}
        shopSettings={shopSettings}
        onClose={() => setShareInv(null)}
      />
      <CreateInvoiceShipmentDialog
        inv={shipmentInv}
        customer={shipmentInv ? findCustomer(shipmentInv.customerId) ?? null : null}
        items={shipmentInv ? data.invoiceItems.filter((it) => it.invoiceId === shipmentInv.id) : []}
        carriers={data.carriers}
        zones={data.zones}
        onClose={() => setShipmentInv(null)}
      />
      <InvoicePrintCustomizerDialog
        inv={customPrintInv}
        customer={customPrintInv ? findCustomer(customPrintInv.customerId) ?? null : null}
        items={customPrintInv ? data.invoiceItems.filter((it) => it.invoiceId === customPrintInv.id) : []}
        payments={data.payments}
        allInvoices={data.invoices}
        shopSettings={shopSettings}
        onClose={() => setCustomPrintInv(null)}
      />
      {directPayState && (
        <PaymentDialog
          invoiceId={directPayState.invoiceId}
          max={directPayState.max}
          invoiceNo={directPayState.invoiceNo}
          customerName={directPayState.customerName}
          initialAmount={directPayState.initialAmount}
          controlledOpen={true}
          onControlledClose={() => setDirectPayState(null)}
        />
      )}
      <EditInvoiceDialog inv={editInv} onClose={() => setEditInv(null)} />
      <ReminderDialog inv={reminderInv} customer={reminderInv ? findCustomer(reminderInv.customerId) ?? null : null} onClose={() => setReminderInv(null)} />
      <BarcodeScanner
        open={searchScanOpen}
        onClose={() => setSearchScanOpen(false)}
        onDetected={(code) => {
          setSearchScanOpen(false);
          const found = findStockByBarcode(data.stockItems, code);
          if (found) {
            setQ(found.name);
            toast.success(`بحث عن: ${found.name}`);
          } else {
            toast.error(`لم يتم العثور على منتج بالكود: ${code}`);
          }
        }}
        title="مسح باركود — بحث سريع"
      />

    </>
  );
}



function printReceipt(
  inv: { id: string; total: number; paid: number; downPayment: number; monthlyInstallment: number; firstDueDate: string; notes: string | null; createdAt: string },
  customerName: string,
  phone: string,
  allInvoices: import("@/lib/store").Invoice[] = [],
) {
  const shop = getShopSettings();
  const cur = shop.currency || "ج.م";
  const invNo = invoiceNumber(allInvoices, inv.id, shop.invoicePrefix);
  const remaining = inv.total - inv.paid;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const body = `
<div class="info">
  <div class="box"><b>اسم العميل</b> ${escapeHtml(customerName)}</div>
  <div class="box"><b>الهاتف</b> <span dir="ltr">${escapeHtml(phone || "—")}</span></div>
  <div class="box" style="grid-column:1/-1"><b>وصف السلعة</b> ${escapeHtml(inv.notes || "—")}</div>
</div>
<h2 class="sec">تفاصيل التقسيط</h2>
<div class="t-wrap"><table>
  <tbody>
    <tr><th>تاريخ أول قسط</th><td dir="ltr">${escapeHtml(isoToDDMMYYYY(inv.firstDueDate))}</td><th>القسط الشهري</th><td class="num">${fmt(inv.monthlyInstallment)} ${escapeHtml(cur)}</td></tr>
    <tr><th>إجمالي الفاتورة</th><td class="num">${fmt(inv.total)} ${escapeHtml(cur)}</td><th>المقدم</th><td class="num">${fmt(inv.downPayment)} ${escapeHtml(cur)}</td></tr>
    <tr><th>المسدد حتى تاريخه</th><td class="num ok">${fmt(inv.paid)} ${escapeHtml(cur)}</td><th>المتبقي</th><td class="num ${remaining > 0 ? "due" : "ok"}">${fmt(remaining)} ${escapeHtml(cur)}</td></tr>
  </tbody>
</table></div>
<div class="total-bar"><span>المتبقي المستحق</span><span class="v">${fmt(remaining)} ${escapeHtml(cur)}</span></div>
<div class="sig"><div>توقيع العميل</div><div>توقيع البائع</div></div>`;
  const html = pdfDocument({
    docTitle: "إيصال — سِجلّي",
    badge: "إيصال معتمد",
    title: "إيصال بيع بالتقسيط",
    lede: "إيصال رسمي يوضّح تفاصيل الفاتورة والأقساط.",
    brandSub: shop.shopName || undefined,
    meta: [
      { label: "تاريخ الإصدار", value: today },
      { label: "رقم الفاتورة", value: escapeHtml(invNo) },
      ...(shop.phone ? [{ label: "هاتف المحل", value: escapeHtml(shop.phone) }] : []),
      ...(shop.address ? [{ label: "العنوان", value: escapeHtml(shop.address) }] : []),
      ...(shop.taxNumber ? [{ label: "الرقم الضريبي", value: escapeHtml(shop.taxNumber) }] : []),
    ],
    kpis: [
      { label: "إجمالي الفاتورة", value: `${fmt(inv.total)} ${cur}`, tone: "brand" },
      { label: "المقدم", value: `${fmt(inv.downPayment)} ${cur}` },
      { label: "القسط الشهري", value: `${fmt(inv.monthlyInstallment)} ${cur}` },
      { label: "المتبقي", value: `${fmt(remaining)} ${cur}`, tone: remaining > 0 ? "danger" : "brand" },
    ],
    body,
    footerNote: shop.footerNote || undefined,
    page: "A4",
    paper: shop.printPaper,
  });
  if (!openPdfDocument(html, { autoPrint: true, features: shop.printPaper === "thermal" ? "width=420,height=760" : "width=880,height=760" })) {
    toast.error("الرجاء السماح بفتح النوافذ المنبثقة لطباعة الإيصال");
    return;
  }
  toast.success("جاري تجهيز الإيصال...");
}


export type { ProductRow } from "@/types";

