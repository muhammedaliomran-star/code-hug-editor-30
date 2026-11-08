import { useEffect, useMemo, useState, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ExpenseFormModal } from "@/components/expenses/ExpenseFormModal";
import { ViewInvoiceDialog } from "@/components/invoices/ViewInvoiceDialog";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { MetricCard, MetricLabel } from "@/components/MetricCard";
import { ActionButton } from "@/components/ActionButton";
import { FilterChips } from "@/components/FilterChips";
import { StatTabs } from "@/components/StatTabs";

import { Reveal } from "@/components/Reveal";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  db, useDB, fmt, invoiceNumber, expenseCategoryLabel, invalidateCache, type Invoice,
} from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { getManualTransactions, getInternalTransfers, calculateAccountBalance, getTreasuryAccounts } from "@/lib/cashbox-system";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Eye, EyeOff, Download, Search, FileSpreadsheet, FileText, Receipt,
  Coins, Wallet, CheckCircle2, ChevronDown, Pencil, Trash2,
  ArrowDownRight, ArrowUpRight, Clock, RotateCcw
} from "lucide-react";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <DailyPage />
      </PageTransition>
    </AppShell>
  );
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const noteKey = (f: string, t: string) => `segilly:daily-note:${f}_${t}`;

type TypeFilter = "all" | "installment" | "cash";
type StatusFilter = "all" | "paid" | "partial" | "unpaid";
type ActiveTab = "invoices" | "payments" | "expenses" | "returns";

type InvStatus = Exclude<StatusFilter, "all">;

function invStatus(inv: Invoice): InvStatus {
  if (inv.paid >= inv.total) return "paid";
  if (inv.paid > 0) return "partial";
  return "unpaid";
}

const statusMeta: Record<InvStatus, { label: string; cls: string }> = {
  paid: { label: "مسدّدة", cls: "bg-success/12 text-success ring-success/25" },
  partial: { label: "جزئي", cls: "bg-warning/12 text-warning ring-warning/25" },
  unpaid: { label: "غير مسدّدة", cls: "bg-danger/12 text-danger ring-danger/25" },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function DailyPage() {
  const { invoices, customers, expenses, payments, returns, invoiceItems, loading: dbLoading } = useDB();
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const { privacy, toggle } = usePrivacy();
  const masked = privacy;

  const urlSearch = useSearch({ from: "/daily" });
  const navigate = useNavigate();

  const [from, setFrom] = useState(urlSearch.from ?? todayISO());
  const [to, setTo] = useState(urlSearch.to ?? todayISO());
  const [search, setSearch] = useState(urlSearch.search ?? "");
  const [customerId, setCustomerId] = useState<"all" | string>(urlSearch.customerId ?? "all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(urlSearch.typeFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(urlSearch.statusFilter ?? "all");
  const [activeTab, setActiveTab] = useState<ActiveTab>(urlSearch.activeTab ?? "invoices");
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [noteTick, setNoteTick] = useState(0);
  const [quickPreset, setQuickPreset] = useState<QuickPreset>(urlSearch.quickPreset ?? "today");

  const [openExpense, setOpenExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  // Sync filter state to URL (shareable link)
  useEffect(() => {
    navigate({
      to: "/daily",
      search: {
        from: from !== todayISO() ? from : undefined,
        to: to !== todayISO() ? to : undefined,
        search: search || undefined,
        customerId: customerId !== "all" ? customerId : undefined,
        typeFilter: typeFilter !== "all" ? typeFilter : undefined,
        statusFilter: statusFilter !== "all" ? statusFilter : undefined,
        activeTab: activeTab !== "invoices" ? activeTab : undefined,
        quickPreset: quickPreset !== "today" ? quickPreset : undefined,
      },
      replace: true,
    });
    setPage(1);
  }, [from, to, search, customerId, typeFilter, statusFilter, activeTab, quickPreset, navigate]);
  const [note, setNote] = useState("");
  const latestNoteRef = useRef(note);
  latestNoteRef.current = note;
  const prevPeriodRef = useRef({ from, to, note });
  if (prevPeriodRef.current.from === from && prevPeriodRef.current.to === to) {
    prevPeriodRef.current.note = note;
  }

  useEffect(() => {
    // 1) instant from localStorage (offline / first paint)
    try { setNote(localStorage.getItem(noteKey(from, to)) ?? ""); } catch { setNote(""); }
    // 2) then pull from server (source of truth) if available
    let cancelled = false;
    (async () => {
      try {
        const remote = await db.getDailyNote(from, to);
        if (!cancelled && remote !== null) {
          setNote(remote);
          try { localStorage.setItem(noteKey(from, to), remote); } catch { /* ignore */ }
        }
      } catch { /* offline / table missing — keep local */ }
    })();
    return () => { cancelled = true; };
  }, [from, to, noteTick]);

  // Flush the previous period's note before switching periods (prevents data loss)
  useEffect(() => {
    const prev = prevPeriodRef.current;
    if (prev.from !== from || prev.to !== to) {
      const n = prev.note;
      try { localStorage.setItem(noteKey(prev.from, prev.to), n); } catch { /* ignore */ }
      db.saveDailyNote(prev.from, prev.to, n).catch(() => { /* offline */ });
    }
    prevPeriodRef.current = { from, to, note: latestNoteRef.current };
  }, [from, to]);

  // Autosave note (debounced) for the current period
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(noteKey(from, to), note); } catch { /* ignore */ }
      db.saveDailyNote(from, to, note).catch(() => { /* offline */ });
    }, 800);
    return () => clearTimeout(t);
  }, [note]);

  // تحديث رصيد الخزينة من السحابة (تقليل التأخر)
  useEffect(() => {
    import("@/lib/cashbox-sync").then((m) => m.pullCashboxFromCloud().catch(() => {})).catch(() => {});
  }, []);

  // Realtime: تحديث فوري عند تغيير البيانات في Supabase
  useEffect(() => {
    let channel: any = null;
    // مؤقّت مستقل لكل جدول، حتى لا يُلغي حدثُ جدولٍ تحديثَ جدولٍ آخر.
    const timers = new Map<string, any>();
    const schedule = (key: string, fn: () => void) => {
      const prev = timers.get(key);
      if (prev) clearTimeout(prev);
      timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, 400));
    };
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (!uid) return;
        channel = supabase
          .channel("daily-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `user_id=eq.${uid}` }, () => schedule("invoices", () => invalidateCache("invoices")))
          .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${uid}` }, () => schedule("payments", () => invalidateCache("payments")))
          .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${uid}` }, () => schedule("expenses", () => invalidateCache("expenses")))
          .on("postgres_changes", { event: "*", schema: "public", table: "return_records", filter: `user_id=eq.${uid}` }, () => schedule("returns", () => invalidateCache("return_records")))
          .on("postgres_changes", { event: "*", schema: "public", table: "daily_notes", filter: `user_id=eq.${uid}` }, () => schedule("daily_notes", () => setNoteTick((n) => n + 1)))
          .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `user_id=eq.${uid}` }, () => schedule("customers", () => invalidateCache("customers")))
          .on("postgres_changes", { event: "*", schema: "public", table: "invoice_items", filter: `user_id=eq.${uid}` }, () => schedule("invoice_items", () => invalidateCache("invoice_items")))
          .subscribe();
      } catch { /* ignore */ }
    })();
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      if (channel) { try { channel.unsubscribe(); } catch { /* ignore */ } }
    };
  }, []);

  // Quick Preset Date Selectors
  type QuickPreset = "today" | "yesterday" | "this-week" | "this-month";
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const setQuickDate = (preset: QuickPreset) => {
    setQuickPreset(preset);
    const today = new Date();
    const tIso = toISO(today);

    if (preset === "today") {
      setFrom(tIso);
      setTo(tIso);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setFrom(toISO(y));
      setTo(toISO(y));
    } else if (preset === "this-week") {
      const w = new Date();
      const dayOfWeek = w.getDay(); // 0 Sunday .. 6 Saturday
      const diff = (dayOfWeek + 1) % 7; // week starts Saturday
      const startW = new Date(w);
      startW.setDate(w.getDate() - diff);
      setFrom(toISO(startW));
      setTo(tIso);
    } else if (preset === "this-month") {
      const mStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      setFrom(mStart);
      setTo(tIso);
    }
  };

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const invoiceById = useMemo(
    () => new Map(invoices.map((inv) => [inv.id, inv])),
    [invoices]
  );

  // Invoices filtered by created date
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        const day = new Date(inv.createdAt).toLocaleDateString("en-CA");
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (customerId !== "all" && inv.customerId !== customerId) return false;
        const c = customerById.get(inv.customerId);
        if (typeFilter !== "all" && (c?.customerType ?? "installment") !== typeFilter) return false;
        if (statusFilter !== "all" && invStatus(inv) !== statusFilter) return false;
        if (q) {
          const txt = `${c?.name ?? ""} ${c?.phone ?? ""} ${invoiceNumber(invoices, inv.id)}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invoices, customerById, from, to, customerId, typeFilter, statusFilter, search]);

  // Actual Payments collected during period (including old invoice installment collections)
  const periodPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((p) => {
        const pDay = new Date(p.paidAt).toLocaleDateString("en-CA");
        if (from && pDay < from) return false;
        if (to && pDay > to) return false;
        const inv = invoiceById.get(p.invoiceId);
        if (customerId !== "all" && inv?.customerId !== customerId) return false;
        if (q) {
          const cust = inv ? customerById.get(inv.customerId) : null;
          const txt = `${cust?.name ?? ""} ${cust?.phone ?? ""} ${inv ? invoiceNumber(invoices, inv.id) : ""}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .map((p) => {
        const inv = invoiceById.get(p.invoiceId);
        const cust = inv ? customerById.get(inv.customerId) : null;
        return {
          ...p,
          invoice: inv,
          customer: cust,
        };
      })
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [payments, invoiceById, customerById, invoices, from, to, customerId, search]);

  // Expenses during period
  const periodExpensesList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (from && e.expenseDate < from) return false;
        if (to && e.expenseDate > to) return false;
        if (q) {
          const label = expenseCategoryLabel(e.category).toLowerCase();
          const txt = `${label} ${e.notes ?? ""}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [expenses, from, to, search]);

  // Returns during period
  const periodReturnsList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns
      .filter((r) => {
        const rDay = new Date(r.createdAt).toLocaleDateString("en-CA");
        if (from && rDay < from) return false;
        if (to && rDay > to) return false;
        const inv = r.invoiceId ? invoiceById.get(r.invoiceId) : null;
        if (customerId !== "all" && inv?.customerId !== customerId) return false;
        if (q) {
          const cust = inv ? customerById.get(inv.customerId) : null;
          const txt = `${cust?.name ?? ""} ${cust?.phone ?? ""} ${inv ? invoiceNumber(invoices, inv.id) : ""} ${r.reason ?? ""}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .map((r) => {
        const inv = r.invoiceId ? invoiceById.get(r.invoiceId) : null;
        const cust = inv ? customerById.get(inv.customerId) : null;
        return {
          ...r,
          invoice: inv,
          customer: cust,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [returns, invoiceById, customerById, invoices, from, to, customerId, search]);

  const stats = useMemo(() => {
    let sales = 0, cashSales = 0, instSales = 0;
    let paidFromNewInvoices = 0, cashPaid = 0, instPaid = 0;

    // شبكة زمنية للـ sparklines
    const days: string[] = [];
    if (from && to && from <= to) {
      const cur = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      while (cur <= end && days.length < 62) {
        days.push(cur.toLocaleDateString("en-CA"));
        cur.setDate(cur.getDate() + 1);
      }
    }
    const hourly = days.length < 2;
    const size = hourly ? 24 : days.length;
    const dayIndex = new Map(days.map((d, i) => [d, i]));
    const slotOf = (iso: string) =>
      hourly ? new Date(iso).getHours() : (dayIndex.get(new Date(iso).toLocaleDateString("en-CA")) ?? -1);
    const mk = () => new Array<number>(size).fill(0);
    const sCount = mk(), sSales = mk(), sCashSales = mk(), sInstSales = mk();
    const sPaid = mk(), sCashPaid = mk(), sInstPaid = mk(), sRemaining = mk();
    const sCollected = mk();

    for (const inv of rows) {
      const isCash = (customerById.get(inv.customerId)?.customerType ?? "installment") === "cash";
      sales += inv.total;
      paidFromNewInvoices += inv.paid;
      if (isCash) { cashSales += inv.total; cashPaid += inv.paid; }
      else { instSales += inv.total; instPaid += inv.paid; }

      const i = slotOf(inv.createdAt);
      if (i >= 0 && i < size) {
        sCount[i] += 1;
        sSales[i] += inv.total;
        sPaid[i] += inv.paid;
        sRemaining[i] += Math.max(0, inv.total - inv.paid);
        sCollected[i] += inv.downPayment || 0;
        if (isCash) { sCashSales[i] += inv.total; sCashPaid[i] += inv.paid; }
        else { sInstSales[i] += inv.total; sInstPaid[i] += inv.paid; }
      }
    }

    // تجميع التحصيلات الفعلية (حسب الدفعات) لـ sparkline
    for (const p of payments) {
      const pDay = new Date(p.paidAt).toLocaleDateString("en-CA");
      if (from && pDay < from) continue;
      if (to && pDay > to) continue;
      const i = slotOf(p.paidAt);
      if (i >= 0 && i < size) sCollected[i] += p.amount;
    }

    // حركات خزينة يدوية (إيداعات/سحوبات) ضمن الفترة — لتتوافق مع نظام الخزينة
    const manualTxs = getManualTransactions();
    const transfers = getInternalTransfers();
    let manualIn = 0, manualOut = 0;
    for (const tx of manualTxs) {
      const tDay = tx.date ? tx.date : new Date(tx.createdAt).toLocaleDateString("en-CA");
      if (from && tDay < from) continue;
      if (to && tDay > to) continue;
      if (tx.type === "in") manualIn += tx.amount;
      else manualOut += tx.amount;
    }

    // رصيد الخزينة (الحالي) — من نظام الخزينة (مصدر الحقيقة)
    const mainAccount = getTreasuryAccounts().find((a) => a.isDefault || a.id === "acc-cash-main");
    const cashboxBalance = mainAccount
      ? calculateAccountBalance(mainAccount, invoices, payments, expenses, manualTxs, transfers).currentBalance
      : null;

    // مقدم (down payment) على فواتير الفترة — يُحصَّل عند إنشاء الفاتورة (لا يوجد له صف في payments).
    // ملاحظة: create_sale يكتب downPayment على invoices.paid but does not insert into payments.
    // therefore we aggregate down payments client-side here. Do NOT also record them as payments rows,
    // or calculateAccountBalance (which adds inv.downPayment + payments) would double-count.
    const periodDownPayments = rows.reduce((s, inv) => s + (inv.downPayment || 0), 0);
    const totalCollectedActual = periodPayments.reduce((s, p) => s + p.amount, 0) + periodDownPayments;
    const periodExpenses = periodExpensesList.reduce((s, e) => s + e.amount, 0);
    const periodReturnsTotal = periodReturnsList.reduce((s, r) => s + r.totalAmount, 0);
    
    // صافي الخزينة / الدرج الحقيقي اليوم: كل المحصل الفعلي - المصروفات - المرتجعات
    const netCashDrawer = totalCollectedActual - periodExpenses - periodReturnsTotal + manualIn - manualOut;

    return {
      count: rows.length,
      sales, cashSales, instSales,
      paid: paidFromNewInvoices,
      totalCollectedActual,
      periodDownPayments,
      cashPaid, instPaid,
      remaining: Math.max(0, sales - paidFromNewInvoices),
      periodExpenses,
      periodReturnsTotal,
      manualIn,
      manualOut,
      cashboxBalance,
      netCashDrawer,
      series: {
        count: sCount, sales: sSales, cashSales: sCashSales, instSales: sInstSales,
        paid: sPaid, cashPaid: sCashPaid, instPaid: sInstPaid, remaining: sRemaining,
        collected: sCollected,
      },
    };
  }, [rows, customerById, periodPayments, periodExpensesList, periodReturnsList, payments, invoices, expenses, from, to]);

  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedPayments = periodPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedExpenses = periodExpensesList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedReturns = periodReturnsList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeListLen =
    activeTab === "invoices" ? rows.length :
    activeTab === "payments" ? periodPayments.length :
    activeTab === "expenses" ? periodExpensesList.length : periodReturnsList.length;
  const totalPages = Math.max(1, Math.ceil(activeListLen / PAGE_SIZE));

  // Clamp current page when data shrinks (e.g. realtime refresh / filter change)
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const filtersActive =
    !!search.trim() || customerId !== "all" || typeFilter !== "all" || statusFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setCustomerId("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setQuickPreset("today");
    setFrom(todayISO());
    setTo(todayISO());
  };

  const money = (n: number) => `${fmt(n)} ج.م`;
  const rangeLabel = from === to
    ? new Date(from || todayISO()).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })
    : `${from} — ${to}`;

  const saveNote = () => {
    try { localStorage.setItem(noteKey(from, to), note); } catch { /* ignore */ }
    // push to server (best-effort; falls back to localStorage if offline)
    (async () => {
      try {
        await db.saveDailyNote(from, to, note);
        toast.success("تم حفظ الملاحظة (محلي + سيرفر)");
      } catch (err: any) {
        toast.success("تم حفظ الملاحظة محلياً (سيزامن لاحقاً)");
      }
    })();
  };

  const exportCSV = () => {
    let headers: string[] = [];
    let body: any[][] = [];
    let filename = `daily-${from}_${to}.csv`;

    if (activeTab === "invoices") {
      headers = ["رقم", "التاريخ", "الوقت", "العميل", "الإجمالي", "مدفوع", "متبقي", "نوع", "الحالة"];
      body = rows.map((inv) => {
        const c = customerById.get(inv.customerId);
        const isCash = (c?.customerType ?? "installment") === "cash";
        const d = new Date(inv.createdAt);
        return [
          invoiceNumber(invoices, inv.id),
          d.toLocaleDateString("en-CA"),
          d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          c?.name ?? "—",
          inv.total, inv.paid, Math.max(0, inv.total - inv.paid),
          isCash ? "فوري" : "قسط",
          statusMeta[invStatus(inv)].label,
        ];
      });
    } else if (activeTab === "payments") {
      headers = ["التاريخ", "الوقت", "العميل", "الفاتورة", "المبلغ"];
      body = periodPayments.map((p) => {
        const d = new Date(p.paidAt);
        return [
          d.toLocaleDateString("en-CA"),
          d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          p.customer?.name ?? "—",
          p.invoice ? invoiceNumber(invoices, p.invoice.id) : "—",
          p.amount,
        ];
      });
    } else if (activeTab === "expenses") {
      headers = ["التاريخ", "التصنيف", "المبلغ", "ملاحظات"];
      body = periodExpensesList.map((e) => [
        e.expenseDate,
        expenseCategoryLabel(e.category),
        e.amount,
        e.notes ?? "",
      ]);
    } else if (activeTab === "returns") {
      headers = ["التاريخ", "العميل", "الفاتورة", "المبلغ", "السبب"];
      body = periodReturnsList.map((r) => [
        new Date(r.createdAt).toLocaleDateString("en-CA"),
        r.customer?.name ?? "—",
        r.invoice ? invoiceNumber(invoices, r.invoice.id) : "—",
        r.totalAmount,
        r.reason ?? "",
      ]);
    }

    const csv = "\uFEFF" + [headers, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير اليومية");
  };

  const exportPDF = () => {
    let thead = "";
    let tbody = "";
    let colspan = 8;
    const tabTitle =
      activeTab === "invoices" ? "فواتير الفترة" :
      activeTab === "payments" ? "التحصيلات والأقساط المستلمة" :
      activeTab === "expenses" ? "المصروفات اليومية" : "المرتجعات";

    if (activeTab === "invoices") {
      thead = "<tr><th>م</th><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>مدفوع</th><th>متبقي</th><th>نوع</th><th>الحالة</th></tr>";
      tbody = rows.map((inv, i) => {
        const c = customerById.get(inv.customerId);
        const isCash = (c?.customerType ?? "installment") === "cash";
        return `<tr><td>${i + 1}</td><td>${escapeHtml(invoiceNumber(invoices, inv.id))}</td><td>${escapeHtml(c?.name ?? "—")}</td><td class="num">${fmt(inv.total)} ج.م</td><td class="num">${fmt(inv.paid)} ج.م</td><td class="num due">${fmt(Math.max(0, inv.total - inv.paid))} ج.م</td><td>${isCash ? "فوري" : "قسط"}</td><td>${escapeHtml(statusMeta[invStatus(inv)].label)}</td></tr>`;
      }).join("");
      colspan = 8;
    } else if (activeTab === "payments") {
      thead = "<tr><th>م</th><th>التاريخ</th><th>العميل</th><th>الفاتورة</th><th>المبلغ</th></tr>";
      tbody = periodPayments.map((p, i) => {
        const d = new Date(p.paidAt);
        return `<tr><td>${i + 1}</td><td>${d.toLocaleDateString("en-CA")} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td><td>${escapeHtml(p.customer?.name ?? "—")}</td><td>${p.invoice ? escapeHtml(invoiceNumber(invoices, p.invoice.id)) : "—"}</td><td class="num">${fmt(p.amount)} ج.م</td></tr>`;
      }).join("");
      colspan = 5;
    } else if (activeTab === "expenses") {
      thead = "<tr><th>م</th><th>التاريخ</th><th>التصنيف</th><th>المبلغ</th><th>ملاحظات</th></tr>";
      tbody = periodExpensesList.map((e, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(e.expenseDate)}</td><td>${escapeHtml(expenseCategoryLabel(e.category))}</td><td class="num">${fmt(e.amount)} ج.م</td><td>${escapeHtml(e.notes ?? "—")}</td></tr>`
      ).join("");
      colspan = 5;
    } else if (activeTab === "returns") {
      thead = "<tr><th>م</th><th>التاريخ</th><th>العميل</th><th>الفاتورة</th><th>المبلغ</th><th>السبب</th></tr>";
      tbody = periodReturnsList.map((r, i) =>
        `<tr><td>${i + 1}</td><td>${new Date(r.createdAt).toLocaleDateString("en-CA")}</td><td>${escapeHtml(r.customer?.name ?? "—")}</td><td>${r.invoice ? escapeHtml(invoiceNumber(invoices, r.invoice.id)) : "—"}</td><td class="num">${fmt(r.totalAmount)} ج.م</td><td>${escapeHtml(r.reason ?? "—")}</td></tr>`
      ).join("");
      colspan = 6;
    }

    const emptyRow = `<tr><td colspan="${colspan}">لا توجد حركة في الفترة</td></tr>`;
    const html = pdfDocument({
      docTitle: `اليومية — ${tabTitle}`,
      badge: "تشغيل يومي",
      title: `اليومية — ${tabTitle}`,
      lede: rangeLabel,
      meta: [{ label: "الفترة", value: `${from} — ${to}` }],
      body: `
        <table><thead>${thead}</thead>
        <tbody>${tbody || emptyRow}</tbody></table>
        <p>إجمالي المبيعات: ${fmt(stats.sales)} ج.م — المحصّل الفعلي: ${fmt(stats.totalCollectedActual)} ج.م — المصروفات: ${fmt(stats.periodExpenses)} ج.م — المرتجعات: ${fmt(stats.periodReturnsTotal)} ج.م — حركات خزينة: ${fmt(stats.manualIn - stats.manualOut)} ج.م — صافي الدرج: ${fmt(stats.netCashDrawer)} ج.م</p>
      `,
    });
    openPdfDocument(html);
  };

  const showSkeleton = dbLoading && rows.length === 0 && periodPayments.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="تشغيل يومي"
        title="اليومية"
        actionWidth="md:max-w-[24rem]"
        action={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ActionButton tone="surface" icon={<Download className="h-4 w-4" />}>
                    <span className="inline-flex items-center gap-1">
                      تصدير <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </span>
                  </ActionButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-right">
                  <DropdownMenuItem onClick={exportCSV}>
                    <FileSpreadsheet className="me-2 h-4 w-4" /> ملف Excel / CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPDF}>
                    <FileText className="me-2 h-4 w-4" /> تقرير PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ActionButton
                tone="surface"
                onClick={toggle}
                icon={masked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              >
                {masked ? "إظهار الأرقام" : "إخفاء الأرقام"}
              </ActionButton>
              <ActionButton onClick={() => { setEditingExpense(null); setOpenExpense(true); }} icon={<Plus className="h-4 w-4" />}>
                إضافة مصروف
              </ActionButton>
            </div>

          </div>
        }
      />


      {/* شريط الفلاتر — منفصل عن أزرار الإجراءات */}
      <BezelCard variant="flat" innerClassName="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterChips<QuickPreset>
            variant="segmented"
            value={quickPreset}
            onChange={setQuickDate}
            options={[
              { value: "today", label: "اليوم" },
              { value: "yesterday", label: "أمس" },
              { value: "this-week", label: "هذا الأسبوع" },
              { value: "this-month", label: "هذا الشهر" },
            ]}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="press rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:text-foreground"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-right">
            <MetricLabel className="mb-1.5 text-xs">من تاريخ</MetricLabel>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="text-numeric h-9 text-xs" />
          </label>
          <label className="block text-right">
            <MetricLabel className="mb-1.5 text-xs">إلى تاريخ</MetricLabel>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="text-numeric h-9 text-xs" />
          </label>
          <label className="block text-right">
            <MetricLabel className="mb-1.5 text-xs">بحث سريع</MetricLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم العميل أو رقم الفاتورة"
                className="pe-8 h-9 text-xs"
              />
            </div>
          </label>
          <label className="block text-right">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="كل العملاء" /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل العملاء</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block text-right">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)} disabled={activeTab !== "invoices"}>
              <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل الأنواع (فوري + قسط)</SelectItem>
                <SelectItem value="installment">قسط فقط</SelectItem>
                <SelectItem value="cash">فوري فقط</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block text-right">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} disabled={activeTab !== "invoices"}>
              <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="paid">مسدّدة بالكامل</SelectItem>
                <SelectItem value="partial">مسدّدة جزئياً</SelectItem>
                <SelectItem value="unpaid">غير مسدّدة</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        {from && to && from > to && (
          <p className="text-xs font-bold text-danger">⚠️ تاريخ "من" يجب أن يكون قبل "إلى"</p>
        )}
      </BezelCard>


      {showSkeleton ? (
        <div className="stagger grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-foreground/[0.06]" />
          ))}
        </div>
      ) : (
      <div className="stagger grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          mini
          className="h-full"
          label="إجمالي المبيعات المُصدرة"
          value={stats.sales}
          icon={Coins}
          tone="positive"
          masked={masked}
          series={stats.series.sales}
          format={money}
          sub={`${fmt(stats.count)} فاتورة في الفترة`}
        />

        <MetricCard
          mini
          className="h-full"
          label="التحصيلات الفعلية بالدرج"
          value={stats.totalCollectedActual}
          icon={ArrowDownRight}
          tone="positive"
          masked={masked}
          series={stats.series.collected}
          format={money}
          sub={`${fmt(periodPayments.length)} دفعة وقسط مُحصّل`}
        />

        <MetricCard
          mini
          className="h-full"
          label="المصروفات والمرتجعات"
          value={stats.periodExpenses + stats.periodReturnsTotal}
          icon={ArrowUpRight}
          tone="danger"
          masked={masked}
          format={money}
          sub={`${fmt(stats.periodExpenses)} مصروفات • ${fmt(stats.periodReturnsTotal)} مرتجع`}
        />

        <MetricCard
          mini
          className="h-full"
          label="صافي التدفق النقدي بالخزينة"
          value={stats.netCashDrawer}
          icon={Wallet}
          tone={stats.netCashDrawer >= 0 ? "positive" : "danger"}
          masked={masked}
          format={money}
          sub="التحصيلات - المصروفات - المرتجعات + حركات الخزينة"
        />
      </div>
      )}

      {/* تفصيل المبيعات الفورية والأقساط */}
      {!showSkeleton && (
      <div className="stagger mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          mini
          className="h-full"
          label="مبيعات فوري" value={stats.cashSales} icon={Coins} tone="positive" masked={masked}
          series={stats.series.cashSales} format={money} sub={stats.cashSales ? "بيع نقدي" : "لا توجد مبيعات فورية"}
        />
        <MetricCard
          mini
          className="h-full"
          label="مبيعات قسط" value={stats.instSales} icon={Coins} tone="positive" masked={masked}
          series={stats.series.instSales} format={money} sub={stats.instSales ? "فواتير آجلة/قسط" : "لا توجد مبيعات أقساط"}
        />
        <MetricCard
          mini
          className="h-full"
          label="المتبقي على فواتير الفترة" value={stats.remaining} icon={Clock} tone={stats.remaining > 0 ? "danger" : "neutral"}
          masked={masked} series={stats.series.remaining} format={money} sub="مستحقات غير محصلة بعد"
        />
        <MetricCard
          mini
          className="h-full"
          label="عدد الفواتير" value={stats.count} icon={FileText} isMoney={false}
          series={stats.series.count} format={(n) => `${Math.round(n)} فاتورة`} sub="حركة الفواتير"
        />
      </div>
      )}

      {/* تبويبات تفصيل حركة اليومية */}
      <div className="mt-8 space-y-4 pb-24 lg:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatTabs<ActiveTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "invoices", label: "فواتير الفترة", count: rows.length, icon: <FileText className="h-3.5 w-3.5 text-primary" /> },
              { value: "payments", label: "التحصيلات والأقساط المستلمة", count: periodPayments.length, icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" /> },
              { value: "expenses", label: "المصروفات اليومية", count: periodExpensesList.length, icon: <Receipt className="h-3.5 w-3.5 text-warning" /> },
              { value: "returns", label: "المرتجعات", count: periodReturnsList.length, icon: <RotateCcw className="h-3.5 w-3.5 text-danger" /> },
            ]}
          />

          <span className="text-xs font-medium text-muted-foreground font-mono">
            {rangeLabel}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* Main Table Content */}
          <Reveal>
            <BezelCard variant="flat" innerClassName="overflow-hidden p-1.5">
              {/* TAB 1: INVOICES */}
              {activeTab === "invoices" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[44rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3">الوقت</th>
                        <th className="p-3">العميل</th>
                        <th className="p-3">الإجمالي</th>
                        <th className="p-3">المدفوع</th>
                        <th className="p-3">المتبقي</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            لا توجد فواتير صادرة في هذا النطاق الزمني
                          </td>
                        </tr>
                      ) : (
                        pagedRows.map((inv) => {
                          const c = customerById.get(inv.customerId);
                          const st = statusMeta[invStatus(inv)];
                          const rem = Math.max(0, inv.total - inv.paid);
                          return (
                             <tr key={inv.id} className="hover:bg-foreground/[0.02] transition-colors cursor-pointer" onClick={() => setViewingInvoice(inv)}>
                              <td className="p-3 font-mono font-bold text-muted-foreground" dir="ltr">
                                {invoiceNumber(invoices, inv.id)}
                              </td>
                              <td className="p-3 text-muted-foreground font-mono">
                                {new Date(inv.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="p-3 font-semibold text-foreground">{c?.name ?? "—"}</td>
                              <td className={cn("p-3 font-mono font-bold", masked && "privacy-blur")}>{money(inv.total)}</td>
                              <td className={cn("p-3 font-mono font-bold text-success", masked && "privacy-blur")}>{money(inv.paid)}</td>
                              <td className={cn("p-3 font-mono font-bold", rem > 0 ? "text-danger" : "text-muted-foreground", masked && "privacy-blur")}>
                                {money(rem)}
                              </td>
                              <td className="p-3"><CustomerTypeBadge type={c?.customerType ?? "installment"} /></td>
                              <td className="p-3">
                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1", st.cls)}>
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: PAYMENTS & INSTALLMENTS COLLECTED */}
              {activeTab === "payments" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">تاريخ ووقت التحصيل</th>
                        <th className="p-3">العميل</th>
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3">المبلغ المحصّل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodPayments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            لا توجد تحصيلات أو أقساط مسددة في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        pagedPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-foreground/[0.02] transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">
                              {new Date(p.paidAt).toLocaleDateString("ar-EG")} {new Date(p.paidAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="p-3 font-semibold text-foreground">
                              {p.customer?.name || "عميل غير محدد"}
                            </td>
                            <td className="p-3 font-mono font-semibold" dir="ltr">
                              {p.invoice ? invoiceNumber(invoices, p.invoice.id) : "—"}
                            </td>
                            <td className={cn("p-3 font-mono font-black text-success text-sm", masked && "privacy-blur")}>
                              +{money(p.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: EXPENSES LIST */}
              {activeTab === "expenses" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">ملاحظات وبيان</th>
                        <th className="p-3">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodExpensesList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            لا توجد مصروفات مسجلة في هذا النطاق الزمني
                          </td>
                        </tr>
                      ) : (
                        pagedExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-foreground/[0.02] transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">{exp.expenseDate}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px]">
                                {expenseCategoryLabel(exp.category)}
                              </Badge>
                            </td>
                            <td className={cn("p-3 font-mono font-bold text-danger", masked && "privacy-blur")}>
                              -{money(exp.amount)}
                            </td>
                            <td className="p-3 text-muted-foreground">{exp.notes || "—"}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setEditingExpense(exp); setOpenExpense(true); }}
                                  className="press rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                                  title="تعديل"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm("حذف هذا المصروف؟")) return;
                                    try {
                                      await db.removeExpense(exp.id);
                                      toast.success("تم حذف المصروف");
                                    } catch (err: any) {
                                      toast.error(err?.message || "خطأ في الحذف");
                                    }
                                  }}
                                  className="press rounded-lg p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                                  title="حذف"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: RETURNS LIST */}
              {activeTab === "returns" && (
                <div className="no-scrollbar overflow-x-auto p-2 sm:p-3">
                  <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">تاريخ المرتجع</th>
                        <th className="p-3">العميل / الفاتورة</th>
                        <th className="p-3">قيمة المرتجع</th>
                        <th className="p-3">سبب الارتجاع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodReturnsList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            لا توجد مرتجعات مسجلة في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        pagedReturns.map((ret) => (
                          <tr key={ret.id} className="hover:bg-foreground/[0.02] transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">
                              {new Date(ret.createdAt).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="p-3 font-semibold text-foreground">
                              {ret.customer?.name || (ret.invoice ? invoiceNumber(invoices, ret.invoice.id) : "مرتجع بيع")}
                            </td>
                            <td className={cn("p-3 font-mono font-bold text-danger", masked && "privacy-blur")}>
                              -{money(ret.totalAmount)}
                            </td>
                            <td className="p-3 text-muted-foreground">{ret.reason || ret.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-3">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="press rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset ring-[var(--hairline)] disabled:opacity-40">السابق</button>
                  <span className="text-xs text-muted-foreground font-mono">صفحة {page} / {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="press rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset ring-[var(--hairline)] disabled:opacity-40">التالي</button>
                </div>
              )}
            </BezelCard>
          </Reveal>

          {/* Right Side Summary & Note */}
          <Reveal delay={90}>
            <BezelCard variant="flat" innerClassName="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--hairline)] pb-3">
                <span className="text-numeric text-[11px] text-muted-foreground font-mono" dir="ltr">{from} — {to}</span>
                <h2 className="text-base font-bold text-foreground">كشف تسوية الخزينة</h2>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-muted-foreground">إجمالي المبيعات المصدرة:</span>
                  <strong className={cn("font-mono text-foreground", masked && "privacy-blur")}>
                    {money(stats.sales)}
                  </strong>
                </div>

                <div className="flex justify-between items-center py-2.5">
                  <span className="text-success font-bold">التحصيلات والأقساط المستلمة:</span>
                  <strong className={cn("font-mono text-success text-sm font-black", masked && "privacy-blur")}>
                    +{money(stats.totalCollectedActual)}
                  </strong>
                </div>

                {stats.periodDownPayments > 0 && (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-muted-foreground">مقدم (دفعة مقدمة) على فواتير الفترة:</span>
                    <strong className={cn("font-mono text-muted-foreground", masked && "privacy-blur")}>
                      +{money(stats.periodDownPayments)}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center py-2.5">
                  <span className="text-danger">المصروفات النقدية المسحوبة:</span>
                  <strong className={cn("font-mono text-danger", masked && "privacy-blur")}>
                    -{money(stats.periodExpenses)}
                  </strong>
                </div>

                {stats.periodReturnsTotal > 0 && (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-danger">مرتجعات مبيعات نقدية:</span>
                    <strong className={cn("font-mono text-danger", masked && "privacy-blur")}>
                      -{money(stats.periodReturnsTotal)}
                    </strong>
                  </div>
                )}

                {(stats.manualIn > 0 || stats.manualOut > 0) && (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-muted-foreground">حركات خزينة يدوية (إيداع/سحب):</span>
                    <strong className={cn("font-mono", masked && "privacy-blur")}>
                      {stats.manualIn - stats.manualOut >= 0 ? "+" : ""}{money(stats.manualIn - stats.manualOut)}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center py-3">
                  <span className="font-bold text-foreground">صافي رصيد الخزينة بالدرج:</span>
                  <strong className={cn("font-mono text-base font-black text-primary", masked && "privacy-blur")}>
                    {money(stats.netCashDrawer)}
                  </strong>
                </div>

                {stats.cashboxBalance !== null && (
                  <div className="flex justify-between items-center py-2.5 border-t border-[var(--hairline)] mt-1 pt-2.5">
                    <span className="text-muted-foreground">رصيد الخزينة (الحالي — من نظام الخزينة):</span>
                    <strong className={cn("font-mono text-muted-foreground", masked && "privacy-blur")}>
                      {money(stats.cashboxBalance)}
                    </strong>
                  </div>
                )}

              </div>

              <div className="border-t border-[var(--hairline)] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">تُحفَظ محلياً تلقائياً</span>
                  <h3 className="text-xs font-bold text-foreground">ملاحظة اليوم واليومية</h3>
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="سجل ملاحظات أو أحداث اليوم أو جرد العهدة هنا..."
                  className="mt-2 text-xs resize-none"
                />
                <div className="mt-2.5 flex justify-end">
                  <Button size="sm" variant="secondary" onClick={saveNote} className="rounded-xl text-xs font-bold">
                    حفظ الملاحظة
                  </Button>
                </div>
              </div>
            </BezelCard>
          </Reveal>
        </div>
      </div>

      <ViewInvoiceDialog
        inv={viewingInvoice}
        customer={viewingInvoice ? customerById.get(viewingInvoice.customerId) ?? null : null}
        items={invoiceItems}
        payments={payments}
        onClose={() => setViewingInvoice(null)}
      />
      <ExpenseFormModal open={openExpense} onOpenChange={(v) => { setOpenExpense(v); if (!v) setEditingExpense(null); }} editing={editingExpense} defaultDate={from || todayISO()} defaultAccountId="acc-cash-main" />
    </>
  );
}
