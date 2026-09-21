import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { usePrivacy } from "@/lib/privacy";
import {
  useDB,
  daysLate,
  fmt,
  customerBalance,
  expenseCategoryLabel,
  supplierBalance,
} from "@/lib/store";
import { roundCurrency } from "@/lib/financial-engine";
import {
  getTreasuryAccounts,
  getManualTransactions,
  getInternalTransfers,
  calculateAccountBalance,
} from "@/lib/cashbox-system";
import { runComprehensiveReconciliation } from "@/lib/reconciliation-engine";
import { exportExecutiveReport } from "@/lib/executive-report-pdf";
import {
  useDashboardLayout,
} from "@/components/DashboardCustomization";
import {
  getMyStorefront,
  getMyStoreOrders,
  type Storefront,
  type StoreOrder,
} from "@/lib/storefront";
import { EMERALD, WARNING, DANGER } from "./shared";
import type { TimeRange, TopProductsSort } from "./shared";

export interface DashboardContextValue {
  data: ReturnType<typeof useDB>;
  privacy: boolean;
  toggle: () => void;

  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
  topProductsSort: TopProductsSort;
  setTopProductsSort: (s: TopProductsSort) => void;
  customizationOpen: boolean;
  setCustomizationOpen: (o: boolean) => void;

  sections: ReturnType<typeof useDashboardLayout>["sections"];
  isVisible: ReturnType<typeof useDashboardLayout>["isVisible"];
  toggleSection: ReturnType<typeof useDashboardLayout>["toggleSection"];
  moveSection: ReturnType<typeof useDashboardLayout>["moveSection"];
  resetToDefault: ReturnType<typeof useDashboardLayout>["resetToDefault"];

  storefront: Storefront | null;
  storeOrders: StoreOrder[];
  storefrontLoading: boolean;
  storefrontError: string | null;
  setStorefrontLoadAttempt: React.Dispatch<React.SetStateAction<number>>;

  today: Date;
  rangeBounds: { start: Date; end: Date };
  isInRange: (d: Date | string) => boolean;
  rangeLabel: string;

  totalDebt: number;
  rangeCollected: number;
  inventoryStats: {
    totalCostValuation: number;
    totalSaleValuation: number;
    potentialMargin: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  treasuryLiquidityResult: { value: number | null; error: string | null };
  treasuryLiquidity: number | null;
  shippingStats: {
    activeCount: number;
    unsettledCount: number;
    pendingCodAmount: number;
  };
  reconciliationSummary: ReturnType<typeof runComprehensiveReconciliation>;
  topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
  netProfit: number;
  grossProfit: number;
  expensesTotal: number;
  cashPurchasesTotal: number;
  incompleteCostCount: number;
  storefrontStats: {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    storeRevenue: number;
    todayOrdersCount: number;
    todayRevenue: number;
  };
  activeCustomers: number;
  frozenCustomers: number;
  monthBuckets: {
    payments: number[];
    expenses: number[];
    cashPurchases: number[];
    debtTrend: number[];
    supplierTrend: number[];
    profitTrend: number[];
    customersTrend: number[];
  };
  expenseBreakdown: { name: string; value: number; color: string }[];
  totalRangeExpenses: number;
  trendData: { key: string; label: string; total: number | null; forecast: number | null }[];
  hasTrendData: boolean;
  statusData: { name: string; value: number; color: string }[];
  hasStatusData: boolean;
  dueToday: { inv: any; customer: any; due: number; late: number }[];
  totalDueToday: number;
  atRiskCustomers: { customer: any; balance: number; maxLate: number; overdueCount: number }[];
  insights: { text: string; tone: "success" | "warning" | "danger" | "info" }[];
  totalSupplierDebt: number;

  m: (s: string) => string;
  money: (n: number) => string;
  plain: (n: number) => string;
  handleExportExecutiveReport: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [topProductsSort, setTopProductsSort] = useState<TopProductsSort>("quantity");
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const { sections, isVisible, toggleSection, moveSection, resetToDefault } = useDashboardLayout();

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontError, setStorefrontError] = useState<string | null>(null);
  const [storefrontLoadAttempt, setStorefrontLoadAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadStoreStats = async () => {
      setStorefrontLoading(true);
      setStorefrontError(null);
      try {
        const shop = await getMyStorefront();
        if (!mounted) return;
        setStorefront(shop);
        if (shop) {
          const orders = await getMyStoreOrders(shop.id);
          if (mounted) setStoreOrders(orders);
        }
      } catch (error) {
        console.error("تعذر تحميل بيانات المتجر", error);
        if (mounted) setStorefrontError("تعذر تحميل بيانات المتجر الآن");
      } finally {
        if (mounted) setStorefrontLoading(false);
      }
    };
    loadStoreStats();
    return () => {
      mounted = false;
    };
  }, [storefrontLoadAttempt]);

  const m = (s: string) => (privacy ? "•••••" : s);

  const today = new Date();

  const rangeBounds = useMemo(() => {
    const now = new Date();
    if (timeRange === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { start, end: now };
    }
    if (timeRange === "7d") {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { start, end: now };
    }
    if (timeRange === "30d") {
      const start = new Date(now.getTime() - 30 * 86400000);
      return { start, end: now };
    }
    if (timeRange === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
    return { start: new Date(2000, 0, 1), end: now };
  }, [timeRange]);

  const isInRange = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= rangeBounds.start.getTime() && t <= rangeBounds.end.getTime();
  };

  const totalDebt =
    data.invoices.reduce((s, i) => s + (i.total - i.paid), 0) +
    data.customers.reduce((s, c) => s + (c.openingBalance || 0), 0);

  const rangeCollected = useMemo(() => {
    return data.payments
      .filter((p) => isInRange(p.paidAt))
      .reduce((s, p) => s + p.amount, 0);
  }, [data.payments, rangeBounds]);

  const inventoryStats = useMemo(() => {
    let totalCostValuation = 0;
    let totalSaleValuation = 0;
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of data.stockItems) {
      const qty = item.quantity || 0;
      const cost = item.lastUnitCost || 0;
      const price = item.salePrice || 0;
      const min = item.minStock ?? 5;

      totalUnits += qty;
      totalCostValuation += qty * cost;
      totalSaleValuation += qty * price;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= min) {
        lowStockCount++;
      }
    }

    return {
      totalCostValuation: roundCurrency(totalCostValuation),
      totalSaleValuation: roundCurrency(totalSaleValuation),
      potentialMargin: roundCurrency(totalSaleValuation - totalCostValuation),
      totalUnits,
      lowStockCount,
      outOfStockCount,
    };
  }, [data.stockItems]);

  const treasuryLiquidityResult = useMemo((): { value: number | null; error: string | null } => {
    try {
      const accounts = getTreasuryAccounts();
      const manualTxs = getManualTransactions();
      const transfers = getInternalTransfers();

      let total = 0;
      for (const acc of accounts) {
        const bal = calculateAccountBalance(
          acc,
          data.invoices,
          data.payments,
          data.expenses,
          manualTxs,
          transfers
        );
        total += bal.currentBalance;
      }
      return { value: roundCurrency(total), error: null };
    } catch (error) {
      console.error("تعذر التحقق من رصيد الخزينة", error);
      return { value: null, error: "تعذر التحقق من الرصيد" };
    }
  }, [data.invoices, data.payments, data.expenses]);
  const treasuryLiquidity = treasuryLiquidityResult.value;

  const shippingStats = useMemo(() => {
    const activeShipments = data.shipments.filter(
      (s) => s.status === "shipped" || s.status === "processing"
    );
    const deliveredUnsettled = data.shipments.filter(
      (s) => s.status === "delivered" && s.collectionStatus !== "settled"
    );
    const pendingCodAmount = deliveredUnsettled.reduce((s, sh) => s + (sh.codAmount || 0), 0);

    return {
      activeCount: activeShipments.length,
      unsettledCount: deliveredUnsettled.length,
      pendingCodAmount: roundCurrency(pendingCodAmount),
    };
  }, [data.shipments]);

  const reconciliationSummary = useMemo(() => {
    return runComprehensiveReconciliation(data, []);
  }, [data]);

  const topProducts = useMemo(() => {
    const salesMap = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>();

    for (const item of data.invoiceItems) {
      const inv = data.invoices.find((i) => i.id === item.invoiceId);
      if (!inv || inv.status === "cancelled" || !isInRange(inv.createdAt)) continue;

      const curr = salesMap.get(item.name) || {
        name: item.name,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };

      const q = item.quantity || 1;
      const revenue = q * (item.price || 0);
      const cost = item.cost ? q * item.cost : 0;
      const profit = revenue - cost;

      salesMap.set(item.name, {
        name: item.name,
        quantity: curr.quantity + q,
        revenue: curr.revenue + revenue,
        profit: curr.profit + profit,
      });
    }

    return Array.from(salesMap.values())
      .sort((a, b) => topProductsSort === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue)
      .slice(0, 5);
  }, [data.invoiceItems, data.invoices, rangeBounds, topProductsSort]);

  const { netProfit, grossProfit, expensesTotal, cashPurchasesTotal, incompleteCostCount } = useMemo(() => {
    const expenses = data.expenses
      .filter((e) => isInRange(e.expenseDate))
      .reduce((s, e) => s + e.amount, 0);

    const cashPurchases = data.purchases
      .filter((p) => p.paymentType === "cash" && isInRange(p.purchaseDate))
      .reduce((s, p) => s + p.total, 0);

    const rangeInvoices = data.invoices.filter((invoice) => {
      return invoice.status !== "cancelled" && isInRange(invoice.createdAt);
    });

    const invoiceIds = new Set(rangeInvoices.map((invoice) => invoice.id));
    const sales = rangeInvoices.reduce((sum, invoice) => sum + invoice.total - (invoice.taxAmount ?? 0), 0);
    const rangeItems = data.invoiceItems.filter((item) => invoiceIds.has(item.invoiceId));

    const itemsByInvoice = new Map<string, typeof rangeItems>();
    for (const item of rangeItems) {
      itemsByInvoice.set(item.invoiceId, [...(itemsByInvoice.get(item.invoiceId) ?? []), item]);
    }

    const incomplete = rangeInvoices.filter((invoice) => {
      const items = itemsByInvoice.get(invoice.id) ?? [];
      return items.length === 0 || items.some((item) => !Number.isFinite(item.cost) || item.cost <= 0);
    });

    const cogs = rangeItems
      .filter((item) => !incomplete.some((invoice) => invoice.id === item.invoiceId))
      .reduce((sum, item) => sum + item.cost * item.quantity, 0);

    const returns = data.returns
      .filter((item) => item.type === "sale" && isInRange(item.createdAt))
      .reduce((sum, item) => sum + item.totalAmount, 0);

    const gross = roundCurrency(sales - cogs - returns);

    return {
      netProfit: roundCurrency(gross - expenses - cashPurchases),
      grossProfit: gross,
      expensesTotal: expenses,
      cashPurchasesTotal: cashPurchases,
      incompleteCostCount: incomplete.length,
    };
  }, [data.expenses, data.purchases, data.invoices, data.invoiceItems, data.returns, rangeBounds]);

  const storefrontStats = useMemo(() => {
    const totalOrders = storeOrders.length;
    const pendingOrders = storeOrders.filter((o) => o.status === "submitted" || o.status === "under_review").length;
    const completedOrders = storeOrders.filter((o) => o.status === "delivered" || o.status === "shipped").length;
    const storeRevenue = storeOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const todayOrders = storeOrders.filter((o) => {
      const d = new Date(o.created_at);
      return d.toDateString() === today.toDateString();
    });
    const todayRevenue = todayOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      storeRevenue,
      todayOrdersCount: todayOrders.length,
      todayRevenue,
    };
  }, [storeOrders, today]);

  const rangeLabel = {
    today: "اليوم",
    "7d": "آخر 7 أيام",
    "30d": "آخر 30 يوم",
    month: "هذا الشهر",
    all: "كافة السجلات",
  }[timeRange];

  const totalSupplierDebt = data.suppliers.reduce(
    (s, sup) =>
      s +
      Math.max(
        0,
        supplierBalance(data.purchases, data.supplierPayments, sup.id, sup.openingBalance),
      ),
    0,
  );

  const money = (n: number) => (privacy ? "•••••" : `${fmt(n)} ج.م`);
  const plain = (n: number) => (privacy ? "•••" : fmt(n));

  const activeCustomers = data.customers.filter((c) => !c.frozen).length;
  const frozenCustomers = data.customers.length - activeCustomers;

  const monthBuckets = useMemo(() => {
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const idxOf = (iso: string) => {
      const d = new Date(iso);
      return keys.indexOf(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };
    const zero = () => keys.map(() => 0);

    const payments = zero();
    for (const p of data.payments) {
      const i = idxOf(p.paidAt);
      if (i >= 0) payments[i] += p.amount;
    }
    const invoiced = zero();
    const invoiceIdsByMonth = keys.map(() => new Set<string>());
    for (const inv of data.invoices) {
      const i = idxOf(inv.createdAt);
      if (i >= 0 && inv.status !== "cancelled") {
        invoiced[i] += inv.total - (inv.taxAmount ?? 0);
        invoiceIdsByMonth[i].add(inv.id);
      }
    }
    const expenses = zero();
    for (const e of data.expenses) {
      const i = idxOf(e.expenseDate);
      if (i >= 0) expenses[i] += e.amount;
    }
    const cashPurchases = zero();
    const creditPurchases = zero();
    for (const p of data.purchases) {
      const i = idxOf(p.purchaseDate);
      if (i < 0) continue;
      if (p.paymentType === "cash") cashPurchases[i] += p.total;
      else creditPurchases[i] += p.total;
    }
    const supplierPaid = zero();
    for (const sp of data.supplierPayments) {
      const i = idxOf(sp.paidAt);
      if (i >= 0) supplierPaid[i] += sp.amount;
    }
    const joins = zero();
    for (const c of data.customers) {
      const i = idxOf(c.joiningDate || c.createdAt);
      if (i >= 0) joins[i] += 1;
    }

    const debtTrend = keys.map((key) => {
      const [year, month] = key.split("-").map(Number);
      const end = new Date(year, month + 1, 1).getTime();
      const opening = data.customers
        .filter((customer) => new Date(customer.createdAt).getTime() < end)
        .reduce((sum, customer) => sum + (customer.openingBalance || 0), 0);
      const outstanding = data.invoices
        .filter((invoice) => invoice.status !== "cancelled" && new Date(invoice.createdAt).getTime() < end)
        .reduce((sum, invoice) => {
          const paidByEnd = data.payments
            .filter((payment) => payment.invoiceId === invoice.id && new Date(payment.paidAt).getTime() < end)
            .reduce((paid, payment) => paid + payment.amount, 0);
          return sum + Math.max(0, invoice.total - (invoice.downPayment || 0) - paidByEnd);
        }, 0);
      return roundCurrency(opening + outstanding);
    });

    const supplierRunning: number[] = [];
    let sacc = 0;
    for (let i = 0; i < keys.length; i++) {
      sacc += creditPurchases[i] - supplierPaid[i];
      supplierRunning.push(Math.max(0, sacc));
    }

    const cogs = zero();
    for (let i = 0; i < keys.length; i++) {
      const invoiceIds = invoiceIdsByMonth[i];
      const monthItems = data.invoiceItems.filter((item) => invoiceIds.has(item.invoiceId));
      const incompleteIds = new Set(
        [...invoiceIds].filter((invoiceId) => {
          const items = monthItems.filter((item) => item.invoiceId === invoiceId);
          return items.length === 0 || items.some((item) => !Number.isFinite(item.cost) || item.cost <= 0);
        }),
      );
      cogs[i] = monthItems
        .filter((item) => !incompleteIds.has(item.invoiceId))
        .reduce((sum, item) => sum + item.cost * item.quantity, 0);
    }
    const returned = zero();
    for (const record of data.returns) {
      if (record.type !== "sale") continue;
      const i = idxOf(record.createdAt);
      if (i >= 0) returned[i] += record.totalAmount;
    }
    const profitTrend = keys.map((_, i) =>
      roundCurrency(invoiced[i] - cogs[i] - returned[i] - expenses[i] - cashPurchases[i]),
    );

    const customersRunning: number[] = [];
    let cacc = Math.max(0, data.customers.length - joins.reduce((s, x) => s + x, 0));
    for (const j of joins) {
      cacc += j;
      customersRunning.push(cacc);
    }

    return {
      payments,
      expenses,
      cashPurchases,
      debtTrend,
      supplierTrend: supplierRunning,
      profitTrend,
      customersTrend: customersRunning,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.payments,
    data.invoices,
    data.expenses,
    data.purchases,
    data.supplierPayments,
    data.customers,
    data.invoiceItems,
    data.returns,
  ]);

  const expenseBreakdown = useMemo(() => {
    const by = new Map<string, number>();
    for (const e of data.expenses) {
      if (!isInRange(e.expenseDate)) continue;
      by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
    }
    const colors = [EMERALD, WARNING, DANGER, "oklch(0.6 0.15 240)", "oklch(0.7 0.18 320)"];
    return Array.from(by.entries()).map(([cat, value], i) => ({
      name: expenseCategoryLabel(cat as never),
      value,
      color: colors[i % colors.length],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses, rangeBounds]);
  const totalRangeExpenses = expenseBreakdown.reduce((s, x) => s + x.value, 0);

  const trendData = useMemo(() => {
    const months: { key: string; label: string; total: number | null; forecast: number | null }[] =
      [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      months.push({ key, label, total: 0, forecast: null });
    }
    for (const p of data.payments) {
      const d = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const slot = months.find((mm) => mm.key === key);
      if (slot) slot.total = (slot.total ?? 0) + p.amount;
    }

    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    let expected = 0;
    for (const inv of data.invoices) {
      const remaining = inv.total - inv.paid;
      if (remaining <= 0) continue;
      const due = new Date(inv.firstDueDate);
      const sameMonth =
        due.getFullYear() === next.getFullYear() && due.getMonth() === next.getMonth();
      const overdue = due < today;
      if (sameMonth || overdue) {
        expected += Math.min(inv.monthlyInstallment || remaining, remaining);
      }
    }
    const avg = months.reduce((s, mm) => s + (mm.total ?? 0), 0) / 6;
    const forecast = Math.round(expected * 0.85 + avg * 0.15);
    const lastReal = months[months.length - 1];
    lastReal.forecast = lastReal.total;
    months.push({
      key: nextKey,
      label: next.toLocaleDateString("en-US", { month: "short" }) + " (متوقع)",
      total: null,
      forecast,
    });
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.payments, data.invoices]);

  const hasTrendData = data.payments.length > 0;

  const statusData = useMemo(() => {
    let committed = 0,
      neutral = 0,
      defaulter = 0;
    for (const c of data.customers) {
      if (c.status === "committed") committed++;
      else if (c.status === "defaulter") defaulter++;
      else neutral++;
    }
    return [
      { name: "ملتزم", value: committed, color: EMERALD },
      { name: "متأخر", value: neutral, color: WARNING },
      { name: "متعثر", value: defaulter, color: DANGER },
    ];
  }, [data.customers]);

  const hasStatusData = data.customers.length > 0;

  const dueToday = useMemo(() => {
    const dom = today.getDate();
    return data.invoices
      .filter((i) => i.total > i.paid)
      .filter((i) => {
        const c = data.customers.find((cc) => cc.id === i.customerId);
        if (!c) return false;
        return c.dueDay === dom && daysLate(i) === 0;
      })
      .map((i) => {
        const c = data.customers.find((cc) => cc.id === i.customerId);
        const remaining = i.total - i.paid;
        const due = Math.min(i.monthlyInstallment || remaining, remaining);
        return { inv: i, customer: c, due, late: daysLate(i) };
      })
      .sort((a, b) => a.customer?.name.localeCompare(b.customer?.name ?? "") ?? 0)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.invoices, data.customers]);

  const totalDueToday = dueToday.reduce((s, x) => s + x.due, 0);

  const atRiskCustomers = useMemo(() => {
    return data.customers
      .map((c) => {
        const bal = customerBalance(data.invoices, c.id, c.openingBalance);
        const overdueInvs = data.invoices.filter((i) => i.customerId === c.id && daysLate(i) > 0);
        const maxLate = overdueInvs.reduce((mx, i) => Math.max(mx, daysLate(i)), 0);
        return { customer: c, balance: bal, maxLate, overdueCount: overdueInvs.length };
      })
      .filter((x) => x.maxLate > 0 && x.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [data.customers, data.invoices]);

  const insights = useMemo(() => {
    const out: { text: string; tone: "success" | "warning" | "danger" | "info" }[] = [];
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const sumRange = (from: number, to: number) =>
      data.payments
        .filter((p) => {
          const t = new Date(p.paidAt).getTime();
          return t >= from && t < to;
        })
        .reduce((s, p) => s + p.amount, 0);
    const thisWeek = sumRange(now - weekMs, now);
    const lastWeek = sumRange(now - 2 * weekMs, now - weekMs);
    if (lastWeek > 0) {
      const diff = ((thisWeek - lastWeek) / lastWeek) * 100;
      if (Math.abs(diff) >= 5) {
        out.push({
          text:
            diff > 0
              ? `التحصيلات ارتفعت ${Math.abs(diff).toFixed(1)}% مقارنة بالأسبوع السابق`
              : `التحصيلات انخفضت ${Math.abs(diff).toFixed(1)}% مقارنة بالأسبوع السابق`,
          tone: diff > 0 ? "success" : "warning",
        });
      }
    } else if (thisWeek > 0) {
      out.push({ text: `تم تحصيل ${fmt(thisWeek)} ج.م خلال آخر 7 أيام`, tone: "success" });
    }

    if (inventoryStats.lowStockCount > 0 || inventoryStats.outOfStockCount > 0) {
      out.push({
        text: `المخزون: ${inventoryStats.outOfStockCount} صنف نفد رصيده بالكامل، و${inventoryStats.lowStockCount} صنف قارب على النفاد`,
        tone: "warning",
      });
    }

    if (shippingStats.unsettledCount > 0) {
      out.push({
        text: `شحن COD: يوجد ${shippingStats.unsettledCount} شحنة مسلّمة بإجمالي ${fmt(shippingStats.pendingCodAmount)} ج.م تنتظر التوريد للخزينة`,
        tone: "info",
      });
    }

    if (reconciliationSummary.healthScore < 90) {
      out.push({
        text: `الرقابة المالية: مؤشر الصحة ${reconciliationSummary.healthScore}% — يوجد ${reconciliationSummary.criticalCount + reconciliationSummary.warningCount} ملاحظة تدقيقية تحتاج مراجعة`,
        tone: reconciliationSummary.healthScore < 75 ? "danger" : "warning",
      });
    }

    const dueTodayCount = dueToday.length;
    if (dueTodayCount > 0) {
      out.push({ text: `${dueTodayCount} فاتورة تستحق التحصيل اليوم حسب الموعد المحدد`, tone: "warning" });
    }

    const defaulters = data.customers.filter((c) => c.status === "defaulter").length;
    if (defaulters > 0) {
      out.push({ text: `يوجد ${defaulters} عميل في حالة تعثر — راجع قائمة المتابعة والتحصيل`, tone: "danger" });
    }

    if (out.length === 0) {
      out.push({ text: "جميع العمليات والمؤشرات متطابقة ومستقرة تماماً", tone: "success" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.payments, data.invoices, data.customers, atRiskCustomers, inventoryStats, shippingStats, reconciliationSummary, dueToday]);

  const handleExportExecutiveReport = () => {
    if (treasuryLiquidity === null) {
      toast.error("تعذر تصدير التقرير قبل التحقق من رصيد الخزينة");
      return;
    }
    const totalSalesRevenue = data.invoices
      .filter((i) => (i as any).status !== "cancelled" && isInRange(i.createdAt))
      .reduce((s, i) => s + (i.total || 0), 0);

    const totalCollections = data.payments
      .filter((p) => isInRange(p.paidAt))
      .reduce((s, p) => s + (p.amount || 0), 0);

    exportExecutiveReport({
      timeRangeLabel: rangeLabel,
      generatedAt: new Date(),
      treasuryLiquidity,
      totalCustomerDebt: totalDebt,
      totalSupplierDebt,
      collectedAmount: totalCollections,
      salesAmount: totalSalesRevenue,
      expensesAmount: expensesTotal,
      netProfit,
      inventoryCostValuation: inventoryStats.totalCostValuation,
      inventorySaleValuation: inventoryStats.totalSaleValuation,
      lowStockCount: inventoryStats.lowStockCount,
      outOfStockCount: inventoryStats.outOfStockCount,
      pendingCodAmount: shippingStats.pendingCodAmount,
      unsettledShipmentsCount: shippingStats.unsettledCount,
      healthScore: reconciliationSummary.healthScore,
      auditFindingsCount: reconciliationSummary.criticalCount + reconciliationSummary.warningCount,
      storefrontOrdersCount: storefrontStats.todayOrdersCount,
      storefrontNewRevenue: storefrontStats.todayRevenue,
      topProducts: topProducts.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
        profit: p.profit,
      })),
      dueTodayList: dueToday.slice(0, 10).map((d) => ({
        customerName: d.customer?.name || "عميل غير محدد",
        amount: d.due,
        phone: d.customer?.phone || "",
        isLate: d.late > 0,
      })),
      atRiskCustomers: atRiskCustomers.slice(0, 10).map((c) => ({
        customerName: c.customer.name,
        phone: c.customer.phone || "",
        balance: c.balance,
        daysLate: c.maxLate,
      })),
    });
  };

  const value: DashboardContextValue = {
    data,
    privacy,
    toggle,
    timeRange,
    setTimeRange,
    topProductsSort,
    setTopProductsSort,
    customizationOpen,
    setCustomizationOpen,
    sections,
    isVisible,
    toggleSection,
    moveSection,
    resetToDefault,
    storefront,
    storeOrders,
    storefrontLoading,
    storefrontError,
    setStorefrontLoadAttempt,
    today,
    rangeBounds,
    isInRange,
    rangeLabel,
    totalDebt,
    rangeCollected,
    inventoryStats,
    treasuryLiquidityResult,
    treasuryLiquidity,
    shippingStats,
    reconciliationSummary,
    topProducts,
    netProfit,
    grossProfit,
    expensesTotal,
    cashPurchasesTotal,
    incompleteCostCount,
    storefrontStats,
    activeCustomers,
    frozenCustomers,
    monthBuckets,
    expenseBreakdown,
    totalRangeExpenses,
    trendData,
    hasTrendData,
    statusData,
    hasStatusData,
    dueToday,
    totalDueToday,
    atRiskCustomers,
    insights,
    totalSupplierDebt,
    m,
    money,
    plain,
    handleExportExecutiveReport,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
