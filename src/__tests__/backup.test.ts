import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateBackupJson,
  validateBackupDeep,
  remapBackupIds,
  isAutoBackupDue,
  type BackupPayload,
} from "@/lib/backup";

const LS: Record<string, string> = {};
beforeEach(() => {
  Object.keys(LS).forEach((k) => delete LS[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => LS[k] ?? null,
    setItem: (k: string, v: string) => { LS[k] = v; },
  });
});


function validBackup(overrides: Partial<Omit<BackupPayload, "version">> & { version?: number } = {}): BackupPayload {
  return {
    app: "segilly",
    version: 2,
    exportedAt: "2026-06-15T00:00:00.000Z",
    tables: { customers: [{ id: "c1", name: "محمد" }], invoices: [] },
    ...overrides,
  } as BackupPayload;
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

describe("validateBackupDeep", () => {
  const deep = (tables: Record<string, unknown[]>) => validateBackupDeep({
    app: "segilly",
    version: 2,
    exportedAt: "2026-06-15T00:00:00.000Z",
    tables,
  });

  it("accepts a clean payload with counts", () => {
    const r = deep({
      customers: [{ id: "c1", name: "أ" }],
      invoices: [{ id: "i1", customer_id: "c1" }],
      invoice_items: [{ id: "ii1", invoice_id: "i1" }],
    });
    expect(r.valid).toBe(true);
    expect(r.tableCount).toBe(3);
    expect(r.totalRows).toBe(3);
    expect(r.errors).toEqual([]);
  });

  it("rejects unknown tables", () => {
    const r = deep({ customers: [], evil_table: [{ id: "x" }] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("evil_table");
  });

  it("rejects rows without ids and duplicate ids", () => {
    const r = deep({ customers: [{ name: "x" }, { id: "c1" }, { id: "c1" }] });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects child rows pointing at missing parents", () => {
    const r = deep({
      customers: [{ id: "c1" }],
      invoices: [{ id: "i1", customer_id: "ghost" }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("invoices");
  });

  it("rejects oversized payloads", () => {
    const rows = Array.from({ length: 20001 }, (_, i) => ({ id: `c${i}` }));
    const r = deep({ customers: rows });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("كبير");
  });

  it("provides first error as error for dialog compat", () => {
    const r = validateBackupDeep(null);
    expect(r.valid).toBe(false);
    expect(typeof r.error).toBe("string");
  });
});

describe("remapBackupIds", () => {
  it("gives every row a fresh id and rewrites mapped foreign keys", () => {
    const out = remapBackupIds({
      customers: [{ id: "c1", name: "أ", user_id: "u1", created_at: "x" }],
      invoices: [{ id: "i1", customer_id: "c1" }],
      invoice_items: [{ id: "ii1", invoice_id: "i1" }],
    });
    const newCustomerId = out.customers[0].id as string;
    expect(newCustomerId).not.toBe("c1");
    expect(out.invoices[0].id).not.toBe("i1");
    expect(out.invoices[0].customer_id).toBe(newCustomerId);
    expect(out.invoice_items[0].invoice_id).toBe(out.invoices[0].id);
    expect(out.customers[0].user_id).toBeUndefined();
    expect(out.customers[0].created_at).toBeUndefined();
  });

  it("keeps unmapped references untouched", () => {
    const out = remapBackupIds({
      shipments: [{ id: "s1", tracking_number: "T1" }],
    });
    expect(out.shipments[0].id).not.toBe("s1");
    expect(out.shipments[0].tracking_number).toBe("T1");
  });

  it("skips non-object rows", () => {
    const out = remapBackupIds({ customers: [null, { id: "c1" }] as unknown[] });
    expect(out.customers).toHaveLength(1);
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
