import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useDB, fmt, useShopSettings, db } from "@/lib/store";
import { encodeExpenseNotes } from "@/lib/expenses-system";
import {
  TreasuryAccount,
  InternalTransfer,
  ManualCashTransaction,
  CashDenominationAudit,
  getTreasuryAccounts,
  addTreasuryAccount,
  updateTreasuryAccount,
  deleteTreasuryAccount,
  getManualTransactions,
  addManualTransaction,
  deleteManualTransaction,
  updateManualTransaction,
  getInternalTransfers,
  createInternalTransfer,
  deleteInternalTransfer,
  getDenominationAudits,
  createDenominationAudit,
  calculateDenominationTotal,
  calculateAccountBalance,
  getUnifiedCashLedger,
  printCashStatementPdf,
  CashTransactionUnified,
} from "@/lib/cashbox-system";

interface CashboxContextValue {
  invoices: any[];
  expenses: any[];
  payments: any[];
  loading: boolean;
  cur: string;
  shopSettings: any;
  activeTab: string;
  setActiveTab: (v: string) => void;
  accounts: TreasuryAccount[];
  manualTxs: ManualCashTransaction[];
  transfers: InternalTransfer[];
  audits: CashDenominationAudit[];
  selectedAccountId: string;
  setSelectedAccountId: (v: string) => void;
  dateRangeFilter: "all" | "today" | "week" | "month";
  setDateRangeFilter: (v: "all" | "today" | "week" | "month") => void;
  typeFilter: "all" | "in" | "out" | "transfer";
  setTypeFilter: (v: "all" | "in" | "out" | "transfer") => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  trendMode: "daily" | "weekly" | "monthly";
  setTrendMode: (v: "daily" | "weekly" | "monthly") => void;
  accountBalances: Record<string, { initial: number; inflows: number; outflows: number; currentBalance: number }>;
  totalLiquidity: number;
  rawLedger: CashTransactionUnified[];
  filteredLedger: CashTransactionUnified[];
  periodStats: { inflow: number; outflow: number; net: number };
  expenseChartData: { name: string; value: number; color: string }[];
  inflowChartData: { name: string; value: number; color: string }[];
  cashFlowTrendData: { dateLabel: string; in: number; out: number }[];
  refreshAll: () => void;
  resetManualForm: () => void;
  openEditManualTx: (rawId: string) => void;
  handleSaveManualTx: (e: React.FormEvent) => void;
  handleCreateTransfer: (e: React.FormEvent) => void;
  handleSaveAudit: () => void;
  handleCreateAccount: (e: React.FormEvent) => void;
  handlePrintStatement: () => void;
  isManualTxOpen: boolean;
  setIsManualTxOpen: (v: boolean) => void;
  manualTxType: "in" | "out";
  setManualTxType: (v: "in" | "out") => void;
  manualAmount: string;
  setManualAmount: (v: string) => void;
  manualTitle: string;
  setManualTitle: (v: string) => void;
  manualCategory: string;
  setManualCategory: (v: string) => void;
  manualAccountId: string;
  setManualAccountId: (v: string) => void;
  manualNotes: string;
  setManualNotes: (v: string) => void;
  manualDate: string;
  setManualDate: (v: string) => void;
  editingTxId: string | null;
  setEditingTxId: (v: string | null) => void;
  isTransferOpen: boolean;
  setIsTransferOpen: (v: boolean) => void;
  transferFrom: string;
  setTransferFrom: (v: string) => void;
  transferTo: string;
  setTransferTo: (v: string) => void;
  transferAmount: string;
  setTransferAmount: (v: string) => void;
  transferFee: string;
  setTransferFee: (v: string) => void;
  transferNotes: string;
  setTransferNotes: (v: string) => void;
  isAuditModalOpen: boolean;
  setIsAuditModalOpen: (v: boolean) => void;
  auditAccountId: string;
  setAuditAccountId: (v: string) => void;
  denoms: { d200: number; d100: number; d50: number; d20: number; d10: number; d5: number; coins: number };
  setDenoms: React.Dispatch<React.SetStateAction<{ d200: number; d100: number; d50: number; d20: number; d10: number; d5: number; coins: number }>>;
  auditVarianceReason: string;
  setAuditVarianceReason: (v: string) => void;
  auditNotes: string;
  setAuditNotes: (v: string) => void;
  auditCashier: string;
  setAuditCashier: (v: string) => void;
  currentAuditTotal: number;
  currentExpectedCash: number;
  currentVariance: number;
  isAccountManageOpen: boolean;
  setIsAccountManageOpen: (v: boolean) => void;
  newAccName: string;
  setNewAccName: (v: string) => void;
  newAccType: TreasuryAccount["type"];
  setNewAccType: (v: TreasuryAccount["type"]) => void;
  newAccInitial: string;
  setNewAccInitial: (v: string) => void;
  newAccNumber: string;
  setNewAccNumber: (v: string) => void;
  newAccBank: string;
  setNewAccBank: (v: string) => void;
  newAccColor: string;
  setNewAccColor: (v: string) => void;
}

const CashboxContext = createContext<CashboxContextValue | null>(null);

export function useCashbox() {
  const ctx = useContext(CashboxContext);
  if (!ctx) throw new Error("useCashbox must be used within CashboxProvider");
  return ctx;
}

export function CashboxProvider({ children }: { children: ReactNode }) {
  const { invoices, expenses, payments, loading } = useDB();
  const { settings: shopSettings } = useShopSettings();
  const cur = shopSettings.currency || "ج.م";

  const [activeTab, setActiveTab] = useState("overview");

  const [accounts, setAccounts] = useState<TreasuryAccount[]>(getTreasuryAccounts());
  const [manualTxs, setManualTxs] = useState<ManualCashTransaction[]>(getManualTransactions());
  const [transfers, setTransfers] = useState<InternalTransfer[]>(getInternalTransfers());
  const [audits, setAudits] = useState<CashDenominationAudit[]>(getDenominationAudits());

  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "week" | "month">("month");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out" | "transfer">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isManualTxOpen, setIsManualTxOpen] = useState(false);
  const [manualTxType, setManualTxType] = useState<"in" | "out">("in");
  const [manualAmount, setManualAmount] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("إيراد إضافي");
  const [manualAccountId, setManualAccountId] = useState("acc-cash-main");
  const [manualNotes, setManualNotes] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const [trendMode, setTrendMode] = useState<"daily" | "weekly" | "monthly">("daily");

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState("acc-cash-main");
  const [transferTo, setTransferTo] = useState("acc-vodafone-cash");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFee, setTransferFee] = useState("0");
  const [transferNotes, setTransferNotes] = useState("");

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditAccountId, setAuditAccountId] = useState("acc-cash-main");
  const [denoms, setDenoms] = useState({
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    d5: 0,
    coins: 0,
  });
  const [auditVarianceReason, setAuditVarianceReason] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [auditCashier, setAuditCashier] = useState("أمين الخزينة");

  const [isAccountManageOpen, setIsAccountManageOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<TreasuryAccount["type"]>("cash");
  const [newAccInitial, setNewAccInitial] = useState("0");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccColor, setNewAccColor] = useState("emerald");

  const refreshAll = () => {
    setAccounts(getTreasuryAccounts());
    setManualTxs(getManualTransactions());
    setTransfers(getInternalTransfers());
    setAudits(getDenominationAudits());
  };

  useEffect(() => {
    const handleUpdate = () => refreshAll();
    window.addEventListener("segilly_cashbox_data_updated", handleUpdate);
    return () => window.removeEventListener("segilly_cashbox_data_updated", handleUpdate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/cashbox-sync")
      .then((m) => m.pullCashboxFromCloud())
      .then(() => {
        if (!cancelled) refreshAll();
      })
      .catch((e) => console.error("Cashbox cloud pull failed:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const accountBalances = useMemo(() => {
    const map: Record<string, { initial: number; inflows: number; outflows: number; currentBalance: number }> = {};
    accounts.forEach((acc) => {
      map[acc.id] = calculateAccountBalance(acc, invoices, payments, expenses, manualTxs, transfers);
    });
    return map;
  }, [accounts, invoices, payments, expenses, manualTxs, transfers]);

  const totalLiquidity = useMemo(() => {
    let total = 0;
    Object.values(accountBalances).forEach((b: { currentBalance: number }) => {
      total += b.currentBalance;
    });
    return total;
  }, [accountBalances]);

  const rawLedger = useMemo(() => {
    return getUnifiedCashLedger(invoices, payments, expenses, manualTxs, transfers, selectedAccountId);
  }, [invoices, payments, expenses, manualTxs, transfers, selectedAccountId]);

  const filteredLedger = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return rawLedger.filter((tx) => {
      if (typeFilter === "in" && tx.type !== "in") return false;
      if (typeFilter === "out" && tx.type !== "out") return false;
      if (typeFilter === "transfer" && !tx.source.startsWith("transfer")) return false;

      const txDate = new Date(tx.date);
      if (dateRangeFilter === "today") {
        if (tx.date.split("T")[0] !== todayStr) return false;
      } else if (dateRangeFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (txDate < weekAgo) return false;
      } else if (dateRangeFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (txDate < monthAgo) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          tx.title.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          String(tx.amount).includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [rawLedger, typeFilter, dateRangeFilter, searchQuery]);

  const periodStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredLedger.forEach((tx) => {
      if (tx.type === "in") inflow += tx.amount;
      else outflow += tx.amount;
    });
    return {
      inflow,
      outflow,
      net: inflow - outflow,
    };
  }, [filteredLedger]);

  const expenseChartData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "عام";
      map[cat] = (map[cat] || 0) + e.amount;
    });
    manualTxs
      .filter((t) => t.type === "out")
      .forEach((t) => {
        const cat = t.category || "سحب يدوي";
        map[cat] = (map[cat] || 0) + t.amount;
      });

    const colors = ["#ef4444", "#f97316", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280"];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
  }, [expenses, manualTxs]);

  const inflowChartData = useMemo(() => {
    let downPayments = 0;
    let installments = 0;
    let manualInflows = 0;
    let transferInflows = 0;

    invoices.forEach((i) => (downPayments += i.downPayment || 0));
    payments.forEach((p) => (installments += p.amount || 0));
    manualTxs.filter((t) => t.type === "in").forEach((t) => (manualInflows += t.amount || 0));
    transfers.forEach((t) => (transferInflows += t.amount || 0));

    return [
      { name: "مقدمات ومبيعات كاش", value: downPayments, color: "#10b981" },
      { name: "تحصيلات أقساط", value: installments, color: "#06b6d4" },
      { name: "إيداعات يدوية واستثمارات", value: manualInflows, color: "#8b5cf6" },
      { name: "تحويلات واردة", value: transferInflows, color: "#f59e0b" },
    ].filter((i) => i.value > 0);
  }, [invoices, payments, manualTxs, transfers]);

  const cashFlowTrendData = useMemo(() => {
    const buckets: Record<string, { dateLabel: string; in: number; out: number }> = {};
    const now = new Date();

    const keyOf = (d: Date) => {
      if (trendMode === "daily") return d.toISOString().split("T")[0];
      if (trendMode === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
      return start.toISOString().split("T")[0];
    };

    const labelOf = (d: Date) => {
      if (trendMode === "daily") return d.toLocaleDateString("ar-EG", { weekday: "short" });
      if (trendMode === "monthly") return d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
      return `أسبوع ${d.getDate()}/${d.getMonth() + 1}`;
    };

    const periods = trendMode === "daily" ? 7 : trendMode === "weekly" ? 8 : 6;

    for (let i = periods - 1; i >= 0; i--) {
      const d = new Date(now);
      if (trendMode === "daily") d.setDate(d.getDate() - i);
      else if (trendMode === "weekly") d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      const k = keyOf(d);
      if (!buckets[k]) buckets[k] = { dateLabel: labelOf(d), in: 0, out: 0 };
    }

    rawLedger.forEach((tx) => {
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;
      const k = keyOf(d);
      if (buckets[k]) {
        if (tx.type === "in") buckets[k].in += tx.amount;
        else buckets[k].out += tx.amount;
      }
    });

    return Object.values(buckets);
  }, [rawLedger, trendMode]);

  const resetManualForm = () => {
    setEditingTxId(null);
    setManualAmount("");
    setManualTitle("");
    setManualNotes("");
    setManualDate(new Date().toISOString().split("T")[0]);
  };

  const openEditManualTx = (rawId: string) => {
    const tx = manualTxs.find((t) => t.id === rawId);
    if (!tx) return;
    setEditingTxId(tx.id);
    setManualTxType(tx.type);
    setManualCategory(tx.category);
    setManualAccountId(tx.accountId);
    setManualAmount(String(tx.amount));
    setManualTitle(tx.title);
    setManualNotes(tx.notes || "");
    setManualDate((tx.date || tx.createdAt).split("T")[0]);
    setIsManualTxOpen(true);
  };

  const handleSaveManualTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال مبلغ مالي صحيح");
      return;
    }
    if (!manualTitle.trim()) {
      toast.error("يرجى إدخال وصف أو بيان المعاملة");
      return;
    }

    const payload = {
      accountId: manualAccountId,
      type: manualTxType,
      category: manualCategory,
      amount: amt,
      date: manualDate,
      title: manualTitle.trim(),
      notes: manualNotes.trim() || undefined,
      performedBy: "المسؤول المالي",
    };

    if (editingTxId) {
      updateManualTransaction(editingTxId, payload);
      toast.success(`تم تعديل الحركة اليدوية بنجاح (${fmt(amt)} ${cur})`);
    } else {
      addManualTransaction(payload);
      toast.success(`تم تسجيل حركة ${manualTxType === "in" ? "الإيداع" : "السحب"} بمبلغ ${fmt(amt)} ${cur} بنجاح`);
    }

    setIsManualTxOpen(false);
    resetManualForm();
    refreshAll();
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    const fee = parseFloat(transferFee) || 0;
    if (isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال مبلغ تحويل صحيح");
      return;
    }
    if (transferFrom === transferTo) {
      toast.error("لا يمكن التحويل لنفس الحساب!");
      return;
    }

    const srcBal = accountBalances[transferFrom]?.currentBalance || 0;
    if (amt + fee > srcBal) {
      toast.warning("تنبيه: رصيد حساب المصدر الحالي أقل من المبلغ والعمولة!");
    }

    const today = new Date().toISOString().split("T")[0];
    let feeRecorded = false;

    if (fee > 0) {
      const fromName = accounts.find((a) => a.id === transferFrom)?.name || "الخزينة";
      const toName = accounts.find((a) => a.id === transferTo)?.name || "حساب آخر";
      try {
        await db.addExpense({
          amount: fee,
          category: "other",
          expenseDate: today,
          notes: encodeExpenseNotes(`عمولة تحويل داخلي من ${fromName} إلى ${toName}`, {
            accountId: transferFrom,
            accountName: fromName,
          }),
        });
        feeRecorded = true;
      } catch {
        toast.error("تعذّر تسجيل عمولة التحويل كمصروف، تم حفظ التحويل فقط");
      }
    }

    createInternalTransfer({
      fromAccountId: transferFrom,
      toAccountId: transferTo,
      amount: amt,
      fee,
      feeRecordedAsExpense: feeRecorded,
      date: today,
      notes: transferNotes.trim() || undefined,
      performedBy: "المسؤول المالي",
    });

    toast.success(
      fee > 0 && feeRecorded
        ? `تم تحويل ${fmt(amt)} ${cur} وتسجيل عمولة ${fmt(fee)} ${cur} كمصروف`
        : `تم تحويل ${fmt(amt)} ${cur} بنجاح`
    );
    setIsTransferOpen(false);
    setTransferAmount("");
    setTransferFee("0");
    setTransferNotes("");
    refreshAll();
  };

  const handleSaveAudit = () => {
    const totalActual = calculateDenominationTotal(denoms);
    const expected = accountBalances[auditAccountId]?.currentBalance || 0;
    const variance = Math.round((totalActual - expected) * 100) / 100;

    const audit = createDenominationAudit({
      accountId: auditAccountId,
      countedAt: new Date().toISOString(),
      countedBy: auditCashier,
      denominations: denoms,
      totalActualCash: totalActual,
      systemExpectedCash: expected,
      variance,
      varianceReason: auditVarianceReason.trim() || undefined,
      notes: auditNotes.trim() || undefined,
      status: Math.abs(variance) > 5 ? "flagged" : "settled",
    });

    if (Math.abs(variance) >= 0.01) {
      addManualTransaction({
        accountId: auditAccountId,
        type: variance > 0 ? "in" : "out",
        category: variance > 0 ? "تسوية زيادة جرد" : "تسوية عجز",
        amount: Math.abs(variance),
        date: new Date().toISOString().split("T")[0],
        title: `تسوية فرق جرد ${audit.auditNumber} (${variance > 0 ? "زيادة" : "عجز"})`,
        notes: auditVarianceReason.trim() || "تسوية تلقائية بعد اعتماد محضر الجرد",
        performedBy: auditCashier,
      });
      toast.success(
        `تم اعتماد الجرد وتسجيل حركة تسوية ${variance > 0 ? "زيادة" : "عجز"} بمبلغ ${fmt(Math.abs(variance))} ${cur}`
      );
    } else {
      toast.success(`تم حفظ واعتماد محضر جرد الخزينة مطابقاً (${fmt(totalActual)} ${cur})`);
    }

    setIsAuditModalOpen(false);
    setDenoms({ d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 0 });
    setAuditVarianceReason("");
    setAuditNotes("");
    refreshAll();
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      toast.error("يرجى إدخال اسم الحساب أو الخزينة");
      return;
    }
    const initial = parseFloat(newAccInitial) || 0;

    addTreasuryAccount({
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: initial,
      accountNumber: newAccNumber.trim() || undefined,
      bankName: newAccBank.trim() || undefined,
      color: newAccColor,
      active: true,
    });

    toast.success("تمت إضافة الخزينة / الحساب المالي الجديد بنجاح");
    setIsAccountManageOpen(false);
    setNewAccName("");
    setNewAccInitial("0");
    setNewAccNumber("");
    setNewAccBank("");
    refreshAll();
  };

  const handlePrintStatement = () => {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    const accName = selectedAccountId === "all" ? "كافة الخزن والحسابات المجمعة" : acc?.name || "الخزينة";

    const rangeLabels: Record<string, string> = {
      all: "كامل الحركات المسجلة",
      today: "حركات اليوم فقط",
      week: "آخر 7 أيام",
      month: "آخر 30 يوماً",
    };

    printCashStatementPdf({
      transactions: filteredLedger,
      accountName: accName,
      totalInflow: periodStats.inflow,
      totalOutflow: periodStats.outflow,
      netBalance: periodStats.net,
      dateRangeLabel: rangeLabels[dateRangeFilter] || "مخصص",
      shopSettings,
    });
  };

  const currentAuditTotal = calculateDenominationTotal(denoms);
  const currentExpectedCash = accountBalances[auditAccountId]?.currentBalance || 0;
  const currentVariance = currentAuditTotal - currentExpectedCash;

  const value: CashboxContextValue = {
    invoices,
    expenses,
    payments,
    loading,
    cur,
    shopSettings,
    activeTab,
    setActiveTab,
    accounts,
    manualTxs,
    transfers,
    audits,
    selectedAccountId,
    setSelectedAccountId,
    dateRangeFilter,
    setDateRangeFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    trendMode,
    setTrendMode,
    accountBalances,
    totalLiquidity,
    rawLedger,
    filteredLedger,
    periodStats,
    expenseChartData,
    inflowChartData,
    cashFlowTrendData,
    refreshAll,
    resetManualForm,
    openEditManualTx,
    handleSaveManualTx,
    handleCreateTransfer,
    handleSaveAudit,
    handleCreateAccount,
    handlePrintStatement,
    isManualTxOpen,
    setIsManualTxOpen,
    manualTxType,
    setManualTxType,
    manualAmount,
    setManualAmount,
    manualTitle,
    setManualTitle,
    manualCategory,
    setManualCategory,
    manualAccountId,
    setManualAccountId,
    manualNotes,
    setManualNotes,
    manualDate,
    setManualDate,
    editingTxId,
    setEditingTxId,
    isTransferOpen,
    setIsTransferOpen,
    transferFrom,
    setTransferFrom,
    transferTo,
    setTransferTo,
    transferAmount,
    setTransferAmount,
    transferFee,
    setTransferFee,
    transferNotes,
    setTransferNotes,
    isAuditModalOpen,
    setIsAuditModalOpen,
    auditAccountId,
    setAuditAccountId,
    denoms,
    setDenoms,
    auditVarianceReason,
    setAuditVarianceReason,
    auditNotes,
    setAuditNotes,
    auditCashier,
    setAuditCashier,
    currentAuditTotal,
    currentExpectedCash,
    currentVariance,
    isAccountManageOpen,
    setIsAccountManageOpen,
    newAccName,
    setNewAccName,
    newAccType,
    setNewAccType,
    newAccInitial,
    setNewAccInitial,
    newAccNumber,
    setNewAccNumber,
    newAccBank,
    setNewAccBank,
    newAccColor,
    setNewAccColor,
  };

  return <CashboxContext.Provider value={value}>{children}</CashboxContext.Provider>;
}
