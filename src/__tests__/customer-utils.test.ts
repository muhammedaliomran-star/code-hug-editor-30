import { describe, it, expect } from "vitest";
import {
  getCustomerCode,
  isoToDDMMYYYY,
  ddmmyyyyToIso,
  getCustomerAccountSummary,
  type Customer,
  type Invoice,
} from "@/lib/customer-utils";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1", name: "محمد أحمد", phone: "01012345678",
    rating: 5, status: "committed", customerType: "installment",
    notes: null, frozen: false, address: null, joiningDate: "2026-01-01",
    creditLimit: 0, dueDay: 1, openingBalance: 0, createdAt: "2026-01-01",
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1", customerId: "cust-1", total: 10000,
    downPayment: 2000, monthlyInstallment: 2000,
    firstDueDate: "2026-01-15", paid: 0, notes: null,
    createdAt: "2026-01-01", status: "pending",
    ...overrides,
  };
}

describe("getCustomerCode", () => {
  it("generates code from ID", () => {
    const code = getCustomerCode({ id: "abc123" });
    expect(code).toBe("C-BC123");
  });

  it("pads short IDs", () => {
    const code = getCustomerCode({ id: "ab" });
    expect(code).toBe("C-000AB");
  });

  it("handles empty ID", () => {
    expect(getCustomerCode({ id: "" })).toBe("C-00000");
  });

  it("strips non-alphanumeric chars", () => {
    const code = getCustomerCode({ id: "a-b-c-1-2-3" });
    expect(code).toBe("C-BC123");
  });
});

describe("isoToDDMMYYYY", () => {
  it("converts ISO to DD/MM/YYYY", () => {
    expect(isoToDDMMYYYY("2026-03-15")).toBe("15/03/2026");
  });

  it("handles empty string", () => {
    expect(isoToDDMMYYYY("")).toBe("");
  });

  it("handles invalid format", () => {
    expect(isoToDDMMYYYY("not-a-date")).toBe("");
  });

  it("handles single-digit month/day", () => {
    expect(isoToDDMMYYYY("2026-01-05")).toBe("05/01/2026");
  });
});

describe("ddmmyyyyToIso", () => {
  it("converts DD/MM/YYYY to ISO", () => {
    expect(ddmmyyyyToIso("15/03/2026")).toBe("2026-03-15");
  });

  it("handles already ISO format", () => {
    expect(ddmmyyyyToIso("2026-03-15")).toBe("2026-03-15");
  });

  it("returns null for invalid format", () => {
    expect(ddmmyyyyToIso("invalid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(ddmmyyyyToIso("")).toBeNull();
  });

  it("pads single digit day/month", () => {
    expect(ddmmyyyyToIso("5/3/2026")).toBe("2026-03-05");
  });

  it("returns null for month > 12", () => {
    expect(ddmmyyyyToIso("15/13/2026")).toBeNull();
  });

  it("returns null for day > 31", () => {
    expect(ddmmyyyyToIso("32/01/2026")).toBeNull();
  });
});

describe("getCustomerAccountSummary", () => {
  it("calculates total invoiced and paid", () => {
    const customer = makeCustomer();
    const invoices = [
      makeInvoice({ id: "inv-1", total: 10000, paid: 3000 }),
      makeInvoice({ id: "inv-2", total: 5000, paid: 5000, status: "paid" }),
    ];
    const result = getCustomerAccountSummary(customer, invoices);
    expect(result.totalInvoiced).toBe(15000);
    expect(result.totalPaid).toBe(8000);
  });

  it("calculates currentDebt correctly", () => {
    const customer = makeCustomer({ openingBalance: 1000 });
    const invoices = [makeInvoice({ total: 10000, paid: 3000 })];
    const result = getCustomerAccountSummary(customer, invoices);
    // openingBalance(1000) + invoiced(10000) - paid(3000) = 8000
    expect(result.currentDebt).toBe(8000);
  });

  it("currentDebt never goes below 0", () => {
    const customer = makeCustomer({ openingBalance: 0 });
    const invoices = [makeInvoice({ total: 5000, paid: 10000 })];
    const result = getCustomerAccountSummary(customer, invoices);
    expect(result.currentDebt).toBe(0);
  });

  it("counts active vs completed invoices", () => {
    const customer = makeCustomer();
    const invoices = [
      makeInvoice({ id: "i1", total: 10000, paid: 3000, status: "pending" }),
      makeInvoice({ id: "i2", total: 5000, paid: 5000, status: "paid" }),
      makeInvoice({ id: "i3", total: 8000, paid: 8000 }),
    ];
    const result = getCustomerAccountSummary(customer, invoices);
    expect(result.activeCount).toBe(1);
    expect(result.completedCount).toBe(2);
  });

  it("detects over credit limit", () => {
    const customer = makeCustomer({ creditLimit: 5000 });
    const invoices = [makeInvoice({ total: 10000, paid: 0 })];
    const result = getCustomerAccountSummary(customer, invoices);
    expect(result.isOverCreditLimit).toBe(true);
  });

  it("no over credit limit when limit is 0 (unlimited)", () => {
    const customer = makeCustomer({ creditLimit: 0 });
    const invoices = [makeInvoice({ total: 100000, paid: 0 })];
    const result = getCustomerAccountSummary(customer, invoices);
    expect(result.isOverCreditLimit).toBe(false);
  });

  it("handles customer with no invoices", () => {
    const customer = makeCustomer({ openingBalance: 0 });
    const result = getCustomerAccountSummary(customer, []);
    expect(result.totalInvoiced).toBe(0);
    expect(result.currentDebt).toBe(0);
    expect(result.activeCount).toBe(0);
    expect(result.completedCount).toBe(0);
  });

  it("filters cancelled invoices from active count", () => {
    const customer = makeCustomer();
    const invoices = [
      makeInvoice({ id: "i1", total: 5000, paid: 0, status: "cancelled" }),
      makeInvoice({ id: "i2", total: 5000, paid: 2000, status: "pending" }),
    ];
    const result = getCustomerAccountSummary(customer, invoices);
    expect(result.activeCount).toBe(1);
    expect(result.completedCount).toBe(0);
  });
});