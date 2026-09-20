import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateBackupJson, isAutoBackupDue, type BackupPayload } from "@/lib/backup";

const LS: Record<string, string> = {};
beforeEach(() => {
  Object.keys(LS).forEach((k) => delete LS[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => LS[k] ?? null,
    setItem: (k: string, v: string) => { LS[k] = v; },
  });
});


function validBackup(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    app: "segilly",
    version: 2,
    exportedAt: "2026-06-15T00:00:00.000Z",
    tables: { customers: [{ id: "c1", name: "محمد" }], invoices: [] },
    ...overrides,
  };
}

describe("validateBackupJson", () => {
  it("validates a correct backup", () => {
    const result = validateBackupJson(validBackup());
    expect(result.valid).toBe(true);
    expect(result.tableCount).toBe(2);
    expect(result.totalRows).toBe(1);
  });

  it("rejects null input", () => {
    const result = validateBackupJson(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("فارغ");
  });

  it("rejects non-object input", () => {
    const result = validateBackupJson("string");
    expect(result.valid).toBe(false);
  });

  it("rejects wrong app name", () => {
    const result = validateBackupJson({ ...validBackup(), app: "other" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("سِجلّي");
  });

  it("rejects unsupported version", () => {
    const result = validateBackupJson({ ...validBackup(), version: 99 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("إصدار");
  });

  it("rejects missing tables", () => {
    const result = validateBackupJson({ app: "segilly", version: 2, exportedAt: "2026-01-01", tables: null });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("الجداول");
  });

  it("rejects missing exportedAt", () => {
    const result = validateBackupJson({ app: "segilly", version: 2, tables: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("تاريخ");
  });

  it("rejects non-array table data", () => {
    const result = validateBackupJson({
      app: "segilly", version: 2, exportedAt: "2026-01-01",
      tables: { customers: "not-array" },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("customers");
  });

  it("accepts version 1", () => {
    const result = validateBackupJson(validBackup({ version: 1 }));
    expect(result.valid).toBe(true);
  });

  it("counts total rows across tables", () => {
    const result = validateBackupJson(validBackup({
      tables: { customers: [{}, {}, {}], invoices: [{}, {}] },
    }));
    expect(result.totalRows).toBe(5);
    expect(result.tableCount).toBe(2);
  });
});

describe("isAutoBackupDue", () => {
  it("returns false when frequency is off", () => {
    expect(isAutoBackupDue("off")).toBe(false);
  });

  it("returns true when never backed up", () => {
    expect(isAutoBackupDue("weekly")).toBe(true);
  });

  it("returns false when backed up recently (weekly)", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    localStorage.setItem("segilly_last_auto_backup_v1", threeDaysAgo);
    expect(isAutoBackupDue("weekly")).toBe(false);
  });

  it("returns true when backed up > 7 days ago (weekly)", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    localStorage.setItem("segilly_last_auto_backup_v1", tenDaysAgo);
    expect(isAutoBackupDue("weekly")).toBe(true);
  });

  it("returns true when backed up > 30 days ago (monthly)", () => {
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 86400000).toISOString();
    localStorage.setItem("segilly_last_auto_backup_v1", thirtyFiveDaysAgo);
    expect(isAutoBackupDue("monthly")).toBe(true);
  });
});
