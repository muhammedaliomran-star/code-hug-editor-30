import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDefaultTreasuryAccounts,
  calculateDenominationTotal,
  calculateAccountBalance,
  getUnifiedCashLedger,
  createInternalTransfer,
  type TreasuryAccount,
  type ManualCashTransaction,
  type InternalTransfer,
} from "@/lib/cashbox-system";
import type { Invoice, Payment, Expense } from "@/lib/store";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn().mockReturnValue({ insert: vi.fn(), select: vi.fn(), eq: vi.fn() }) },
}));

const LS: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(LS)) delete LS[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => LS[k] ?? null,
    setItem: (k: string, v: string) => { LS[k] = v; },
    removeItem: (k: string) => { delete LS[k]; },
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("crypto", { randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` });
});

function acc(overrides: Partial<TreasuryAccount> = {}): TreasuryAccount {
  return {
    id: "acc-1", name: "حساب اختبار", type: "cash",
    initialBalance: 0, active: true, createdAt: "2026-01-01", ...overrides,
  };
}

describe("getDefaultTreasuryAccounts", () => {
  it("returns 4 default accounts", () => {
    const accounts = getDefaultTreasuryAccounts();
    expect(accounts).toHaveLength(4);
  });
  it("first account is cash and isDefault", () => {
    const accounts = getDefaultTreasuryAccounts();
    expect(accounts[0].type).toBe("cash");
    expect(accounts[0].isDefault).toBe(true);
  });
  it("has ewallet, bank types", () => {
    const accounts = getDefaultTreasuryAccounts();
    const types = accounts.map((a) => a.type);
    expect(types).toContain("ewallet");
    expect(types).toContain("bank");
  });
});

describe("calculateDenominationTotal", () => {
  it("calculates total from all denominations", () => {
    const total = calculateDenominationTotal({
      d200: 5, d100: 3, d50: 2, d20: 1, d10: 4, d5: 2, coins: 15,
    });
    // 5*200 + 3*100 + 2*50 + 1*20 + 4*10 + 2*5 + 15*1
    expect(total).toBe(1000 + 300 + 100 + 20 + 40 + 10 + 15);
  });

  it("returns 0 for all zeros", () => {
    expect(calculateDenominationTotal({ d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 0 })).toBe(0);
  });

  it("handles partial denominations", () => {
    expect(calculateDenominationTotal({ d200: 1, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 0 })).toBe(200);
  });

  it("handles only coins", () => {
    expect(calculateDenominationTotal({ d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 50 })).toBe(50);
  });

  it("handles undefined as 0", () => {
    const result = calculateDenominationTotal({} as any);
    expect(result).toBe(0);
  });
});

describe("calculateAccountBalance", () => {
  it("returns initial balance when no transactions", () => {
    const result = calculateAccountBalance(acc({ initialBalance: 5000 }), [], [], [], [], []);
    expect(result.initial).toBe(5000);
    expect(result.currentBalance).toBe(5000);
    expect(result.inflows).toBe(0);
    expect(result.outflows).toBe(0);
  });

  it("counts invoice downpayments for main cash account", () => {
    const account = acc({ id: "acc-cash-main", isDefault: true, initialBalance: 0 });
    const invoices = [{ downPayment: 5000 } as Invoice, { downPayment: 3000 } as Invoice];
    const result = calculateAccountBalance(account, invoices, [], [], [], []);
    expect(result.inflows).toBe(8000);
    expect(result.currentBalance).toBe(8000);
  });

  it("counts payments for main cash account", () => {
    const account = acc({ id: "acc-cash-main", isDefault: true });
    const payments = [{ amount: 2000 } as Payment, { amount: 1000 } as Payment];
    const result = calculateAccountBalance(account, [], payments, [], [], []);
    expect(result.inflows).toBe(3000);
  });

  it("does NOT count downpayments for non-default account", () => {
    const account = acc({ id: "acc-other", isDefault: false });
    const invoices = [{ downPayment: 5000 } as Invoice];
    const result = calculateAccountBalance(account, invoices, [], [], [], []);
    expect(result.inflows).toBe(0);
  });

  it("counts expenses as outflows", () => {
    const account = acc({ id: "acc-cash-main", isDefault: true });
    const expenses = [{ amount: 1500 } as Expense, { amount: 500 } as Expense];
    const result = calculateAccountBalance(account, [], [], expenses, [], []);
    expect(result.outflows).toBe(2000);
  });

  it("manual in/out transactions", () => {
    const account = acc({ id: "acc-1" });
    const manualTxs = [
      { accountId: "acc-1", type: "in", amount: 3000 } as ManualCashTransaction,
      { accountId: "acc-1", type: "out", amount: 1000 } as ManualCashTransaction,
    ];
    const result = calculateAccountBalance(account, [], [], [], manualTxs, []);
    expect(result.inflows).toBe(3000);
    expect(result.outflows).toBe(1000);
    expect(result.currentBalance).toBe(2000);
  });

  it("internal transfers: from = outflow, to = inflow", () => {
    const accountA = acc({ id: "acc-a", initialBalance: 10000 });
    const accountB = acc({ id: "acc-b", initialBalance: 0 });
    const transfers = [
      { fromAccountId: "acc-a", toAccountId: "acc-b", amount: 5000, fee: 50 } as InternalTransfer,
    ];
    const resultA = calculateAccountBalance(accountA, [], [], [], [], transfers);
    expect(resultA.outflows).toBe(5050);
    expect(resultA.currentBalance).toBe(4950);

    const resultB = calculateAccountBalance(accountB, [], [], [], [], transfers);
    expect(resultB.inflows).toBe(5000);
    expect(resultB.currentBalance).toBe(5000);
  });

  it("rounds results to 2 decimals", () => {
    const account = acc({ id: "acc-cash-main", isDefault: true });
    const expenses = [{ amount: 333.33 } as Expense];
    const result = calculateAccountBalance(account, [], [], expenses, [], []);
    expect(result.outflows).toBe(333.33);
  });
});

describe("getUnifiedCashLedger", () => {
  it("includes invoice downpayments", () => {
    const ledger = getUnifiedCashLedger(
      [{ id: "inv-1", createdAt: "2026-01-01", downPayment: 5000 } as Invoice],
      [], [], [], [],
    );
    expect(ledger.some((t) => t.source === "invoice_downpayment")).toBe(true);
  });

  it("includes payments", () => {
    const ledger = getUnifiedCashLedger(
      [],
      [{ id: "pay-1", paidAt: "2026-01-01", amount: 2000, invoiceId: "inv-1" } as Payment],
      [], [], [],
    );
    expect(ledger.some((t) => t.source === "payment_installment")).toBe(true);
  });

  it("includes expenses", () => {
    const ledger = getUnifiedCashLedger(
      [], [],
      [{ id: "exp-1", amount: 500, category: "rent", expenseDate: "2026-01-01", notes: null, createdAt: "2026-01-01" } as Expense],
      [], [],
    );
    expect(ledger.some((t) => t.source === "expense")).toBe(true);
  });

  it("includes manual transactions", () => {
    const ledger = getUnifiedCashLedger([], [], [], [
      { id: "m-1", accountId: "acc-1", type: "in", amount: 1000, category: "", date: "2026-01-01", title: "إيداع", performedBy: "user", createdAt: "2026-01-01" },
    ], []);
    expect(ledger.some((t) => t.source === "manual")).toBe(true);
  });

  it("transfers create out + fee + in entries", () => {
    const ledger = getUnifiedCashLedger([], [], [], [], [
      { id: "trf-1", fromAccountId: "acc-a", toAccountId: "acc-b", amount: 1000, fee: 100, date: "2026-01-01", transferNumber: "#TR-0001", feeRecordedAsExpense: false, performedBy: "user", createdAt: "2026-01-01" },
    ]);
    const trfEntries = ledger.filter((t) => t.referenceId === "trf-1");
    expect(trfEntries.length).toBe(3);
  });

  it("filters by account", () => {
    const ledger = getUnifiedCashLedger([], [], [], [
      { id: "m-1", accountId: "acc-a", type: "in", amount: 100, category: "", date: "2026-01-01", title: "test", performedBy: "u", createdAt: "2026-01-01" },
      { id: "m-2", accountId: "acc-b", type: "in", amount: 200, category: "", date: "2026-01-01", title: "test", performedBy: "u", createdAt: "2026-01-01" },
    ], [], "acc-a");
    expect(ledger.every((t) => t.accountId === "acc-a")).toBe(true);
  });

  it("sorts descending (newest first)", () => {
    const ledger = getUnifiedCashLedger([], [], [
      { id: "e1", amount: 100, category: "rent", expenseDate: "2026-01-01", notes: null, createdAt: "2026-01-01" } as Expense,
      { id: "e2", amount: 200, category: "rent", expenseDate: "2026-01-15", notes: null, createdAt: "2026-01-15" } as Expense,
    ], [], []);
    expect(new Date(ledger[0].date).getTime()).toBeGreaterThanOrEqual(new Date(ledger[1].date).getTime());
  });

  it("calculates running balance correctly", () => {
    const ledger = getUnifiedCashLedger([], [], [], [
      { id: "m-1", accountId: "acc-cash-main", type: "in", amount: 1000, category: "", date: "2026-01-01", title: "in1", performedBy: "u", createdAt: "2026-01-01" },
      { id: "m-2", accountId: "acc-cash-main", type: "out", amount: 300, category: "", date: "2026-01-02", title: "out1", performedBy: "u", createdAt: "2026-01-02" },
    ], []);
    const running = ledger[0].runningBalance;
    expect(running).toBe(700);
  });
});