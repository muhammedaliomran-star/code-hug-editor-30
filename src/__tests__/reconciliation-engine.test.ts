import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runComprehensiveReconciliation,
  type ReconciliationSummary,
} from "@/lib/reconciliation-engine";
import type {
  DBState,
  Customer,
  Invoice,
  Payment,
  Supplier,
  Purchase,
  SupplierPayment,
  StockItem,
  Shipment,
  ReturnRecord,
  ReturnItem,
  InvoiceItem,
} from "@/lib/store";

// Mock supabase and toast to avoid runtime errors
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/shipping-finance", () => ({
  recordCarrierSettlementInTreasury: vi.fn().mockReturnValue("account"),
}));

// ──────────────────────────────────────────
// Helper to create a minimal empty DBState
// ──────────────────────────────────────────
function emptyDBState(): DBState {
  return {
    customers: [],
    invoices: [],
    payments: [],
    expenses: [],
    invoiceItems: [],
    suppliers: [],
    purchases: [],
    purchaseItems: [],
    supplierPayments: [],
    stockItems: [],
    warehouseItems: [],
    returns: [],
    returnItems: [],
    branches: [],
    paymentVouchers: [],
    carriers: [],
    zones: [],
    shipments: [],
    loading: false,
  } as unknown as DBState;
}

// ──────────────────────────────────────────
// Factories
// ──────────────────────────────────────────
function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    name: "محمد أحمد",
    phone: "01012345678",
    rating: 5,
    status: "committed",
    customerType: "installment",
    notes: null,
    frozen: false,
    address: null,
    joiningDate: "2026-01-01",
    creditLimit: 0,
    dueDay: 1,
    openingBalance: 0,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    customerId: "cust-1",
    total: 10000,
    downPayment: 2000,
    monthlyInstallment: 2000,
    firstDueDate: "2026-01-15",
    paid: 2000,
    notes: null,
    createdAt: "2026-01-01",
    status: "pending",
    ...overrides,
  };
}

function makePayment(invoiceId = "inv-1", amount = 2000): Payment {
  return {
    id: `pay-${invoiceId}-${amount}`,
    invoiceId,
    amount,
    paidAt: "2026-02-15",
  };
}

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "supp-1",
    name: "شركة التوريد",
    contact: "01011112222",
    notes: null,
    openingBalance: 0,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

function makeStockItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: "stock-1",
    name: "هاتف محمول",
    quantity: 10,
    lastUnitCost: 5000,
    salePrice: 7000,
    barcode: "1234567890",
    size: null,
    itemType: null,
    minStock: 5,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "shp-1",
    invoiceId: "inv-1",
    carrierId: "carrier-1",
    zoneId: null,
    trackingNumber: "TRK-001",
    status: "delivered",
    recipientName: "محمد أحمد",
    recipientPhone: "01012345678",
    deliveryAddress: "القاهرة",
    actualDeliveryDate: "2026-03-01",
    processingAt: null,
    shippedAt: null,
    deliveredAt: "2026-03-01",
    returnedAt: null,
    statusUpdatedBy: null,
    shippingCost: 100,
    codAmount: 5000,
    collectionStatus: "uncollected",
    collectedAt: null,
    settledAt: null,
    weightKg: 1,
    pieces: 1,
    expectedDeliveryDate: null,
    notes: null,
    createdAt: "2026-02-28",
    ...overrides,
  };
}

function makeReturn(overrides: Partial<ReturnRecord> = {}): ReturnRecord {
  return {
    id: "ret-1",
    invoiceId: "inv-1",
    type: "sale",
    totalAmount: 2000,
    reason: "عيب في الصنف",
    notes: null,
    createdAt: "2026-03-10",
    ...overrides,
  };
}

function makeReturnItem(overrides: Partial<ReturnItem> = {}): ReturnItem {
  return {
    id: "ret-item-1",
    returnId: "ret-1",
    name: "سماعة",
    unitPrice: 500,
    quantity: 1,
    createdAt: "2026-03-10",
    ...overrides,
  };
}

function makeInvoiceItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: "ii-1",
    invoiceId: "inv-1",
    name: "هاتف",
    cost: 4000,
    price: 6000,
    quantity: 1,
    discountPct: 0,
    discountAmount: 0,
    taxPct: 0,
    taxAmount: 0,
    lineTotal: 6000,
    serialNumbers: [],
    createdAt: "2026-01-01",
    ...overrides,
  };
}

// ============================================================
// runComprehensiveReconciliation
// ============================================================
describe("runComprehensiveReconciliation", () => {
  it("returns clean summary for empty data (no findings)", () => {
    const result = runComprehensiveReconciliation(emptyDBState());
    expect(result.findings).toHaveLength(0);
    expect(result.healthScore).toBe(100);
    expect(result.totalDiscrepancyAmount).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.noticeCount).toBe(0);
    expect(result.autoFixableCount).toBe(0);
  });

  it("counts totalAuditedRecords correctly", () => {
    const db = emptyDBState();
    db.invoices = [makeInvoice(), makeInvoice({ id: "inv-2" })];
    db.payments = [makePayment()];
    db.customers = [makeCustomer()];
    db.suppliers = [makeSupplier()];
    db.stockItems = [makeStockItem()];
    db.shipments = [makeShipment()];
    db.returns = [makeReturn()];
    const result = runComprehensiveReconciliation(db);
    expect(result.totalAuditedRecords.invoices).toBe(2);
    expect(result.totalAuditedRecords.payments).toBe(1);
    expect(result.totalAuditedRecords.customers).toBe(1);
    expect(result.totalAuditedRecords.suppliers).toBe(1);
    expect(result.totalAuditedRecords.stockItems).toBe(1);
    expect(result.totalAuditedRecords.shipments).toBe(1);
    expect(result.totalAuditedRecords.returns).toBe(1);
  });

  // ── Invoice checks ──
  it("detects invoice paid mismatch (recordedPaid != expectedPaid)", () => {
    const db = emptyDBState();
    const inv = makeInvoice({ id: "inv-x", paid: 5000, downPayment: 0 });
    db.invoices = [inv];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [makePayment("inv-x", 2000)]; // actual sum = 2000, recorded = 5000
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-paid-mismatch-inv-x");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.autoFixable).toBe(true);
    expect(finding!.differenceAmount).toBe(3000);
  });

  it("no paid mismatch when recorded matches expected", () => {
    const db = emptyDBState();
    const inv = makeInvoice({ id: "inv-ok", paid: 4000, downPayment: 2000 });
    db.invoices = [inv];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [makePayment("inv-ok", 2000)]; // down(2000) + payment(2000) = 4000 = recorded
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-paid-mismatch-inv-ok");
    expect(finding).toBeUndefined();
  });

  it("detects paid invoice still showing 'pending'", () => {
    const db = emptyDBState();
    const inv = makeInvoice({ id: "inv-p", total: 5000, paid: 5000, status: "pending" });
    db.invoices = [inv];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-status-paid-inv-p");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("notice");
    expect(finding!.fixType).toBe("set_invoice_status_paid");
  });

  it("detects 'paid' invoice with remaining balance", () => {
    const db = emptyDBState();
    const inv = makeInvoice({ id: "inv-w", total: 10000, paid: 6000, status: "paid" });
    db.invoices = [inv];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-status-pending-inv-w");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.differenceAmount).toBe(4000);
  });

  it("detects overpaid invoice", () => {
    const db = emptyDBState();
    const inv = makeInvoice({ id: "inv-op", total: 5000, paid: 6000 });
    db.invoices = [inv];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-overpaid-inv-op");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.differenceAmount).toBe(1000);
  });

  it("detects invoice with no items", () => {
    const db = emptyDBState();
    db.invoices = [makeInvoice({ id: "inv-ni", status: "pending" })];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [];
    db.invoiceItems = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-no-items-inv-ni");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
  });

  it("detects invoice items with zero cost", () => {
    const db = emptyDBState();
    db.invoices = [makeInvoice({ id: "inv-zc", status: "pending" })];
    db.customers = [makeCustomer({ id: "cust-1" })];
    db.payments = [];
    db.invoiceItems = [
      makeInvoiceItem({ invoiceId: "inv-zc", cost: 0, name: "جهاز رخيص" }),
    ];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "inv-zero-cost-inv-zc");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
  });

  // ── Customer checks ──
  it("detects customer exceeding credit limit", () => {
    const db = emptyDBState();
    db.customers = [
      makeCustomer({ id: "cust-h", creditLimit: 10000, openingBalance: 0 }),
    ];
    db.invoices = [
      makeInvoice({ id: "inv-h", customerId: "cust-h", total: 15000, paid: 0, downPayment: 0 }),
    ];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "cust-credit-limit-cust-h");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.differenceAmount).toBe(5000);
  });

  it("detects customer near credit limit (>= 90%)", () => {
    const db = emptyDBState();
    db.customers = [
      makeCustomer({ id: "cust-n", creditLimit: 10000, openingBalance: 0 }),
    ];
    db.invoices = [
      makeInvoice({ id: "inv-n", customerId: "cust-n", total: 9500, paid: 0, downPayment: 0 }),
    ];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "cust-credit-near-limit-cust-n");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("notice");
  });

  it("detects cash customer with outstanding debt", () => {
    const db = emptyDBState();
    db.customers = [makeCustomer({ id: "cust-c", customerType: "cash", openingBalance: 500 })];
    db.invoices = [];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "cust-cash-debt-cust-c");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
  });

  it("detects frozen customer with active debt", () => {
    const db = emptyDBState();
    db.customers = [makeCustomer({ id: "cust-f", frozen: true, openingBalance: 3000 })];
    db.invoices = [];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "cust-frozen-active-cust-f");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("notice");
    expect(finding!.differenceAmount).toBe(3000);
  });

  // ── Supplier checks ──
  it("detects supplier with negative balance (overpaid)", () => {
    const db = emptyDBState();
    db.suppliers = [makeSupplier({ id: "supp-n", openingBalance: 0 })];
    db.purchases = [
      {
        id: "pur-1",
        supplierId: "supp-n",
        total: 5000,
        paymentType: "credit",
        purchaseDate: "2026-01-01",
        notes: null,
        createdAt: "2026-01-01",
      },
    ];
    db.supplierPayments = [
      {
        id: "sp-1",
        supplierId: "supp-n",
        amount: 8000,
        paidAt: "2026-02-01",
      },
    ];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "supp-negative-balance-supp-n");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.differenceAmount).toBe(3000);
  });

  // ── Stock checks ──
  it("detects stock item with zero cost", () => {
    const db = emptyDBState();
    db.stockItems = [makeStockItem({ id: "stk-z", lastUnitCost: 0, name: "بضاعة مجانية" })];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "stock-zero-cost-stk-z");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
  });

  it("detects negative stock quantity", () => {
    const db = emptyDBState();
    db.stockItems = [makeStockItem({ id: "stk-n", quantity: -5, name: "مخزون سالب" })];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "stock-negative-qty-stk-n");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
  });

  it("detects low stock (at or below minimum)", () => {
    const db = emptyDBState();
    db.stockItems = [makeStockItem({ id: "stk-l", quantity: 3, minStock: 5, name: "صنف منخفض" })];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "stock-low-stk-l");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("notice");
  });

  it("detects duplicate barcode", () => {
    const db = emptyDBState();
    db.stockItems = [
      makeStockItem({ id: "stk-a", barcode: "ABC123", name: "الصنف أ" }),
      makeStockItem({ id: "stk-b", barcode: "ABC123", name: "الصنف ب" }),
    ];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "stock-duplicate-barcode-ABC123");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
  });

  it("no barcode duplicate finding when barcodes are unique", () => {
    const db = emptyDBState();
    db.stockItems = [
      makeStockItem({ id: "stk-a", barcode: "AAA", name: "أ" }),
      makeStockItem({ id: "stk-b", barcode: "BBB", name: "ب" }),
    ];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id?.includes("stock-duplicate-barcode"));
    expect(finding).toBeUndefined();
  });

  // ── Shipment checks ──
  it("detects delivered shipment with unsettled COD", () => {
    const db = emptyDBState();
    db.shipments = [
      makeShipment({ id: "shp-u", status: "delivered", codAmount: 3000, collectionStatus: "uncollected" }),
    ];
    db.carriers = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "shipment-unsettled-cod-shp-u");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.autoFixable).toBe(true);
  });

  it("no finding for settled shipment", () => {
    const db = emptyDBState();
    db.shipments = [
      makeShipment({ id: "shp-s", status: "delivered", codAmount: 3000, collectionStatus: "settled" }),
    ];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id?.includes("shipment-unsettled"));
    expect(finding).toBeUndefined();
  });

  // ── Return checks ──
  it("detects return with no items", () => {
    const db = emptyDBState();
    db.returns = [makeReturn({ id: "ret-e", totalAmount: 2000 })];
    db.returnItems = [];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id === "return-empty-items-ret-e");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
  });

  it("no finding when return has items", () => {
    const db = emptyDBState();
    db.returns = [makeReturn({ id: "ret-ok", totalAmount: 1000 })];
    db.returnItems = [makeReturnItem({ returnId: "ret-ok" })];
    const result = runComprehensiveReconciliation(db);
    const finding = result.findings.find((f) => f.id?.includes("return-empty-items"));
    expect(finding).toBeUndefined();
  });

  // ── Health Score ──
  it("health score deducted by critical = 7, warning = 3, notice = 1", () => {
    const db = emptyDBState();
    // 1 critical (stock negative) + 1 warning (invoice overpaid) + 1 notice (low stock)
    db.stockItems = [
      makeStockItem({ id: "stk-s1", quantity: -1, name: "سالب" }),
      makeStockItem({ id: "stk-s2", quantity: 1, minStock: 10, name: "منخفض" }),
    ];
    db.customers = [makeCustomer({ id: "cust-s" })];
    db.invoices = [makeInvoice({ id: "inv-s", total: 1000, paid: 2000 })];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    // critical (stock-negative-qty) = 7, warning (inv-overpaid) = 3, notice (stock-low) = 1
    expect(result.healthScore).toBe(100 - 7 - 3 - 1);
  });

  it("health score floors at 0", () => {
    const db = emptyDBState();
    // 15 critical findings would deduct 105, but score floors at 0
    const items: StockItem[] = [];
    for (let i = 0; i < 15; i++) {
      items.push(makeStockItem({ id: `stk-floor-${i}`, quantity: -1, name: `سالب ${i}`, barcode: `BC${i}` }));
    }
    db.stockItems = items;
    const result = runComprehensiveReconciliation(db);
    expect(result.healthScore).toBe(0);
  });

  it("health score caps at 100", () => {
    const db = emptyDBState();
    db.customers = [makeCustomer({ id: "cust-ok" })];
    db.invoices = [makeInvoice({ id: "inv-ok", total: 10000, paid: 10000, downPayment: 0 })];
    db.payments = [makePayment("inv-ok", 10000)];
    const result = runComprehensiveReconciliation(db);
    expect(result.healthScore).toBe(100);
  });

  // ── Category counts ──
  it("correctly counts findings per category", () => {
    const db = emptyDBState();
    db.stockItems = [
      makeStockItem({ id: "stk-c1", lastUnitCost: 0, name: "تكلفة صفر", barcode: "C1" }),
      makeStockItem({ id: "stk-c2", quantity: -1, name: "كمية سالبة", barcode: "C2" }),
    ];
    db.customers = [makeCustomer({ id: "cust-c2", customerType: "cash", openingBalance: 500 })];
    db.invoices = [];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    expect(result.categoryCounts.stock).toBeGreaterThanOrEqual(2);
    expect(result.categoryCounts.customers).toBeGreaterThanOrEqual(1);
  });

  // ── Stock movements ──
  it("detects stock movement mismatch when movements provided", () => {
    const db = emptyDBState();
    db.stockItems = [makeStockItem({ id: "stk-m", quantity: 10, name: "مطابقة" })];
    const movements = [{ stock_item_id: "stk-m", quantity: 8 }]; // mismatch: 10 vs 8
    const result = runComprehensiveReconciliation(db, movements);
    const finding = result.findings.find((f) => f.id === "stock-mov-mismatch-stk-m");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
  });

  it("no finding when stock movement matches", () => {
    const db = emptyDBState();
    db.stockItems = [makeStockItem({ id: "stk-m2", quantity: 10, name: "مطابقة2" })];
    const movements = [{ stock_item_id: "stk-m2", quantity: 10 }];
    const result = runComprehensiveReconciliation(db, movements);
    const finding = result.findings.find((f) => f.id === "stock-mov-mismatch-stk-m2");
    expect(finding).toBeUndefined();
  });

  // ── Total discrepancy ──
  it("totalDiscrepancyAmount sums all differenceAmounts", () => {
    const db = emptyDBState();
    db.stockItems = [makeStockItem({ id: "stk-td", quantity: -5, name: "سالب" })];
    db.customers = [makeCustomer({ id: "cust-td", creditLimit: 1000 })];
    db.invoices = [
      makeInvoice({
        id: "inv-td",
        customerId: "cust-td",
        total: 20000,
        paid: 0,
        downPayment: 0,
      }),
    ];
    db.payments = [];
    const result = runComprehensiveReconciliation(db);
    expect(result.totalDiscrepancyAmount).toBeGreaterThan(0);
  });

  // ── Skips cancelled invoices ──
  it("does not flag cancelled invoices", () => {
    const db = emptyDBState();
    db.invoices = [
      makeInvoice({ id: "inv-cancel", total: 5000, paid: 0, status: "cancelled" }),
    ];
    db.customers = [makeCustomer({ id: "cust-1" })];
    const result = runComprehensiveReconciliation(db);
    const invFindings = result.findings.filter(
      (f) => f.targetId === "inv-cancel" || f.id.includes("inv-cancel")
    );
    expect(invFindings).toHaveLength(0);
  });
});
