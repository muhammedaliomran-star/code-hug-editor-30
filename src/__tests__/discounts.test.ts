import { describe, it, expect } from "vitest";
import {
  getCouponStatus,
  generatePromoWhatsAppText,
  evaluateMarginSafety,
  evaluateAutoOffers,
  validateCouponCode,
  type PromoCoupon,
  type QuantityTierOffer,
  type BundleComboOffer,
  type MarginGuardConfig,
} from "@/lib/discounts";

function makeCoupon(overrides: Partial<PromoCoupon> = {}): PromoCoupon {
  return {
    id: "coupon-1",
    code: "TEST20",
    title: "عرض اختبار",
    discountType: "percentage",
    discountValue: 20,
    minOrderValue: 0,
    maxUsage: 100,
    usedCount: 5,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    active: true,
    customerEligibility: "all",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeQtyOffer(overrides: Partial<QuantityTierOffer> = {}): QuantityTierOffer {
  return {
    id: "qty-1",
    title: "خصم الكميات 3 قطع",
    minQuantity: 3,
    discountPercentage: 10,
    active: true,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<BundleComboOffer> = {}): BundleComboOffer {
  return {
    id: "bundle-1",
    title: "عرض باقة",
    itemKeywords: ["هاتف", "سماعة"],
    discountAmount: 100,
    active: true,
    ...overrides,
  };
}

const MARGIN_GUARD: MarginGuardConfig = { enabled: true, minMarginPct: 10 };

describe("getCouponStatus", () => {
  it("returns active for valid coupon", () => {
    const result = getCouponStatus(makeCoupon());
    expect(result.status).toBe("active");
    expect(result.color).toBe("success");
  });

  it("returns inactive when active=false", () => {
    const result = getCouponStatus(makeCoupon({ active: false }));
    expect(result.status).toBe("inactive");
    expect(result.color).toBe("muted");
  });

  it("returns expired when endsAt is in the past", () => {
    const result = getCouponStatus(makeCoupon({
      endsAt: new Date(Date.now() - 86400000).toISOString(),
    }));
    expect(result.status).toBe("expired");
    expect(result.color).toBe("warning");
  });

  it("returns inactive when startsAt is in the future", () => {
    const result = getCouponStatus(makeCoupon({
      startsAt: new Date(Date.now() + 86400000).toISOString(),
    }));
    expect(result.status).toBe("inactive");
  });

  it("returns exhausted when usedCount >= maxUsage", () => {
    const result = getCouponStatus(makeCoupon({ maxUsage: 10, usedCount: 10 }));
    expect(result.status).toBe("exhausted");
    expect(result.color).toBe("danger");
  });

  it("returns active when maxUsage is null (unlimited)", () => {
    const result = getCouponStatus(makeCoupon({ maxUsage: null, usedCount: 9999 }));
    expect(result.status).toBe("active");
  });
});

describe("generatePromoWhatsAppText", () => {
  it("generates text with percentage discount", () => {
    const coupon = makeCoupon({ discountType: "percentage", discountValue: 20 });
    const text = generatePromoWhatsAppText(coupon);
    expect(text).toContain("TEST20");
    expect(text).toContain("20%");
  });

  it("generates text with fixed discount", () => {
    const text = generatePromoWhatsAppText(makeCoupon({ discountType: "fixed", discountValue: 50 }));
    expect(text).toContain("50");
  });

  it("includes minimum order when set", () => {
    const text = generatePromoWhatsAppText(makeCoupon({ minOrderValue: 500 }));
    expect(text).toContain("500");
  });

  it("does not include minimum order when 0", () => {
    const text = generatePromoWhatsAppText(makeCoupon({ minOrderValue: 0 }));
    expect(text).not.toContain("الحد الأدنى");
  });

  it("includes expiry date when endsAt is set", () => {
    const text = generatePromoWhatsAppText(makeCoupon({ endsAt: "2026-12-31T00:00:00.000Z" }));
    expect(text).toContain("يسري العرض حتى");
  });

  it("uses custom shop name", () => {
    const text = generatePromoWhatsAppText(makeCoupon(), "متجري");
    expect(text).toContain("متجري");
  });
});

describe("evaluateMarginSafety", () => {
  it("returns safe when margin is above threshold", () => {
    const result = evaluateMarginSafety(10000, 5000, 0, MARGIN_GUARD);
    expect(result.isSafe).toBe(true);
    expect(result.profit).toBe(5000);
    expect(result.profitMarginPct).toBe(50);
  });

  it("returns safe when discount keeps margin above threshold", () => {
    const result = evaluateMarginSafety(10000, 8500, 500, MARGIN_GUARD);
    expect(result.isSafe).toBe(true);
  });

  it("returns unsafe when profit is negative (loss)", () => {
    const result = evaluateMarginSafety(10000, 12000, 0, MARGIN_GUARD);
    expect(result.isSafe).toBe(false);
    expect(result.profit).toBe(-2000);
    expect(result.warning).toContain("خسارة مباشرة");
  });

  it("returns unsafe when margin is below minMarginPct", () => {
    const result = evaluateMarginSafety(10000, 9200, 0, MARGIN_GUARD);
    expect(result.isSafe).toBe(false);
    expect(result.profitMarginPct).toBeCloseTo(8, 0);
    expect(result.warning).toContain("تنبيه حماية الربح");
  });

  it("calculates maxSafeDiscount correctly", () => {
    const result = evaluateMarginSafety(10000, 8000, 0, MARGIN_GUARD);
    expect(result.maxSafeDiscount).toBeCloseTo(1111.1, 0);
  });

  it("always safe when marginGuard is disabled", () => {
    const result = evaluateMarginSafety(10000, 12000, 0, { enabled: false, minMarginPct: 10 });
    expect(result.isSafe).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("always safe when subtotal is 0", () => {
    const result = evaluateMarginSafety(0, 5000, 0, MARGIN_GUARD);
    expect(result.isSafe).toBe(true);
  });

  it("always safe when cost is 0", () => {
    const result = evaluateMarginSafety(10000, 0, 0, MARGIN_GUARD);
    expect(result.isSafe).toBe(true);
  });

  it("discount cannot make finalPrice negative", () => {
    const result = evaluateMarginSafety(5000, 3000, 10000, MARGIN_GUARD);
    expect(result.profit).toBe(-3000);
  });
});

describe("evaluateAutoOffers", () => {
  const qtyOffers = [
    makeQtyOffer({ id: "q1", minQuantity: 3, discountPercentage: 5, active: true }),
    makeQtyOffer({ id: "q2", minQuantity: 5, discountPercentage: 10, active: true }),
  ];
  const bundles = [makeBundle({ id: "b1", itemKeywords: ["هاتف", "سماعة"], discountAmount: 100, active: true })];

  it("applies quantity discount for item meeting threshold", () => {
    const result = evaluateAutoOffers([{ name: "هاتف", price: 5000, quantity: 3 }], qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(750);
    expect(result.appliedOffers[0].type).toBe("qty");
  });

  it("applies highest matching quantity discount", () => {
    const result = evaluateAutoOffers([{ name: "هاتف", price: 5000, quantity: 5 }], qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(2500);
    expect(result.appliedOffers[0].id).toBe("q2");
  });

  it("applies bundle discount when all keywords match", () => {
    const items = [
      { name: "هاتف ذكي", price: 10000, quantity: 1 },
      { name: "سماعة لاسلكية", price: 2000, quantity: 1 },
    ];
    const result = evaluateAutoOffers(items, qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(100);
    expect(result.appliedOffers.some((o) => o.type === "bundle")).toBe(true);
  });

  it("does not apply bundle if only one keyword matches", () => {
    const result = evaluateAutoOffers([{ name: "هاتف ذكي", price: 10000, quantity: 1 }], qtyOffers, bundles);
    expect(result.appliedOffers.some((o) => o.type === "bundle")).toBe(false);
  });

  it("combines qty + bundle discounts", () => {
    const items = [
      { name: "هاتف", price: 5000, quantity: 5 },
      { name: "سماعة", price: 1000, quantity: 1 },
    ];
    const result = evaluateAutoOffers(items, qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(2600);
  });

  it("skips items with quantity 0", () => {
    const result = evaluateAutoOffers([{ name: "هاتف", price: 5000, quantity: 0 }], qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(0);
  });

  it("skips items with price 0", () => {
    const result = evaluateAutoOffers([{ name: "هاتف", price: 0, quantity: 10 }], qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(0);
  });

  it("returns 0 for empty items", () => {
    const result = evaluateAutoOffers([], qtyOffers, bundles);
    expect(result.suggestedDiscountAmount).toBe(0);
    expect(result.appliedOffers).toHaveLength(0);
  });

  it("ignores inactive offers", () => {
    const inactive = [makeQtyOffer({ id: "q-in", minQuantity: 3, discountPercentage: 50, active: false })];
    const result = evaluateAutoOffers([{ name: "هاتف", price: 5000, quantity: 5 }], inactive, []);
    expect(result.suggestedDiscountAmount).toBe(0);
  });

  it("is case-insensitive for bundle keyword matching", () => {
    const b = [makeBundle({ id: "b-case", itemKeywords: ["هاتف"], discountAmount: 50, active: true })];
    const result = evaluateAutoOffers([{ name: "الهاتف الذكي", price: 1000, quantity: 1 }], [], b);
    expect(result.suggestedDiscountAmount).toBe(50);
  });
});

describe("validateCouponCode", () => {
  const now = new Date();
  const activeCoupon = makeCoupon({
    code: "ACTIVE20",
    discountType: "percentage",
    discountValue: 20,
    minOrderValue: 100,
    active: true,
    startsAt: new Date(now.getTime() - 86400000).toISOString(),
    endsAt: new Date(now.getTime() + 86400000).toISOString(),
    maxUsage: 50,
    usedCount: 10,
    customerEligibility: "all",
  });

  it("validates a correct active coupon", () => {
    const result = validateCouponCode("ACTIVE20", 500, [activeCoupon]);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(100);
    expect(result.discountPct).toBe(20);
  });

  it("returns invalid for empty code", () => {
    const result = validateCouponCode("", 500, [activeCoupon]);
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("يرجى كتابة");
  });

  it("returns invalid for non-existent code", () => {
    const result = validateCouponCode("NOPE99", 500, [activeCoupon]);
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("غير موجود");
  });

  it("code matching is case-insensitive", () => {
    const result = validateCouponCode("active20", 500, [activeCoupon]);
    expect(result.valid).toBe(true);
  });

  it("returns invalid for expired coupon", () => {
    const expired = makeCoupon({ code: "EXP", endsAt: new Date(now.getTime() - 86400000).toISOString(), active: true });
    const result = validateCouponCode("EXP", 500, [expired]);
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("انتهت فترة الصلاحية");
  });

  it("returns invalid for inactive coupon", () => {
    const result = validateCouponCode("OFF", 500, [makeCoupon({ code: "OFF", active: false })]);
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("معطل");
  });

  it("returns invalid for exhausted coupon", () => {
    const result = validateCouponCode("EXH", 500, [makeCoupon({ code: "EXH", maxUsage: 10, usedCount: 10 })]);
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("استنفاد");
  });

  it("returns invalid when subtotal below minOrderValue", () => {
    const result = validateCouponCode("ACTIVE20", 50, [activeCoupon]);
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("الحد الأدنى");
  });

  it("calculates correct fixed discount", () => {
    const fixed = makeCoupon({ code: "FIX10", discountType: "fixed", discountValue: 100, minOrderValue: 0 });
    const result = validateCouponCode("FIX10", 500, [fixed]);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(100);
    expect(result.discountPct).toBe(20);
  });

  it("fixed discount cannot exceed subtotal", () => {
    const fixed = makeCoupon({ code: "FIXBIG", discountType: "fixed", discountValue: 500, minOrderValue: 0 });
    const result = validateCouponCode("FIXBIG", 200, [fixed]);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(200);
  });

  it("rejects VIP coupon for non-VIP customer", () => {
    const vip = makeCoupon({ code: "VIP20", customerEligibility: "vip" });
    const result = validateCouponCode("VIP20", 500, [vip], "installment");
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("الفئة المميزة");
  });

  it("allows VIP coupon for VIP customer", () => {
    const vip = makeCoupon({ code: "VIP20", customerEligibility: "vip" });
    const result = validateCouponCode("VIP20", 500, [vip], "vip");
    expect(result.valid).toBe(true);
  });

  it("allows VIP coupon for committed customer", () => {
    const vip = makeCoupon({ code: "VIP20", customerEligibility: "vip" });
    const result = validateCouponCode("VIP20", 500, [vip], "committed");
    expect(result.valid).toBe(true);
  });

  it("rejects cash-only coupon for installment customer", () => {
    const cash = makeCoupon({ code: "CASH10", customerEligibility: "cash" });
    const result = validateCouponCode("CASH10", 500, [cash], "installment");
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("الدفع النقدي");
  });

  it("allows cash-only coupon for cash customer", () => {
    const cash = makeCoupon({ code: "CASH10", customerEligibility: "cash" });
    const result = validateCouponCode("CASH10", 500, [cash], "cash");
    expect(result.valid).toBe(true);
  });

  it("rejects loyalty coupon locked to another customer", () => {
    const loyalty = makeCoupon({
      code: "LOYAL1", isLoyaltyReward: true, customerId: "cust-A", discountType: "fixed", discountValue: 50,
    });
    const result = validateCouponCode("LOYAL1", 500, [loyalty], undefined, "cust-B");
    expect(result.valid).toBe(false);
    expect(result.errorReason).toContain("عميل مكافآت");
  });

  it("allows loyalty coupon for correct customer", () => {
    const loyalty = makeCoupon({
      code: "LOYAL2", isLoyaltyReward: true, customerId: "cust-A", discountType: "fixed", discountValue: 50,
    });
    const result = validateCouponCode("LOYAL2", 500, [loyalty], undefined, "cust-A");
    expect(result.valid).toBe(true);
  });
});