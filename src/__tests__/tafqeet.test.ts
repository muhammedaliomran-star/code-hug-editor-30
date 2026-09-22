import { describe, it, expect } from "vitest";
import { numberToArabicWords, tafqeetCurrency } from "@/lib/tafqeet";

describe("numberToArabicWords", () => {
  it("converts 0", () => {
    expect(numberToArabicWords(0)).toBe("صفر");
  });

  it("converts 1", () => {
    expect(numberToArabicWords(1)).toBe("واحد");
  });

  it("converts 5", () => {
    expect(numberToArabicWords(5)).toBe("خمسة");
  });

  it("converts 10", () => {
    expect(numberToArabicWords(10)).toBe("عشرة");
  });

  it("converts 11", () => {
    expect(numberToArabicWords(11)).toBe("أحد عشر");
  });

  it("converts 12", () => {
    expect(numberToArabicWords(12)).toBe("اثنا عشر");
  });

  it("converts 15", () => {
    expect(numberToArabicWords(15)).toBe("خمسة عشر");
  });

  it("converts 20", () => {
    expect(numberToArabicWords(20)).toBe("عشرون");
  });

  it("converts 21", () => {
    expect(numberToArabicWords(21)).toBe("واحد وعشرون");
  });

  it("converts 30", () => {
    expect(numberToArabicWords(30)).toBe("ثلاثون");
  });

  it("converts 99", () => {
    expect(numberToArabicWords(99)).toBe("تسعة وتسعون");
  });

  it("converts 100", () => {
    expect(numberToArabicWords(100)).toBe("مائة");
  });

  it("converts 200", () => {
    expect(numberToArabicWords(200)).toBe("مائتان");
  });

  it("converts 555", () => {
    expect(numberToArabicWords(555)).toBe("خمسمائة وخمسة وخمسون");
  });

  it("converts 999", () => {
    expect(numberToArabicWords(999)).toBe("تسعمائة وتسعة وتسعون");
  });

  it("converts 1000", () => {
    expect(numberToArabicWords(1000)).toBe("ألف");
  });

  it("converts 2000", () => {
    expect(numberToArabicWords(2000)).toBe("ألفان");
  });

  it("converts 5000", () => {
    expect(numberToArabicWords(5000)).toBe("خمسة آلاف");
  });

  it("converts 15000", () => {
    expect(numberToArabicWords(15000)).toBe("خمسة عشر ألف");
  });

  it("converts 100000", () => {
    expect(numberToArabicWords(100000)).toBe("مائة ألف");
  });

  it("converts 1500000", () => {
    expect(numberToArabicWords(1500000)).toContain("مليون");
  });

  it("converts 1000000000", () => {
    expect(numberToArabicWords(1000000000)).toBe("مليار");
  });

  it("handles NaN", () => {
    expect(numberToArabicWords(NaN)).toBe("");
  });

  it("handles negative numbers by converting absolute", () => {
    expect(numberToArabicWords(-5)).toContain("خمسة");
  });
});

describe("tafqeetCurrency", () => {
  it("converts 0", () => {
    const result = tafqeetCurrency(0);
    expect(result).toContain("صفر");
    expect(result).toContain("لا غير");
  });

  it("converts integer amount", () => {
    const result = tafqeetCurrency(1500);
    expect(result).toContain("ألف");
    expect(result).toContain("جنيه مصري");
    expect(result).toContain("لا غير");
  });

  it("converts amount with decimal (qirsh)", () => {
    const result = tafqeetCurrency(10.50);
    expect(result).toContain("عشرة");
    expect(result).toContain("قرش");
  });

  it("uses custom currency", () => {
    const result = tafqeetCurrency(100.5, "دولار", "سنت");
    expect(result).toContain("دولار");
    expect(result).toContain("سنت");
    expect(result).not.toContain("جنيه");
  });

  it("prefix includes فقط وقدره", () => {
    const result = tafqeetCurrency(50);
    expect(result).toMatch(/^فقط وقدره/);
  });

  it("handles large amount", () => {
    const result = tafqeetCurrency(1500000);
    expect(result).toContain("مليون");
  });

  it("handles decimal only (0.50)", () => {
    const result = tafqeetCurrency(0.50);
    expect(result).toContain("قرش");
  });

  it("handles exact 1.00", () => {
    const result = tafqeetCurrency(1);
    expect(result).toContain("واحد");
    expect(result).toContain("جنيه مصري");
  });
});