import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encodeExpenseNotes,
  decodeExpenseNotes,
  computeNextDueDate,
  checkRecurringStatus,
  advanceDueDate,
  budgetKey,
  calculateBudgetStatus,
  tafqeetArabic,
  type ExpenseMeta,
  type RecurringExpense,
  type CategoryBudget,
} from "@/lib/expenses-system";
import type { Expense } from "@/lib/store";

vi.mock("@/lib/pdf-doc", () => ({ pdfDocument: vi.fn(), openPdfDocument: vi.fn(), esc: vi.fn((s: string) => s) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn().mockReturnValue({ insert: vi.fn(), select: vi.fn(), eq: vi.fn() }) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const LS: Record<string, string> = {};
beforeEach(() => {
  Object.keys(LS).forEach((k) => delete LS[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => LS[k] ?? null,
    setItem: (k: string, v: string) => { LS[k] = v; },
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});

describe("encodeExpenseNotes / decodeExpenseNotes", () => {
  it("encodes meta into notes", () => {
    const meta: ExpenseMeta = { accountId: "acc-1", branchId: "br-1", costCenter: "marketing" };
    const encoded = encodeExpenseNotes("مصاريف إعلان", meta);
    expect(encoded).toContain("مصاريف إعلان");
    expect(encoded).toContain("<!--seg_meta:");
    expect(encoded).toContain("acc-1");
  });

  it("decodes meta from notes", () => {
    const meta: ExpenseMeta = { accountId: "acc-x", recipientName: "محمد" };
    const encoded = encodeExpenseNotes("بيان", meta);
    const { cleanNotes, meta: decoded } = decodeExpenseNotes(encoded);
    expect(cleanNotes).toBe("بيان");
    expect(decoded.accountId).toBe("acc-x");
    expect(decoded.recipientName).toBe("محمد");
  });

  it("returns empty notes for null", () => {
    const result = decodeExpenseNotes(null);
    expect(result.cleanNotes).toBe("");
    expect(result.meta).toEqual({});
  });

  it("strips existing meta when re-encoding", () => {
    const first = encodeExpenseNotes("ملاحظة", { accountId: "acc-1" });
    const second = encodeExpenseNotes(first, { accountId: "acc-2" });
    const { meta } = decodeExpenseNotes(second);
    expect(meta.accountId).toBe("acc-2");
    // should not contain "acc-1"
    expect(second.match(/acc-1/g)).toBeNull();
  });

  it("handles notes without meta", () => {
    const { cleanNotes, meta } = decodeExpenseNotes("ملاحظة عادية بدون meta");
    expect(cleanNotes).toBe("ملاحظة عادية بدون meta");
    expect(meta).toEqual({});
  });

  it("handles corrupted meta gracefully", () => {
    const notes = "بيان <!--seg_meta:NOT_JSON-->";
    const { cleanNotes } = decodeExpenseNotes(notes);
    expect(cleanNotes).toContain("بيان");
  });
});

describe("computeNextDueDate", () => {
  it("daily adds 1 day", () => {
    const result = computeNextDueDate("daily", 1, "2026-06-15");
    expect(result).toBe("2026-06-16");
  });

  it("weekly adds 7 days", () => {
    const result = computeNextDueDate("weekly", 1, "2026-06-15");
    expect(result).toBe("2026-06-22");
  });

  it("yearly adds 1 year", () => {
    const result = computeNextDueDate("yearly", 1, "2026-06-15");
    expect(result).toBe("2027-06-15");
  });

  it("monthly schedules for next month if day already passed", () => {
    const result = computeNextDueDate("monthly", 1, "2026-06-15");
    // day 1 < 15 so next month
    const date = new Date(result);
    expect(date.getMonth()).toBe(6); // July
  });

  it("monthly schedules same month if day not yet passed", () => {
    const result = computeNextDueDate("monthly", 28, "2026-06-15");
    const date = new Date(result);
    expect(date.getDate()).toBe(28);
  });

  it("monthly caps day at 28", () => {
    const result = computeNextDueDate("monthly", 31, "2026-01-01");
    const date = new Date(result);
    expect(date.getDate()).toBeLessThanOrEqual(28);
  });
});

describe("checkRecurringStatus", () => {
  function makeRecurring(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
    return {
      id: "rec-1", title: "إيجار", amount: 12000, category: "rent",
      accountId: "acc-1", frequency: "monthly", dayOfMonth: 1,
      startDate: "2026-01-01", nextDueDate: "2026-06-01",
      autoApprove: false, active: true, createdAt: "2026-01-01",
      ...overrides,
    };
  }

  it("returns overdue when nextDueDate is in the past", () => {
    const result = checkRecurringStatus(makeRecurring({ nextDueDate: "2026-01-01" }));
    expect(result.isOverdue).toBe(true);
    expect(result.isDue).toBe(true);
    expect(result.badgeTone).toBe("danger");
  });

  it("returns due today when nextDueDate is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = checkRecurringStatus(makeRecurring({ nextDueDate: today }));
    expect(result.isDue).toBe(true);
    expect(result.isOverdue).toBe(false);
    expect(result.badgeTone).toBe("danger");
  });

  it("returns safe when far in future", () => {
    const result = checkRecurringStatus(makeRecurring({ nextDueDate: "2099-12-31" }));
    expect(result.isDue).toBe(false);
    expect(result.badgeTone).toBe("success");
  });

  it("returns muted when inactive", () => {
    const result = checkRecurringStatus(makeRecurring({ active: false }));
    expect(result.isDue).toBe(false);
    expect(result.badgeTone).toBe("muted");
    expect(result.badgeText).toBe("معطل");
  });

  it("returns warning when due within 3 days", () => {
    const today = new Date();
    today.setDate(today.getDate() + 2);
    const result = checkRecurringStatus(makeRecurring({ nextDueDate: today.toISOString().slice(0, 10) }));
    expect(result.isDue).toBe(true);
    expect(result.badgeTone).toBe("warning");
  });
});

describe("advanceDueDate", () => {
  it("monthly advances by 1 month", () => {
    const item = { frequency: "monthly" as const, dayOfMonth: 15 };
    const result = advanceDueDate(item, new Date("2026-06-15"));
    expect(result).toBe("2026-07-15");
  });

  it("weekly advances by 7 days", () => {
    const item = { frequency: "weekly" as const };
    const result = advanceDueDate(item, new Date("2026-06-15"));
    expect(result).toBe("2026-06-22");
  });

  it("daily advances by 1 day", () => {
    const item = { frequency: "daily" as const };
    const result = advanceDueDate(item, new Date("2026-06-15"));
    expect(result).toBe("2026-06-16");
  });

  it("yearly advances by 1 year", () => {
    const item = { frequency: "yearly" as const };
    const result = advanceDueDate(item, new Date("2026-06-15"));
    expect(result).toBe("2027-06-15");
  });
});

describe("budgetKey", () => {
  it("generates key from category only", () => {
    expect(budgetKey({ category: "rent" })).toBe("rent::all::all");
  });

  it("includes branchId and costCenter", () => {
    expect(budgetKey({ category: "rent", branchId: "br-1", costCenter: "ops" })).toBe("rent::br-1::ops");
  });
});

describe("calculateBudgetStatus", () => {
  function expense(category: string, amount: number, date: string): Expense {
    return {
      id: `e-${Math.random()}`, amount, category,
      expenseDate: date, notes: null, createdAt: date,
    } as Expense;
  }

  it("returns safe when spending is below threshold", () => {
    const budgets: CategoryBudget[] = [{ category: "rent", monthlyLimit: 15000, warnThresholdPct: 80 }];
    const expenses = [expense("rent", 10000, "2026-06-01")];
    const result = calculateBudgetStatus(budgets, expenses, "2026-06");
    expect(result[0].status).toBe("safe");
    expect(result[0].percentage).toBeCloseTo(66.67, 0);
  });

  it("returns warning when spending above threshold", () => {
    const budgets: CategoryBudget[] = [{ category: "rent", monthlyLimit: 15000, warnThresholdPct: 80 }];
    const expenses = [expense("rent", 13000, "2026-06-01")];
    const result = calculateBudgetStatus(budgets, expenses, "2026-06");
    expect(result[0].status).toBe("warning");
  });

  it("returns exceeded when spending >= limit", () => {
    const budgets: CategoryBudget[] = [{ category: "rent", monthlyLimit: 15000, warnThresholdPct: 80 }];
    const expenses = [expense("rent", 15000, "2026-06-01")];
    const result = calculateBudgetStatus(budgets, expenses, "2026-06");
    expect(result[0].status).toBe("exceeded");
    expect(result[0].remaining).toBe(0);
  });

  it("only counts expenses from target month", () => {
    const budgets: CategoryBudget[] = [{ category: "rent", monthlyLimit: 15000, warnThresholdPct: 80 }];
    const expenses = [
      expense("rent", 20000, "2026-05-01"),
      expense("rent", 5000, "2026-06-01"),
    ];
    const result = calculateBudgetStatus(budgets, expenses, "2026-06");
    expect(result[0].spent).toBe(5000);
  });

  it("handles no expenses", () => {
    const budgets: CategoryBudget[] = [{ category: "rent", monthlyLimit: 15000, warnThresholdPct: 80 }];
    const result = calculateBudgetStatus(budgets, [], "2026-06");
    expect(result[0].spent).toBe(0);
    expect(result[0].status).toBe("safe");
    expect(result[0].remaining).toBe(15000);
  });
});

describe("tafqeetArabic", () => {
  it("converts 0", () => {
    const result = tafqeetArabic(0);
    expect(result).toContain("صفر");
    expect(result).toContain("لا غير");
  });

  it("converts small number", () => {
    const result = tafqeetArabic(5);
    expect(result).toContain("خمسة");
  });

  it("converts hundreds", () => {
    const result = tafqeetArabic(250);
    expect(result).toContain("مئتان");
    expect(result).toContain("خمسون");
  });

  it("converts thousands", () => {
    const result = tafqeetArabic(1500);
    expect(result).toContain("ألف");
  });

  it("converts with decimal part (qirsh)", () => {
    const result = tafqeetArabic(10.50);
    expect(result).toContain("قرش");
  });

  it("returns empty for negative", () => {
    expect(tafqeetArabic(-100)).toBe("");
  });

  it("returns empty for NaN", () => {
    expect(tafqeetArabic(NaN)).toBe("");
  });

  it("uses custom currency name", () => {
    const result = tafqeetArabic(100.5, "دولار", "سنت");
    expect(result).toContain("دولار");
    expect(result).toContain("سنت");
  });

  it("handles large numbers (millions)", () => {
    const result = tafqeetArabic(1500000);
    expect(result).toContain("مليون");
  });

  it("handles 11 and 12 specially", () => {
    const result11 = tafqeetArabic(11);
    expect(result11).toContain("أحد عشر");
    const result12 = tafqeetArabic(12);
    expect(result12).toContain("اثنا عشر");
  });
});