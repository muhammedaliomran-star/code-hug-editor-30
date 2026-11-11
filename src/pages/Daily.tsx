import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { PageHeader } from "@/components/PageHeader";
import { ExpenseFormModal } from "@/components/expenses/ExpenseFormModal";
import {
  EditInvoiceDialog,
  InvoiceReturnDialog,
  PaymentDialog,
  ShareInvoiceDialog,
  ViewInvoiceDialog,
} from "@/components/invoices";
import { CreateInvoiceShipmentDialog } from "@/components/CreateInvoiceShipmentDialog";
import { InvoicePrintCustomizerDialog } from "@/components/InvoicePrintCustomizerDialog";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { MetricCard, MetricLabel } from "@/components/MetricCard";
import { ActionButton } from "@/components/ActionButton";
import { FilterChips } from "@/components/FilterChips";
import { StatTabs } from "@/components/StatTabs";
import { CountUp } from "@/components/CountUp";
import { DatePickerField } from "@/components/DatePickerField";
import { DailyDraftsSection } from "@/components/daily/DailyDraftsSection";

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
  db, useDB, fmt, invoiceNumber, expenseCategoryLabel, EXPENSE_CATEGORIES, invalidateCache, useShopSettings, type Invoice,
} from "@/lib/store";
import { usePrivacy } from "@/lib/privacy";
import { decodeExpenseNotes } from "@/lib/expenses-system";
import { getManualTransactions, getInternalTransfers, calculateAccountBalance, getTreasuryAccounts } from "@/lib/cashbox-system";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Eye, EyeOff, Download, Search, FileSpreadsheet, FileText, Receipt,
  Coins, Wallet, CheckCircle2, ChevronDown, Pencil, Trash2,
  ArrowDownRight, ArrowUpRight, Clock, RotateCcw, Printer,
} from "lucide-react";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";

export default function Page() {
  const confirm = useConfirm();
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
type ActiveTab = "invoices" | "payments" | "expenses" | "returns" | "vouchers";

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

/** صف واحد في كشف تسوية الخزينة (داخل / خارج). */
function LedgerRow({
  label, value, sign, tone = "muted", masked, icon,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
  tone?: "positive" | "danger" | "muted";
  masked?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-foreground/[0.03]">
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <strong
        className={cn(
          "shrink-0 font-mono text-xs font-bold",
          tone === "positive" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground/75",
          masked && "privacy-blur",
        )}
      >
        {sign}{fmt(value)} <span className="text-[10px] font-normal opacity-60">ج.م</span>
      </strong>
    </div>
  );
}

/** حالة فراغ للجداول — بدل سطر "لا توجد..." (أيقونة + عنوان + تلميح + إجراء). */
function EmptyState({
  icon, title, hint, actionLabel, onAction,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[14rem] flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-foreground/[0.05] text-muted-foreground ring-1 ring-inset ring-[var(--hairline)]">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {hint && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="press inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function DailyPage() {
  const { invoices, customers, expenses, payments, returns, returnItems, paymentVouchers, invoiceItems, carriers, zones, loading: dbLoading, fetchErrors, refresh } = useDB();
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [shareInvoice, setShareInvoice] = useState<Invoice | null>(null);
  const [customPrintInvoice, setCustomPrintInvoice] = useState<Invoice | null>(null);
  const [shipmentInvoice, setShipmentInvoice] = useState<Invoice | null>(null);
  const [directPayState, setDirectPayState] = useState<{ invoiceId: string; max: number; invoiceNo: string; customerName: string; initialAmount: number } | null>(null);
  const { privacy, toggle } = usePrivacy();
  const { settings: shopSettings } = useShopSettings();
  const masked = privacy;

  const urlSearch = useSearch({ from: "/daily" });
  const navigate = useNavigate();

  const handleCloneInvoice = (inv: Invoice) => {
    const invItems = invoiceItems.filter((item) => item.invoiceId === inv.id);
    const monthsCount = inv.monthlyInstallment > 0
      ? Math.max(1, Math.round((inv.total - inv.downPayment) / Math.max(1, inv.monthlyInstallment)))
      : 6;
    sessionStorage.setItem("segilly_clone_invoice", JSON.stringify({
      customerId: inv.customerId,
      products: invItems.map((item) => ({
        name: item.name,
        cost: item.cost,
        price: item.price,
        quantity: item.quantity || 1,
        discount: item.discountPct,
        taxPct: item.taxPct,
        serialNumbers: item.serialNumbers.join(", "),
      })),
      notes: inv.notes,
      saleType: inv.monthlyInstallment > 0 ? "installments" : "cash",
      down: inv.downPayment,
      monthly: inv.monthlyInstallment,
      count: monthsCount,
      discountPct: inv.discountPct,
      taxPct: inv.taxPct,
    }));
    navigate({ to: "/invoices/new" });
  };

  const [from, setFrom] = useState(urlSearch.from ?? todayISO());
  const [to, setTo] = useState(urlSearch.to ?? todayISO());
  const [search, setSearch] = useState(urlSearch.search ?? "");
  const [customerId, setCustomerId] = useState<"all" | string>(urlSearch.customerId ?? "all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(urlSearch.typeFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(urlSearch.statusFilter ?? "all");
  const [categoryFilter, setCategoryFilter] = useState<string>(urlSearch.categoryFilter ?? "all");
  const [activeTab, setActiveTab] = useState<ActiveTab>(urlSearch.activeTab ?? "invoices");
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [noteTick, setNoteTick] = useState(0);
  const [noteStatus, setNoteStatus] = useState<"saved" | "local">("saved");
  const [treasuryTick, setTreasuryTick] = useState(0);
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
        categoryFilter: categoryFilter !== "all" ? categoryFilter : undefined,
        quickPreset: quickPreset !== "today" ? quickPreset : undefined,
      },
      replace: true,
      resetScroll: false,
    });
    setPage(1);
  }, [from, to, search, customerId, typeFilter, statusFilter, activeTab, categoryFilter, quickPreset, navigate]);
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
      db.saveDailyNote(from, to, note)
        .then(() => setNoteStatus("saved"))
        .catch(() => setNoteStatus("local"));
    }, 800);
    return () => clearTimeout(t);
  }, [note]);

  // تحديث رصيد الخزينة من السحابة (تقليل التأخر) — ثم إعادة حساب اللوحة
  useEffect(() => {
    import("@/lib/cashbox-sync")
      .then((m) => m.pullCashboxFromCloud()
        .then((ok) => { if (ok) setTreasuryTick((t) => t + 1); }))
      .catch(() => {});
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
    const syncTreasury = () => {
      import("@/lib/cashbox-sync")
        .then((m) => m.pullCashboxFromCloud().then((ok) => { if (ok) setTreasuryTick((t) => t + 1); }))
        .catch(() => {});
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
          .on("postgres_changes", { event: "*", schema: "public", table: "return_items", filter: `user_id=eq.${uid}` }, () => schedule("return_items", () => invalidateCache("return_items")))
          .on("postgres_changes", { event: "*", schema: "public", table: "payment_vouchers", filter: `user_id=eq.${uid}` }, () => schedule("payment_vouchers", () => invalidateCache("payment_vouchers")))
          .on("postgres_changes", { event: "*", schema: "public", table: "treasury_transactions", filter: `user_id=eq.${uid}` }, () => schedule("treasury", syncTreasury))
          .on("postgres_changes", { event: "*", schema: "public", table: "treasury_accounts", filter: `user_id=eq.${uid}` }, () => schedule("treasury", syncTreasury))
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

  // Category filter options: base list + any custom category found in the data.
  const expenseCategoryOptions = useMemo(() => {
    const opts = EXPENSE_CATEGORIES.map((c) => ({ value: c.value as string, label: c.label }));
    const seen = new Set(opts.map((o) => o.value));
    for (const e of expenses) {
      if (!seen.has(e.category)) {
        seen.add(e.category);
        opts.push({ value: e.category, label: expenseCategoryLabel(e.category) });
      }
    }
    return opts;
  }, [expenses]);

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
        if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
        if (q) {
          const label = expenseCategoryLabel(e.category).toLowerCase();
          const { cleanNotes, meta } = decodeExpenseNotes(e.notes);
          // Ignore the hidden meta blob; search the human-readable text only.
          const txt = `${label} ${cleanNotes} ${meta.recipientName ?? ""} ${meta.voucherNumber ?? ""}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [expenses, from, to, search, categoryFilter]);

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

  // Return line items grouped by their parent return record (issue #4).
  const returnItemsByReturn = useMemo(() => {
    const map = new Map<string, typeof returnItems>();
    for (const it of returnItems) {
      const arr = map.get(it.returnId);
      if (arr) arr.push(it);
      else map.set(it.returnId, [it]);
    }
    return map;
  }, [returnItems]);

  // Receipt / payment vouchers during the period (issue #7).
  // Shown for information only — NOT part of the cash-drawer net (avoids double counting).
  const periodVouchersList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paymentVouchers
      .filter((v) => {
        if (from && v.voucherDate < from) return false;
        if (to && v.voucherDate > to) return false;
        if (customerId !== "all" && v.customerId !== customerId) return false;
        if (q) {
          const cust = v.customerId ? customerById.get(v.customerId) : null;
          const txt = `${v.partyName ?? ""} ${v.partyPhone ?? ""} ${cust?.name ?? ""} ${v.description ?? ""} ${v.paymentMethod ?? ""}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime());
  }, [paymentVouchers, from, to, customerId, customerById, search]);

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
    // Vouchers are informational only (never added to the drawer net).
    const periodVoucherReceipts = periodVouchersList.filter((v) => v.type === "receipt").reduce((s, v) => s + v.amount, 0);
    const periodVoucherPayments = periodVouchersList.filter((v) => v.type === "payment").reduce((s, v) => s + v.amount, 0);
    
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
      periodVoucherReceipts,
      periodVoucherPayments,
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
  }, [rows, customerById, periodPayments, periodExpensesList, periodReturnsList, periodVouchersList, payments, invoices, expenses, from, to, treasuryTick]);

  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedPayments = periodPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedExpenses = periodExpensesList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedReturns = periodReturnsList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedVouchers = periodVouchersList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeListLen =
    activeTab === "invoices" ? rows.length :
    activeTab === "payments" ? periodPayments.length :
    activeTab === "expenses" ? periodExpensesList.length :
    activeTab === "returns" ? periodReturnsList.length : periodVouchersList.length;
  const totalPages = Math.max(1, Math.ceil(activeListLen / PAGE_SIZE));

  // Clamp current page when data shrinks (e.g. realtime refresh / filter change)
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const filtersActive =
    !!search.trim() || customerId !== "all" || typeFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setCustomerId("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setQuickPreset("today");
    setFrom(todayISO());
    setTo(todayISO());
  };

  const money = (n: number) => `${fmt(n)} ج.م`;
  const rangeLabel = from === to
    ? new Date(from || todayISO()).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })
    : `${from} — ${to}`;

  const fmtChipDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return iso;
    }
  };
  const dateChipLabel = from === to ? fmtChipDate(from) : `${fmtChipDate(from)} — ${fmtChipDate(to)}`;

  const saveNote = () => {
    try { localStorage.setItem(noteKey(from, to), note); } catch { /* ignore */ }
    // push to server (best-effort; falls back to localStorage if offline)
    (async () => {
      try {
        await db.saveDailyNote(from, to, note);
        setNoteStatus("saved");
        toast.success("تم حفظ الملاحظة (محلي + سيرفر)");
      } catch (err: any) {
        setNoteStatus("local");
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
        decodeExpenseNotes(e.notes).cleanNotes,
      ]);
    } else if (activeTab === "returns") {
      headers = ["التاريخ", "العميل", "الفاتورة", "المبلغ", "البنود", "السبب"];
      body = periodReturnsList.map((r) => [
        new Date(r.createdAt).toLocaleDateString("en-CA"),
        r.customer?.name ?? "—",
        r.invoice ? invoiceNumber(invoices, r.invoice.id) : "—",
        r.totalAmount,
        (returnItemsByReturn.get(r.id) ?? []).map((it) => `${it.name} ×${it.quantity}`).join(" · "),
        r.reason ?? "",
      ]);
    } else if (activeTab === "vouchers") {
      headers = ["التاريخ", "النوع", "الطرف", "طريقة الدفع", "المبلغ", "الوصف"];
      body = periodVouchersList.map((v) => [
        v.voucherDate,
        v.type === "receipt" ? "سند قبض" : "سند صرف",
        v.partyName || (v.customerId ? customerById.get(v.customerId)?.name : "") || "—",
        v.paymentMethod || "—",
        v.amount,
        v.description ?? "",
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

  // Build every tab's rows at once (issue #6: "تصدير الكل").
  const buildAllSections = () => {
    const sections: { title: string; headers: string[]; rows: (string | number)[][] }[] = [];

    sections.push({
      title: "فواتير الفترة",
      headers: ["رقم الفاتورة", "التاريخ", "العميل", "الإجمالي", "المدفوع", "المتبقي", "الحالة"],
      rows: rows.map((inv) => {
        const c = customerById.get(inv.customerId);
        return [
          invoiceNumber(invoices, inv.id),
          new Date(inv.createdAt).toLocaleDateString("en-CA"),
          c?.name ?? "—",
          inv.total, inv.paid, Math.max(0, inv.total - inv.paid),
          statusMeta[invStatus(inv)].label,
        ];
      }),
    });

    sections.push({
      title: "التحصيلات والأقساط المستلمة",
      headers: ["التاريخ", "العميل", "الفاتورة", "المبلغ"],
      rows: periodPayments.map((p) => [
        new Date(p.paidAt).toLocaleDateString("en-CA"),
        p.customer?.name ?? "—",
        p.invoice ? invoiceNumber(invoices, p.invoice.id) : "—",
        p.amount,
      ]),
    });

    sections.push({
      title: "المصروفات",
      headers: ["التاريخ", "التصنيف", "المبلغ", "ملاحظات"],
      rows: periodExpensesList.map((e) => [
        e.expenseDate,
        expenseCategoryLabel(e.category),
        e.amount,
        decodeExpenseNotes(e.notes).cleanNotes,
      ]),
    });

    sections.push({
      title: "المرتجعات",
      headers: ["التاريخ", "العميل", "الفاتورة", "المبلغ", "البنود", "السبب"],
      rows: periodReturnsList.map((r) => [
        new Date(r.createdAt).toLocaleDateString("en-CA"),
        r.customer?.name ?? "—",
        r.invoice ? invoiceNumber(invoices, r.invoice.id) : "—",
        r.totalAmount,
        (returnItemsByReturn.get(r.id) ?? []).map((it) => `${it.name} ×${it.quantity}`).join(" · "),
        r.reason ?? "",
      ]),
    });

    sections.push({
      title: "سندات القبض والصرف",
      headers: ["التاريخ", "النوع", "الطرف", "طريقة الدفع", "المبلغ", "الوصف"],
      rows: periodVouchersList.map((v) => [
        v.voucherDate,
        v.type === "receipt" ? "سند قبض" : "سند صرف",
        v.partyName || (v.customerId ? customerById.get(v.customerId)?.name : "") || "—",
        v.paymentMethod || "—",
        v.amount,
        v.description ?? "",
      ]),
    });

    return sections;
  };

  const exportAllCSV = () => {
    const clean = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    for (const sec of buildAllSections()) {
      lines.push(clean(`## ${sec.title}`));
      lines.push(sec.headers.map(clean).join(","));
      for (const r of sec.rows) lines.push(r.map(clean).join(","));
      lines.push("");
    }
    const csv = "\uFEFF" + lines.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `daily-all-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير كل التبويبات");
  };

  const exportAllPDF = () => {
    const sections = buildAllSections();
    const body = sections.map((sec) => `
      <h3>${escapeHtml(sec.title)}</h3>
      <table><thead><tr>${sec.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${sec.rows.length
        ? sec.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${sec.headers.length}">لا توجد حركة</td></tr>`}</tbody></table>
    `).join("");

    const html = pdfDocument({
      docTitle: "اليومية — تصدير شامل",
      badge: "حركة يومية",
      title: "اليومية — تصدير شامل",
      lede: rangeLabel,
      meta: [{ label: "الفترة", value: `${from} — ${to}` }],
      body: `${body}
        <p>إجمالي المبيعات: ${fmt(stats.sales)} ج.م — المحصّل الفعلي: ${fmt(stats.totalCollectedActual)} ج.م — المصروفات: ${fmt(stats.periodExpenses)} ج.م — المرتجعات: ${fmt(stats.periodReturnsTotal)} ج.م — صافي الدرج: ${fmt(stats.netCashDrawer)} ج.م</p>`,
    });
    openPdfDocument(html);
  };

  // Print only the treasury settlement statement (panel export).
  const exportSettlementPDF = () => {
    const rows: { label: string; value: number; sign?: string; cls?: string }[] = [
      { label: "إجمالي المبيعات المُصدرة", value: stats.sales },
      { label: "التحصيلات والأقساط المستلمة", value: stats.totalCollectedActual, sign: "+", cls: "pay" },
    ];
    if (stats.periodDownPayments > 0) rows.push({ label: "مقدم على فواتير الفترة", value: stats.periodDownPayments, sign: "+", cls: "pay" });
    rows.push({ label: "المصروفات النقدية المسحوبة", value: stats.periodExpenses, sign: "−", cls: "due" });
    if (stats.periodReturnsTotal > 0) rows.push({ label: "مرتجعات مبيعات نقدية", value: stats.periodReturnsTotal, sign: "−", cls: "due" });
    if (stats.manualIn > 0) rows.push({ label: "إيداعات خزينة يدوية", value: stats.manualIn, sign: "+", cls: "pay" });
    if (stats.manualOut > 0) rows.push({ label: "سحوبات خزينة يدوية", value: stats.manualOut, sign: "−", cls: "due" });

    const tbody = rows.map((r) =>
      `<tr><td>${escapeHtml(r.label)}</td><td class="num ${r.cls ?? ""}">${r.sign ?? ""}${fmt(r.value)} ج.م</td></tr>`
    ).join("");

    const netColor = stats.netCashDrawer < 0 ? "#e11d48" : "#047857";
    const netBar = `<div class="total-bar"><span>صافي رصيد الخزينة بالدرج</span><span class="v" style="color:${netColor}">${fmt(stats.netCashDrawer)} ج.م</span></div>`;

    const cashboxLine = stats.cashboxBalance !== null
      ? `<p><b>رصيد الخزينة الحالي (نظام الخزينة):</b> ${fmt(stats.cashboxBalance)} ج.م — <b>قبل الفترة ≈</b> ${fmt(stats.cashboxBalance - stats.netCashDrawer)} ج.م</p>`
      : "";

    const vouchersNote = (stats.periodVoucherReceipts > 0 || stats.periodVoucherPayments > 0)
      ? `<p><b>سندات القبض/الصرف</b> (للعلم فقط — غير محتسبة في الصافي): <span class="tag payment">+${fmt(stats.periodVoucherReceipts)} ج.م</span> <span class="tag purchase">−${fmt(stats.periodVoucherPayments)} ج.م</span></p>`
      : "";

    const html = pdfDocument({
      docTitle: "كشف تسوية الخزينة",
      badge: "حركة يومية",
      title: "كشف تسوية الخزينة",
      lede: rangeLabel,
      meta: [{ label: "الفترة", value: `${from} — ${to}` }],
      body: `<table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>${tbody}</tbody></table>${netBar}${cashboxLine}${vouchersNote}`,
    });
    openPdfDocument(html);
  };

  const exportPDF = () => {
    let thead = "";
    let tbody = "";
    let colspan = 8;
    const tabTitle =
      activeTab === "invoices" ? "فواتير الفترة" :
      activeTab === "payments" ? "التحصيلات والأقساط المستلمة" :
      activeTab === "expenses" ? "المصروفات اليومية" :
      activeTab === "returns" ? "المرتجعات" : "سندات القبض والصرف";

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
        `<tr><td>${i + 1}</td><td>${escapeHtml(e.expenseDate)}</td><td>${escapeHtml(expenseCategoryLabel(e.category))}</td><td class="num">${fmt(e.amount)} ج.م</td><td>${escapeHtml(decodeExpenseNotes(e.notes).cleanNotes || "—")}</td></tr>`
      ).join("");
      colspan = 5;
    } else if (activeTab === "returns") {
      thead = "<tr><th>م</th><th>التاريخ</th><th>العميل</th><th>الفاتورة</th><th>المبلغ</th><th>البنود</th><th>السبب</th></tr>";
      tbody = periodReturnsList.map((r, i) => {
        const items = (returnItemsByReturn.get(r.id) ?? []).map((it) => `${it.name} ×${it.quantity}`).join(" · ");
        return `<tr><td>${i + 1}</td><td>${new Date(r.createdAt).toLocaleDateString("en-CA")}</td><td>${escapeHtml(r.customer?.name ?? "—")}</td><td>${r.invoice ? escapeHtml(invoiceNumber(invoices, r.invoice.id)) : "—"}</td><td class="num">${fmt(r.totalAmount)} ج.م</td><td>${escapeHtml(items || "—")}</td><td>${escapeHtml(r.reason ?? "—")}</td></tr>`;
      }).join("");
      colspan = 7;
    } else if (activeTab === "vouchers") {
      thead = "<tr><th>م</th><th>التاريخ</th><th>النوع</th><th>الطرف</th><th>طريقة الدفع</th><th>المبلغ</th><th>الوصف</th></tr>";
      tbody = periodVouchersList.map((v, i) => {
        const party = v.partyName || (v.customerId ? customerById.get(v.customerId)?.name : "") || "—";
        return `<tr><td>${i + 1}</td><td>${escapeHtml(v.voucherDate)}</td><td>${v.type === "receipt" ? "سند قبض" : "سند صرف"}</td><td>${escapeHtml(party)}</td><td>${escapeHtml(v.paymentMethod || "—")}</td><td class="num">${fmt(v.amount)} ج.م</td><td>${escapeHtml(v.description ?? "—")}</td></tr>`;
      }).join("");
      colspan = 7;
    }

    const emptyRow = `<tr><td colspan="${colspan}">لا توجد حركة في الفترة</td></tr>`;
    const html = pdfDocument({
      docTitle: `اليومية — ${tabTitle}`,
      badge: "حركة يومية",
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
        title="اليومية"
        subtitle="حركة نقدية — مبيعات · تحصيلات · مصروفات · صافي الدرج"
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
                    <FileSpreadsheet className="me-2 h-4 w-4" /> التبويب الحالي (Excel / CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPDF}>
                    <FileText className="me-2 h-4 w-4" /> التبويب الحالي (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAllCSV}>
                    <FileSpreadsheet className="me-2 h-4 w-4" /> تصدير الكل (Excel / CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAllPDF}>
                    <FileText className="me-2 h-4 w-4" /> تصدير الكل (PDF)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ActionButton
                tone="surface"
                onClick={toggle}
                title={masked ? "إظهار الأرقام" : "إخفاء الأرقام"}
                icon={masked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              />
              <ActionButton onClick={() => { setEditingExpense(null); setOpenExpense(true); }} icon={<Plus className="h-4 w-4" />}>
                إضافة مصروف
              </ActionButton>
            </div>

          </div>
        }
      />

      {fetchErrors.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger/10 px-4 py-3 text-xs ring-1 ring-inset ring-danger/25">
          <span className="font-bold text-danger">
            ⚠️ تعذّر تحميل {fetchErrors.length} جدول من السحابة — الأرقام قد تكون ناقصة.
          </span>
          <div className="flex items-center gap-2">
            <span className="max-w-[24rem] truncate font-mono text-[10px] text-muted-foreground" dir="ltr" title={fetchErrors.join(" • ")}>
              {fetchErrors.slice(0, 2).join(" • ")}
            </span>
            <button
              type="button"
              onClick={() => { refresh().catch(() => {}); }}
              className="press rounded-lg bg-danger/15 px-3 py-1 font-bold text-danger ring-1 ring-inset ring-danger/30"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

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
            <DatePickerField value={from} onChange={setFrom} className="h-9 text-xs" />
          </label>
          <label className="block text-right">
            <MetricLabel className="mb-1.5 text-xs">إلى تاريخ</MetricLabel>
            <DatePickerField value={to} onChange={setTo} className="h-9 text-xs" />
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
          <label className="block text-right">
            <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={activeTab !== "expenses"}>
              <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل تصنيفات المصروف</SelectItem>
                {expenseCategoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
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

      <DailyDraftsSection />

      {/* تبويبات تفصيل حركة اليومية */}
      <div className="mt-8 space-y-4 pb-24 lg:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatTabs<ActiveTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "invoices", label: "فواتير الفترة", count: rows.length, icon: <FileText className="h-3.5 w-3.5 text-primary" /> },
              { value: "payments", label: "التحصيلات والأقساط المستلمة", count: periodPayments.length, icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" /> },
              { value: "expenses", label: "المصروفات اليومية", count: periodExpensesList.length, icon: <Receipt className="h-3.5 w-3.5 text-danger" /> },
              { value: "returns", label: "المرتجعات", count: periodReturnsList.length, icon: <RotateCcw className="h-3.5 w-3.5 text-danger" /> },
              { value: "vouchers", label: "سندات القبض والصرف", count: periodVouchersList.length, icon: <Wallet className="h-3.5 w-3.5 text-primary" /> },
            ]}
          />

          <span className="text-xs font-medium text-muted-foreground font-mono">
            {rangeLabel}
          </span>
        </div>

        <div className="grid gap-4 items-stretch lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Main Table Content */}
          <Reveal className="h-full">
            <BezelCard variant="flat" className="flex h-full flex-col" innerClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5">
              {/* TAB 1: INVOICES */}
              {activeTab === "invoices" && (
  rows.length === 0 ? (
    <EmptyState icon={<FileText className="h-5 w-5" />} title="لا توجد فواتير صادرة في هذا النطاق الزمني" hint="غيّر نطاق التاريخ أو أضف فاتورة جديدة لبدء تتبع الحركة." actionLabel="إضافة فاتورة" onAction={() => navigate({ to: "/invoices/new" })} />
  ) : (
    <div className="no-scrollbar flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:max-h-[calc(100vh-15rem)]">
      <div className="space-y-3 sm:hidden">
        {pagedRows.map((inv) => {
          const c = customerById.get(inv.customerId);
          const st = statusMeta[invStatus(inv)];
          const rem = Math.max(0, inv.total - inv.paid);
          return (
            <div key={inv.id} className="rounded-2xl bg-foreground/[0.035] p-3 ring-1 ring-inset ring-[var(--hairline)]" onClick={() => setViewingInvoice(inv)}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1", st.cls)}>{st.label}</span>
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-foreground">#{invoiceNumber(invoices, inv.id)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(inv.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} · {c?.name ?? "—"}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-xl bg-foreground/[0.04] p-2"><b className="block text-muted-foreground">الإجمالي</b><strong className="mt-1 block">{money(inv.total)}</strong></span>
                <span className="rounded-xl bg-foreground/[0.04] p-2"><b className="block text-muted-foreground">النوع</b><strong className="mt-1 block"><CustomerTypeBadge type={c?.customerType ?? "installment"} /></strong></span>
                <span className="rounded-xl bg-foreground/[0.04] p-2"><b className="block text-muted-foreground">المدفوع</b><strong className="mt-1 block text-success">{money(inv.paid)}</strong></span>
                <span className="rounded-xl bg-foreground/[0.04] p-2"><b className="block text-muted-foreground">المتبقي</b><strong className={cn("mt-1 block", rem > 0 ? "text-danger" : "text-muted-foreground")}>{money(rem)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
      <table className="hidden w-full min-w-[44rem] text-right text-xs sm:table">
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
              )
            )}

              {/* TAB 2: PAYMENTS & INSTALLMENTS COLLECTED */}
              {activeTab === "payments" && (
  periodPayments.length === 0 ? (
    <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="لا توجد تحصيلات أو أقساط مسددة في هذه الفترة" hint="التحصيلات تُسجَّل تلقائياً عند استلام الأقساط." actionLabel="تسجيل تحصيل" onAction={() => navigate({ to: "/payments" })} />
  ) : (
    <div className="no-scrollbar flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:max-h-[calc(100vh-15rem)]">
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
              )
            )}

              {/* TAB 3: EXPENSES LIST */}
              {activeTab === "expenses" && (
  periodExpensesList.length === 0 ? (
    <EmptyState icon={<Receipt className="h-5 w-5" />} title="لا توجد مصروفات مسجلة في هذا النطاق الزمني" hint="سجّل مصروفات الخزينة والفرع من هنا." actionLabel="إضافة مصروف" onAction={() => setOpenExpense(true)} />
  ) : (
    <div className="no-scrollbar flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:max-h-[calc(100vh-15rem)]">
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
                            <td className="p-3 text-muted-foreground">{decodeExpenseNotes(exp.notes).cleanNotes || "—"}</td>
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
                                    if (!(await confirm({ description: "حذف هذا المصروف؟", tone: "danger", confirmLabel: "حذف" }))) return;
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
              )
            )}

              {/* TAB 4: RETURNS LIST */}
              {activeTab === "returns" && (
  periodReturnsList.length === 0 ? (
    <EmptyState icon={<RotateCcw className="h-5 w-5" />} title="لا توجد مرتجعات مسجلة في هذه الفترة" hint="المرتجعات تُسجَّل من صفحة المرتجعات." actionLabel="تسجيل مرتجع" onAction={() => navigate({ to: "/returns" })} />
  ) : (
    <div className="no-scrollbar flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:max-h-[calc(100vh-15rem)]">
      <table className="w-full min-w-[36rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">تاريخ المرتجع</th>
                        <th className="p-3">العميل / الفاتورة</th>
                        <th className="p-3">قيمة المرتجع</th>
                        <th className="p-3">البنود المرتجعة</th>
                        <th className="p-3">سبب الارتجاع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodReturnsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
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
                            <td className="p-3 text-muted-foreground">
                              {(returnItemsByReturn.get(ret.id) ?? []).length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  {(returnItemsByReturn.get(ret.id) ?? []).map((it) => (
                                    <span key={it.id} className="text-[11px]">
                                      {it.name} <span className="font-mono text-foreground/70">×{fmt(it.quantity)}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{ret.reason || ret.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}

              {/* TAB 5: RECEIPT / PAYMENT VOUCHERS (informational) */}
              {activeTab === "vouchers" && (
  periodVouchersList.length === 0 ? (
    <EmptyState icon={<Wallet className="h-5 w-5" />} title="لا توجد سندات قبض أو صرف في هذه الفترة" hint="سندات القبض والصرف تُسجَّل من صفحة التحصيلات." actionLabel="إصدار سند" onAction={() => navigate({ to: "/payments" })} />
  ) : (
    <div className="no-scrollbar flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:max-h-[calc(100vh-15rem)]">
      <table className="w-full min-w-[40rem] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] text-[11px] font-bold text-muted-foreground">
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3">الطرف</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">الوصف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)]">
                      {periodVouchersList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            لا توجد سندات قبض أو صرف في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        pagedVouchers.map((v) => {
                          const isReceipt = v.type === "receipt";
                          const party = v.partyName || (v.customerId ? customerById.get(v.customerId)?.name : "") || "—";
                          return (
                            <tr key={v.id} className="hover:bg-foreground/[0.02] transition-colors">
                              <td className="p-3 font-mono text-muted-foreground">{v.voucherDate}</td>
                              <td className="p-3">
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1",
                                  isReceipt ? "bg-success/12 text-success ring-success/25" : "bg-danger/12 text-danger ring-danger/25",
                                )}>
                                  {isReceipt ? "سند قبض" : "سند صرف"}
                                </span>
                              </td>
                              <td className="p-3 font-semibold text-foreground">{party}</td>
                              <td className="p-3 text-muted-foreground">{v.paymentMethod || "—"}</td>
                              <td className={cn("p-3 font-mono font-bold", isReceipt ? "text-success" : "text-danger", masked && "privacy-blur")}>
                                {isReceipt ? "+" : "-"}{money(v.amount)}
                              </td>
                              <td className="p-3 text-muted-foreground">{v.description || "—"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )
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
          <Reveal delay={90} className="h-full">
            <BezelCard variant="flat" className="flex h-full flex-col" innerClassName="flex flex-col gap-4 p-5 sm:p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold leading-tight text-foreground">كشف تسوية الخزينة</h2>
                    <span className="mt-1 inline-flex items-center rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-[var(--hairline)]">
                      {dateChipLabel}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={exportSettlementPDF}
                  className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:text-foreground"
                  title="طباعة كشف التسوية"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sales reference */}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
                <span className="text-[11px] font-medium text-muted-foreground">إجمالي المبيعات المُصدرة</span>
                <strong className={cn("font-mono text-xs font-bold text-foreground/80", masked && "privacy-blur")}>
                  {money(stats.sales)}
                </strong>
              </div>

              {/* Money in */}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-success">
                  <ArrowDownRight className="h-3.5 w-3.5" /> الداخل
                </div>
                <div className="space-y-0.5">
                  <LedgerRow label="التحصيلات والأقساط المستلمة" value={stats.totalCollectedActual} sign="+" tone="positive" masked={masked} />
                  {stats.periodDownPayments > 0 && (
                    <LedgerRow label="مقدم على فواتير الفترة" value={stats.periodDownPayments} sign="+" masked={masked} />
                  )}
                  {stats.manualIn > 0 && (
                    <LedgerRow label="إيداعات خزينة يدوية" value={stats.manualIn} sign="+" masked={masked} />
                  )}
                </div>
              </div>

              {/* Money out */}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-danger">
                  <ArrowUpRight className="h-3.5 w-3.5" /> الخارج
                </div>
                <div className="space-y-0.5">
                  <LedgerRow label="المصروفات النقدية المسحوبة" value={stats.periodExpenses} sign="−" tone="danger" masked={masked} />
                  {stats.periodReturnsTotal > 0 && (
                    <LedgerRow label="مرتجعات مبيعات نقدية" value={stats.periodReturnsTotal} sign="−" tone="danger" masked={masked} />
                  )}
                  {stats.manualOut > 0 && (
                    <LedgerRow label="سحوبات خزينة يدوية" value={stats.manualOut} sign="−" masked={masked} />
                  )}
                </div>
              </div>

              {/* Net hero */}
              <div className={cn(
                "rounded-2xl p-4 ring-1 ring-inset",
                stats.netCashDrawer < 0 ? "bg-danger/[0.06] ring-danger/20" : "bg-primary/[0.06] ring-primary/20",
              )}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> صافي رصيد الخزينة بالدرج
                </div>
                <div className={cn(
                  "mt-1.5 font-mono text-[clamp(1.5rem,4.5vw,1.9rem)] font-black leading-none",
                  stats.netCashDrawer < 0 ? "text-danger" : "text-primary",
                  masked && "privacy-blur",
                )}>
                  <CountUp value={stats.netCashDrawer} duration={900} format={money} />
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  التحصيلات − المصروفات − المرتجعات + حركات الخزينة
                </p>
              </div>

              {/* Current treasury balance */}
              {stats.cashboxBalance !== null && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hairline)] px-2.5 py-2">
                  <span className="text-[11px] text-muted-foreground">رصيد الخزينة الحالي (نظام الخزينة)</span>
                  <div className="flex items-center gap-2">
                    <strong className={cn("font-mono text-xs font-bold text-foreground/80", masked && "privacy-blur")}>
                      {money(stats.cashboxBalance)}
                    </strong>
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                      title="الرصيد الحالي ناقص صافي حركة هذه الفترة"
                    >
                      قبل الفترة ≈ {fmt(stats.cashboxBalance - stats.netCashDrawer)} ج.م
                    </span>
                  </div>
                </div>
              )}

              {/* Vouchers — informational only */}
              {(stats.periodVoucherReceipts > 0 || stats.periodVoucherPayments > 0) && (
                <div className="rounded-xl border border-dashed border-[var(--hairline)] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" />
                    سندات القبض والصرف
                    <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-semibold">
                      للعلم فقط — غير محتسبة
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-[11px] font-bold">
                    <span className={cn("text-success", masked && "privacy-blur")}>+{money(stats.periodVoucherReceipts)}</span>
                    <span className={cn("text-danger", masked && "privacy-blur")}>−{money(stats.periodVoucherPayments)}</span>
                  </div>
                </div>
              )}

              {/* Daily note */}
              <div className="border-t border-[var(--hairline)] pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-foreground">ملاحظة اليوم واليومية</h3>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-semibold",
                    noteStatus === "local" ? "text-warning" : "text-success",
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", noteStatus === "local" ? "bg-warning" : "bg-success")} />
                    {noteStatus === "local" ? "محفوظ محلياً فقط" : "محفوظ تلقائياً"}
                  </span>
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={5}
                  placeholder="سجّل ملاحظات اليوم، أحداث مهمة، أو جرد العهدة..."
                  className="mt-2 resize-none text-xs"
                />
                <Button size="sm" variant="secondary" onClick={saveNote} className="mt-2.5 w-full rounded-xl text-xs font-bold">
                  حفظ الآن
                </Button>
              </div>
            </BezelCard>
          </Reveal>
        </div>
      </div>

      <ViewInvoiceDialog
        inv={viewingInvoice}
        invoiceNo={viewingInvoice ? invoiceNumber(invoices, viewingInvoice.id) : undefined}
        customer={viewingInvoice ? customerById.get(viewingInvoice.customerId) ?? null : null}
        items={invoiceItems}
        payments={payments}
        onClose={() => setViewingInvoice(null)}
        onOpenReturn={(invoice) => { setViewingInvoice(null); setReturnInvoice(invoice); }}
        onOpenShare={(invoice) => { setViewingInvoice(null); setShareInvoice(invoice); }}
        onOpenCustomPrint={(invoice) => { setViewingInvoice(null); setCustomPrintInvoice(invoice); }}
        onOpenShipment={(invoice) => { setViewingInvoice(null); setShipmentInvoice(invoice); }}
        onClone={(invoice) => { setViewingInvoice(null); handleCloneInvoice(invoice); }}
        onEdit={(invoice) => { setViewingInvoice(null); setEditInvoice(invoice); }}
        onDirectPay={(invoice, amount) => {
          const customer = customerById.get(invoice.customerId);
          setViewingInvoice(null);
          setDirectPayState({
            invoiceId: invoice.id,
            max: Math.max(0, invoice.total - invoice.paid),
            invoiceNo: invoiceNumber(invoices, invoice.id),
            customerName: customer?.name ?? "",
            initialAmount: amount,
          });
        }}
      />
      <InvoiceReturnDialog
        inv={returnInvoice}
        invoiceNo={returnInvoice ? invoiceNumber(invoices, returnInvoice.id) : undefined}
        customer={returnInvoice ? customerById.get(returnInvoice.customerId) ?? null : null}
        items={invoiceItems}
        onClose={() => setReturnInvoice(null)}
      />
      <ShareInvoiceDialog
        inv={shareInvoice}
        invoiceNo={shareInvoice ? invoiceNumber(invoices, shareInvoice.id) : undefined}
        customer={shareInvoice ? customerById.get(shareInvoice.customerId) ?? null : null}
        items={invoiceItems}
        shopSettings={shopSettings}
        onClose={() => setShareInvoice(null)}
      />
      <CreateInvoiceShipmentDialog
        inv={shipmentInvoice}
        allInvoices={invoices}
        customer={shipmentInvoice ? customerById.get(shipmentInvoice.customerId) ?? null : null}
        items={shipmentInvoice ? invoiceItems.filter((item) => item.invoiceId === shipmentInvoice.id) : []}
        carriers={carriers}
        zones={zones}
        onClose={() => setShipmentInvoice(null)}
      />
      <InvoicePrintCustomizerDialog
        inv={customPrintInvoice}
        customer={customPrintInvoice ? customerById.get(customPrintInvoice.customerId) ?? null : null}
        items={customPrintInvoice ? invoiceItems.filter((item) => item.invoiceId === customPrintInvoice.id) : []}
        payments={payments}
        allInvoices={invoices}
        shopSettings={shopSettings}
        onClose={() => setCustomPrintInvoice(null)}
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
      <EditInvoiceDialog inv={editInvoice} invoiceNo={editInvoice ? invoiceNumber(invoices, editInvoice.id) : undefined} onClose={() => setEditInvoice(null)} />
      <ExpenseFormModal open={openExpense} onOpenChange={(v) => { setOpenExpense(v); if (!v) setEditingExpense(null); }} editing={editingExpense} defaultDate={from || todayISO()} defaultAccountId="acc-cash-main" />
    </>
  );
}
