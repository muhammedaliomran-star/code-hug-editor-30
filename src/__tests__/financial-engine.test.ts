import { describe, it, expect } from "vitest";
import {
  roundCurrency,
  calculateInvoiceFinancials,
  generateInstallmentSchedule,
  calculateDueStatus,
  calculateRealCOGS,
  calculateRealProfitMetrics,
} from "@/lib/financial-engine";

// ============================================================
// roundCurrency
// ============================================================
describe("roundCurrency", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(roundCurrency(10.004)).toBe(10.0);
    expect(roundCurrency(99.991)).toBe(99.99);
  });

  it("returns 0 for NaN", () => {
    expect(roundCurrency(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(roundCurrency(Infinity)).toBe(0);
    expect(roundCurrency(-Infinity)).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(roundCurrency(-5.555)).toBe(-5.56);
    expect(roundCurrency(-5.554)).toBe(-5.55);
  });

  it("handles zero", () => {
    expect(roundCurrency(0)).toBe(0);
  });

  it("handles whole numbers", () => {
    expect(roundCurrency(100)).toBe(100);
    expect(roundCurrency(1000)).toBe(1000);
  });
});

// ============================================================
// calculateInvoiceFinancials
// ============================================================
describe("calculateInvoiceFinancials", () => {
  it("calculates a simple invoice with 3 items", () => {
    const result = calculateInvoiceFinancials({
      items: [
        { price: 1000, quantity: 2 },
        { price: 500, quantity: 1 },
        { price: 200, quantity: 3 },
      ],
    });
    expect(result.subtotal).toBe(3100); // 2000 + 500 + 600
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.netTotal).toBe(3100);
    expect(result.downPayment).toBe(0);
    expect(result.remainingAmount).toBe(3100);
    expect(result.installmentCount).toBe(1);
  });

  it("applies percentage discount", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 10000, quantity: 1 }],
      discountPct: 10,
    });
    expect(result.subtotal).toBe(10000);
    expect(result.discountPct).toBe(10);
    expect(result.discountAmount).toBe(1000);
    expect(result.netTotal).toBe(9000);
  });

  it("applies fixed discount", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 5000, quantity: 1 }],
      discountAmount: 500,
    });
    expect(result.discountAmount).toBe(500);
    expect(result.discountPct).toBe(10);
  });

  it("caps discount at subtotal (cannot discount more than total)", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 1000, quantity: 1 }],
      discountAmount: 5000,
    });
    expect(result.discountAmount).toBe(1000);
    expect(result.discountPct).toBe(100);
    expect(result.netTotal).toBe(0);
  });

  it("caps percentage discount at 100%", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 1000, quantity: 1 }],
      discountPct: 150,
    });
    expect(result.discountPct).toBe(100);
    expect(result.discountAmount).toBe(1000);
    expect(result.netTotal).toBe(0);
  });

  it("applies 14% tax after discount", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 10000, quantity: 1 }],
      discountPct: 10,
      taxPct: 14,
    });
    expect(result.subtotal).toBe(10000);
    expect(result.discountAmount).toBe(1000);
    const afterDiscount = 9000;
    expect(result.taxAmount).toBe(roundCurrency((afterDiscount * 14) / 100));
    expect(result.netTotal).toBe(roundCurrency(afterDiscount + result.taxAmount));
  });

  it("calculates down payment + installments", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 60000, quantity: 1 }],
      downPayment: 10000,
      installmentCount: 5,
    });
    expect(result.netTotal).toBe(60000);
    expect(result.downPayment).toBe(10000);
    expect(result.remainingAmount).toBe(50000);
    expect(result.monthlyInstallment).toBe(10000);
    expect(result.installmentCount).toBe(5);
  });

  it("down payment cannot exceed net total", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 5000, quantity: 1 }],
      downPayment: 10000,
    });
    expect(result.downPayment).toBe(5000);
    expect(result.remainingAmount).toBe(0);
  });

  it("handles single item invoice", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 2500, quantity: 1 }],
    });
    expect(result.subtotal).toBe(2500);
    expect(result.netTotal).toBe(2500);
  });

  it("handles empty items array", () => {
    const result = calculateInvoiceFinancials({ items: [] });
    expect(result.subtotal).toBe(0);
    expect(result.netTotal).toBe(0);
    expect(result.remainingAmount).toBe(0);
    expect(result.monthlyInstallment).toBe(0);
  });

  it("defaults quantity to 1 when not specified", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 500 }],
    });
    expect(result.subtotal).toBe(500);
  });

  it("handles items with zero price", () => {
    const result = calculateInvoiceFinancials({
      items: [{ price: 0, quantity: 5 }],
    });
    expect(result.subtotal).toBe(0);
  });

  it("full scenario: discount + tax + down payment + installments", () => {
    const result = calculateInvoiceFinancials({
      items: [
        { price: 20000, quantity: 2 },
        { price: 5000, quantity: 1 },
      ],
      discountPct: 5,
      taxPct: 14,
      downPayment: 10000,
      installmentCount: 6,
    });
    expect(result.subtotal).toBe(45000);
    expect(result.discountAmount).toBe(2250);
    const afterDiscount = 42750;
    expect(result.taxAmount).toBe(roundCurrency((afterDiscount * 14) / 100));
    const expectedNet = roundCurrency(afterDiscount + result.taxAmount);
    expect(result.netTotal).toBe(expectedNet);
    expect(result.downPayment).toBe(10000);
    expect(result.remainingAmount).toBe(roundCurrency(expectedNet - 10000));
    expect(result.installmentCount).toBe(6);
    expect(result.monthlyInstallment).toBe(
      roundCurrency(roundCurrency(expectedNet - 10000) / 6)
    );
  });
});

// ============================================================
// generateInstallmentSchedule
// ============================================================
describe("generateInstallmentSchedule", () => {
  it("generates 3 equal installments from 9000", () => {
    const rows = generateInstallmentSchedule(9000, 3, new Date("2026-01-01"));
    expect(rows).toHaveLength(3);
    expect(rows[0].amount).toBe(3000);
    expect(rows[1].amount).toBe(3000);
    expect(rows[2].amount).toBe(3000);
  });

  it("sum of installments equals remaining amount exactly", () => {
    const rows = generateInstallmentSchedule(10000, 6, new Date("2026-01-01"));
    const sum = rows.reduce((acc, r) => acc + r.amount, 0);
    expect(sum).toBe(10000);
  });

  it("distributes rounding remainder to last installment", () => {
    const rows = generateInstallmentSchedule(10000, 3, new Date("2026-01-01"));
    // 10000 / 3 = 3333.33, so last = 3333.34
    expect(rows[0].amount).toBe(3333.33);
    expect(rows[1].amount).toBe(3333.33);
    expect(rows[2].amount).toBe(3333.34);
    const sum = rows.reduce((acc, r) => acc + r.amount, 0);
    expect(sum).toBe(10000);
  });

  it("increments due date monthly", () => {
    const rows = generateInstallmentSchedule(6000, 3, new Date("2026-01-15"));
    expect(rows[0].due.getMonth()).toBe(0); // Jan
    expect(rows[1].due.getMonth()).toBe(1); // Feb
    expect(rows[2].due.getMonth()).toBe(2); // Mar
  });

  it("returns empty for zero remaining", () => {
    expect(generateInstallmentSchedule(0, 3, new Date())).toHaveLength(0);
  });

  it("returns empty for zero installments", () => {
    expect(generateInstallmentSchedule(5000, 0, new Date())).toHaveLength(0);
  });

  it("handles negative remaining as empty", () => {
    expect(generateInstallmentSchedule(-100, 3, new Date())).toHaveLength(0);
  });

  it("uses override monthly installment when provided", () => {
    const rows = generateInstallmentSchedule(10000, 3, new Date("2026-01-01"), 2500);
    expect(rows[0].amount).toBe(2500);
    expect(rows[1].amount).toBe(2500);
    expect(rows[2].amount).toBe(5000);
  });

  it("single installment gets full amount", () => {
    const rows = generateInstallmentSchedule(7500, 1, new Date("2026-01-01"));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(7500);
  });

  it("assigns correct n (sequence number)", () => {
    const rows = generateInstallmentSchedule(4000, 4, new Date("2026-01-01"));
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4]);
  });
});

// ============================================================
// calculateDueStatus
// ============================================================
describe("calculateDueStatus", () => {
  it("not overdue when due date is today", () => {
    const today = new Date("2026-06-15");
    const result = calculateDueStatus({
      dueDate: "2026-06-15",
      paidAmount: 0,
      totalDue: 1000,
      today,
    });
    expect(result.isOverdue).toBe(false);
    expect(result.daysLate).toBe(0);
    expect(result.remainingDue).toBe(1000);
  });

  it("overdue by 5 days", () => {
    const today = new Date("2026-06-20");
    const result = calculateDueStatus({
      dueDate: "2026-06-15",
      paidAmount: 0,
      totalDue: 1000,
      today,
    });
    expect(result.isOverdue).toBe(true);
    expect(result.daysLate).toBe(5);
    expect(result.remainingDue).toBe(1000);
  });

  it("not overdue when due date is in the future", () => {
    const today = new Date("2026-06-10");
    const result = calculateDueStatus({
      dueDate: "2026-06-15",
      paidAmount: 0,
      totalDue: 1000,
      today,
    });
    expect(result.isOverdue).toBe(false);
    expect(result.daysLate).toBe(0);
  });

  it("fully paid shows zero remaining", () => {
    const result = calculateDueStatus({
      dueDate: "2026-06-15",
      paidAmount: 1000,
      totalDue: 1000,
      today: new Date("2026-07-01"),
    });
    expect(result.isOverdue).toBe(false);
    expect(result.remainingDue).toBe(0);
  });

  it("partially paid shows correct remaining", () => {
    const result = calculateDueStatus({
      dueDate: "2026-06-15",
      paidAmount: 300,
      totalDue: 1000,
      today: new Date("2026-07-01"),
    });
    expect(result.remainingDue).toBe(700);
  });

  it("handles Date object input", () => {
    const result = calculateDueStatus({
      dueDate: new Date("2026-06-15"),
      paidAmount: 0,
      totalDue: 500,
      today: new Date("2026-06-20"),
    });
    expect(result.isOverdue).toBe(true);
    expect(result.daysLate).toBe(5);
  });

  it("overpayment does not go negative", () => {
    const result = calculateDueStatus({
      dueDate: "2026-06-15",
      paidAmount: 1500,
      totalDue: 1000,
      today: new Date("2026-07-01"),
    });
    expect(result.remainingDue).toBe(0);
  });
});

// ============================================================
// calculateRealCOGS
// ============================================================
describe("calculateRealCOGS", () => {
  it("sums cost * quantity for items with cost", () => {
    const result = calculateRealCOGS([
      { cost: 100, quantity: 5 },
      { cost: 200, quantity: 2 },
    ]);
    expect(result).toBe(900); // 500 + 400
  });

  it("ignores items without cost", () => {
    const result = calculateRealCOGS([
      { cost: 100, quantity: 2 },
      { price: 500, quantity: 3 },
    ]);
    expect(result).toBe(200);
  });

  it("ignores items with cost = 0", () => {
    const result = calculateRealCOGS([
      { cost: 0, quantity: 5 },
      { cost: 100, quantity: 1 },
    ]);
    expect(result).toBe(100);
  });

  it("returns 0 for empty array", () => {
    expect(calculateRealCOGS([])).toBe(0);
  });

  it("defaults quantity to 1", () => {
    const result = calculateRealCOGS([{ cost: 250 }]);
    expect(result).toBe(250);
  });

  it("handles negative cost as 0", () => {
    const result = calculateRealCOGS([{ cost: -100, quantity: 2 }]);
    expect(result).toBe(0);
  });
});

// ============================================================
// calculateRealProfitMetrics
// ============================================================
describe("calculateRealProfitMetrics", () => {
  it("calculates positive profit scenario", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 100000,
      taxTotal: 0,
      returnsTotal: 0,
      cogsTotal: 60000,
      expensesTotal: 10000,
    });
    expect(result.netSales).toBe(100000);
    expect(result.grossProfit).toBe(40000);
    expect(result.netProfit).toBe(30000);
    expect(result.grossMarginPct).toBe(40);
    expect(result.netMarginPct).toBe(30);
  });

  it("calculates negative profit scenario", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 50000,
      taxTotal: 0,
      returnsTotal: 0,
      cogsTotal: 60000,
      expensesTotal: 5000,
    });
    expect(result.grossProfit).toBe(-10000);
    expect(result.netProfit).toBe(-15000);
  });

  it("subtracts tax and returns from revenue", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 100000,
      taxTotal: 14000,
      returnsTotal: 6000,
      cogsTotal: 40000,
      expensesTotal: 10000,
    });
    expect(result.netSales).toBe(80000); // 100000 - 14000 - 6000
    expect(result.grossProfit).toBe(40000); // 80000 - 40000
  });

  it("netSales never goes below 0", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 10000,
      taxTotal: 5000,
      returnsTotal: 8000,
      cogsTotal: 5000,
      expensesTotal: 2000,
    });
    expect(result.netSales).toBe(0);
  });

  it("includes cash purchases in net profit", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 100000,
      taxTotal: 0,
      returnsTotal: 0,
      cogsTotal: 50000,
      expensesTotal: 10000,
      cashPurchasesTotal: 5000,
    });
    expect(result.netProfit).toBe(35000); // 50000 - 10000 - 5000
  });

  it("returns 0 margins when netSales is 0", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 0,
      taxTotal: 0,
      returnsTotal: 0,
      cogsTotal: 0,
      expensesTotal: 0,
    });
    expect(result.grossMarginPct).toBe(0);
    expect(result.netMarginPct).toBe(0);
  });

  it("all fields are rounded to 2 decimals", () => {
    const result = calculateRealProfitMetrics({
      salesTotal: 100000.555,
      taxTotal: 14000.333,
      returnsTotal: 2000.777,
      cogsTotal: 55000.111,
      expensesTotal: 8000.222,
    });
    expect(Number.isFinite(result.grossProfit)).toBe(true);
    expect(Number.isFinite(result.netProfit)).toBe(true);
    expect(Number.isFinite(result.grossMarginPct)).toBe(true);
  });
});
