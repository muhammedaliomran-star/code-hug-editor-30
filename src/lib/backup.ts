import { supabase } from "@/integrations/supabase/client";

/** Tables owned by the signed-in user, in dependency order (parents first). */
const TABLES = [
  // Core business
  "customers",
  "suppliers",
  "invoices",
  "invoice_items",
  "payments",
  "purchases",
  "purchase_items",
  "supplier_payments",
  "stock_items",
  "stock_adjustments",
  "expenses",
  "shop_settings",
  "branches",
  "payment_vouchers",
  // Shipping
  "shipping_carriers",
  "shipping_zones",
  "shipments",
  "carrier_settlements",
  "delivery_attempts",
  // Accounting & stock
  "stock_movements",
  "audit_events",
  "audit_logs",
  "return_records",
  "return_items",
  "invoice_installments",
  // Sync tables
  "treasury_accounts",
  "treasury_manual_transactions",
  "treasury_transfers",
  "treasury_denomination_audits",
  "staff_members",
  "staff_attendance",
  "shifts",
  "collection_promises",
  "collection_call_logs",
  "held_invoices",
  "expense_metadata",
  "recurring_expenses",
  "category_budgets",
  "expense_settings",
  "promo_coupons",
  "qty_offers",
  "bundles",
  "loyalty_config",
  "licenses",
  "admin_settings",
] as const;

/** Child rows must go before their parents when deleting. */
const DELETE_ORDER = [
  "admin_settings",
  "licenses",
  "loyalty_config",
  "bundles",
  "qty_offers",
  "promo_coupons",
  "expense_settings",
  "category_budgets",
  "recurring_expenses",
  "expense_metadata",
  "held_invoices",
  "collection_call_logs",
  "collection_promises",
  "shifts",
  "staff_attendance",
  "staff_members",
  "treasury_denomination_audits",
  "treasury_transfers",
  "treasury_manual_transactions",
  "treasury_accounts",
  "invoice_installments",
  "audit_logs",
  "audit_events",
  "delivery_attempts",
  "carrier_settlements",
  "shipments",
  "shipping_zones",
  "shipping_carriers",
  "stock_movements",
  "return_items",
  "return_records",
  "payment_vouchers",
  "branches",
  "shop_settings",
  "expenses",
  "supplier_payments",
  "purchase_items",
  "purchases",
  "stock_adjustments",
  "stock_items",
  "invoice_items",
  "invoices",
  "payments",
  "customers",
  "suppliers",
] as const;

const USER_SCOPED_TABLES = new Set([
  "customers", "suppliers", "invoices", "invoice_items", "payments", "purchases", "purchase_items",
  "supplier_payments", "stock_items", "stock_adjustments", "expenses", "shop_settings", "branches",
  "payment_vouchers", "shipping_carriers", "shipping_zones", "shipments", "stock_movements",
  "audit_events", "audit_logs", "return_records", "return_items", "invoice_installments",
  "carrier_settlements", "delivery_attempts",
  // Sync tables
  "treasury_accounts", "treasury_manual_transactions", "treasury_transfers", "treasury_denomination_audits",
  "staff_members", "staff_attendance", "shifts",
  "collection_promises", "collection_call_logs", "held_invoices",
  "expense_metadata", "recurring_expenses", "category_budgets", "expense_settings",
  "promo_coupons", "qty_offers", "bundles", "loyalty_config",
  "licenses", "admin_settings",
]);

export type BackupPayload = {
  app: "segilly";
  version: 2;
  exportedAt: string;
  /** Phase 2 (#15): owner binding — informational; safety comes from id remapping. */
  exportedBy?: string | null;
  tables: Record<string, unknown[]>;
};

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("مش مسجّل دخول");
  return user.id;
}

/**
 * Phase 1 (#15): server-side owner/manager gate.
 * Fail-closed: any gate failure blocks the destructive operation.
 * Dynamic import keeps the server-function module out of unit-test bundles.
 */
async function requireBackupAccess(): Promise<void> {
  try {
    const { assertBackupAccess } = await import("./backup.functions");
    await assertBackupAccess();
  } catch (e) {
    if (e instanceof Error && /المالك أو المدير/.test(e.message)) throw e;
    throw new Error("تعذر التحقق من صلاحية النسخ — حاول مرة تانية");
  }
}

async function ownedIds(table: string, column: string, value: string | string[]) {
  const query = (supabase.from as any)(table).select("id");
  const scoped = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
  const { data, error } = await scoped;
  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

/** Reads every row the user owns and returns a portable JSON snapshot. */
export async function buildBackup(): Promise<BackupPayload> {
  const userId = await currentUserId();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    let query: any = (supabase as any).from(t).select("*");
    if (USER_SCOPED_TABLES.has(t)) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    tables[t] = data ?? [];
  }
  return { app: "segilly", version: 2, exportedAt: new Date().toISOString(), exportedBy: userId, tables };
}

export type RestoreReport = { inserted: number; skipped: number; failed: Array<{ table: string; error: string }> };

// ==================== Phase 2 (#15): deep validation + id remap ====================

/**
 * Known child → parent relations (confirmed from migrations + row shapes).
 * Used for pre-restore validation and foreign-key rewriting during id remap.
 * Tables not listed here are treated as roots (id remapped, other columns kept).
 */
const FK_MAP: Record<string, Array<{ column: string; parent: string }>> = {
  invoices: [{ column: "customer_id", parent: "customers" }],
  invoice_items: [{ column: "invoice_id", parent: "invoices" }],
  payments: [{ column: "invoice_id", parent: "invoices" }],
  purchases: [{ column: "supplier_id", parent: "suppliers" }],
  purchase_items: [{ column: "purchase_id", parent: "purchases" }],
  supplier_payments: [{ column: "supplier_id", parent: "suppliers" }],
  payment_vouchers: [
    { column: "customer_id", parent: "customers" },
    { column: "supplier_id", parent: "suppliers" },
  ],
  shipping_zones: [{ column: "carrier_id", parent: "shipping_carriers" }],
  shipments: [
    { column: "invoice_id", parent: "invoices" },
    { column: "carrier_id", parent: "shipping_carriers" },
    { column: "zone_id", parent: "shipping_zones" },
  ],
  carrier_settlements: [{ column: "carrier_id", parent: "shipping_carriers" }],
  delivery_attempts: [{ column: "shipment_id", parent: "shipments" }],
  return_records: [{ column: "invoice_id", parent: "invoices" }],
  return_items: [{ column: "return_id", parent: "return_records" }],
  invoice_installments: [{ column: "invoice_id", parent: "invoices" }],
};

const MAX_ROWS_PER_TABLE = 20000;
const MAX_TOTAL_ROWS = 100000;

export type DeepValidation = {
  valid: boolean;
  /** First error (drop-in compatible with BackupValidationResult.error). */
  error?: string;
  errors: string[];
  tableCount: number;
  totalRows: number;
};

/**
 * Structural dry run: envelope + unknown tables + id presence/uniqueness +
 * child→parent references + size caps. Pure function, writes nothing.
 */
export function validateBackupDeep(value: unknown): DeepValidation {
  const fail = (error: string): DeepValidation =>
    ({ valid: false, error, errors: [error], tableCount: 0, totalRows: 0 });
  if (!value || typeof value !== "object") return fail("الملف فارغ أو ليس كائناً");
  const payload = value as Record<string, unknown>;
  if (payload.app !== "segilly") return fail("الملف ليس نسخة احتياطية سِجلّي");
  if (![1, 2].includes(Number(payload.version))) return fail("إصدار النسخة غير مدعوم");
  if (!payload.tables || typeof payload.tables !== "object") return fail("بيانات الجداول ناقصة");
  if (!payload.exportedAt || typeof payload.exportedAt !== "string") return fail("تاريخ التصدير غير موجود");

  const errors: string[] = [];
  const seen = new Set<string>();
  const tables = payload.tables as Record<string, unknown[]>;
  const names = Object.keys(tables);
  const known = new Set<string>(TABLES);
  const idSets = new Map<string, Set<string>>();
  let totalRows = 0;

  for (const name of names) {
    const rows = tables[name];
    if (!Array.isArray(rows)) {
      errors.push(`الجدول "${name}" بياناته غير صالحة`);
      continue;
    }
    if (!known.has(name)) {
      errors.push(`جدول غير معروف: "${name}" — لن يُستورد`);
      continue;
    }
    if (rows.length > MAX_ROWS_PER_TABLE) {
      errors.push(`الجدول "${name}" كبير جداً (${rows.length} سجل — الحد ${MAX_ROWS_PER_TABLE})`);
    }
    totalRows += rows.length;
    const ids = new Set<string>();
    rows.forEach((r, i) => {
      if (!r || typeof r !== "object" || typeof (r as Record<string, unknown>).id !== "string") {
        errors.push(`سجل ${i + 1} في "${name}" بدون معرّف صالح`);
        return;
      }
      const id = (r as Record<string, unknown>).id as string;
      if (ids.has(id)) errors.push(`معرّف مكرر في "${name}"`);
      else ids.add(id);
    });
    idSets.set(name, ids);
  }
  if (totalRows > MAX_TOTAL_ROWS) {
    errors.push(`حجم النسخة كبير جداً (${totalRows} سجل — الحد ${MAX_TOTAL_ROWS})`);
  }

  // Child → parent references, only when the parent table is in the payload
  for (const [table, rels] of Object.entries(FK_MAP)) {
    const rows = tables[table];
    if (!Array.isArray(rows)) continue;
    for (const { column, parent } of rels) {
      const parentIds = idSets.get(parent);
      if (!parentIds) continue;
      for (const r of rows) {
        if (!r || typeof r !== "object") continue;
        const v = (r as Record<string, unknown>)[column];
        if (typeof v === "string" && v && !parentIds.has(v) && !seen.has(`${table}.${column}:${v}`)) {
          seen.add(`${table}.${column}:${v}`);
          errors.push(`سجل في "${table}" يشير إلى "${parent}" غير موجود في النسخة`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors[0], errors, tableCount: names.length, totalRows };
  }
  return { valid: true, errors: [], tableCount: names.length, totalRows };
}

function freshId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // fall through to manual generator
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Cross-owner safety: every restored row gets a fresh id and mapped
 * foreign keys are rewritten to the new ids. Ownership/timestamp columns
 * are stripped — the server forces user_id to the caller.
 */
export function remapBackupIds(
  tables: Record<string, unknown[]>,
): Record<string, Record<string, unknown>[]> {
  const maps = new Map<string, Map<string, string>>();
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) continue;
    const map = new Map<string, string>();
    const fresh: Record<string, unknown>[] = [];
    for (const source of rows) {
      if (!source || typeof source !== "object") continue;
      const row = { ...(source as Record<string, unknown>) };
      const oldId = typeof row.id === "string" ? row.id : null;
      const nid = freshId();
      if (oldId) map.set(oldId, nid);
      row.id = nid;
      delete row.created_at;
      delete row.updated_at;
      delete row.user_id;
      delete row.owner_id;
      fresh.push(row);
    }
    maps.set(table, map);
    out[table] = fresh;
  }
  for (const [table, rels] of Object.entries(FK_MAP)) {
    const rows = out[table];
    if (!rows) continue;
    for (const row of rows) {
      for (const { column, parent } of rels) {
        const v = row[column];
        if (typeof v === "string" && v) {
          const replacement = maps.get(parent)?.get(v);
          if (replacement) row[column] = replacement;
        }
      }
    }
  }
  return out;
}

/**
 * Restores a JSON snapshot atomically on the server:
 * gate → deep validation → id remap → single-transaction insert.
 * Nothing is written unless the whole payload validates.
 */
export async function restoreJsonBackup(value: unknown): Promise<RestoreReport> {
  await requireBackupAccess();
  const deep = validateBackupDeep(value);
  if (!deep.valid) throw new Error(deep.error ?? "ملف النسخة غير صالح");
  const payload = value as BackupPayload;
  const tables = remapBackupIds(payload.tables as Record<string, unknown[]>);
  const { restoreBackup } = await import("./backup.functions");
  let result: { ok: boolean; inserted: number; skipped: number; failed: Array<{ table: string; error: string }> };
  try {
    result = await restoreBackup({ data: { tables, exportedBy: payload.exportedBy ?? null } });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "تعذر الاسترجاع");
  }
  if (!result.ok) {
    const first = result.failed[0];
    throw new Error(first ? `${first.table}: ${first.error}` : "تعذر الاسترجاع — راجع البيانات");
  }
  return { inserted: result.inserted, skipped: result.skipped, failed: result.failed };
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadJsonBackup() {
  const backup = await buildBackup();
  downloadBlob(JSON.stringify(backup, null, 2), `segilly-backup-${stamp()}.json`, "application/json");
  return backup;
}

/** One sheet per table, opens in Excel / Google Sheets. */
export async function downloadExcelBackup() {
  const [{ utils, write }, backup] = await Promise.all([import("xlsx"), buildBackup()]);
  const wb = utils.book_new();
  for (const [name, rows] of Object.entries(backup.tables)) {
    const ws = utils.json_to_sheet(rows.length ? (rows as object[]) : [{}]);
    utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  const out = write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(out, `segilly-backup-${stamp()}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/** Row counts per table — used by the settings "data" tab. */
export async function dataCounts(): Promise<Record<string, number>> {
  const userId = await currentUserId();
  const out: Record<string, number> = {};
  await Promise.all(
    DELETE_ORDER.map(async (t) => {
      let query: any = (supabase as any).from(t).select("id", { count: "exact", head: true });
      if (USER_SCOPED_TABLES.has(t)) query = query.eq("user_id", userId);
      else query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      const { count } = await query;
      out[t] = count ?? 0;
    }),
  );
  return out;
}

/**
 * Danger zone: deletes every business record for the signed-in user (settings kept).
 * Runs as a single server transaction — any failure rolls everything back.
 */
export async function wipeAllData(): Promise<void> {
  await requireBackupAccess();
  const { wipeUserData } = await import("./backup.functions");
  try {
    await wipeUserData();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "تعذر المسح");
  }
}

export async function downloadAccountingAuditLog() {
  const userId = await currentUserId();
  const { data, error } = await supabase.from("audit_events").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  downloadBlob(JSON.stringify(data, null, 2), `audit-log-${stamp()}.json`, "application/json");
}

export async function resetInventoryStock() {
  const userId = await currentUserId();
  const { error } = await supabase.from("stock_items").update({ quantity: 0 }).eq("user_id", userId);
  if (error) throw error;
}

export async function resetCustomerOpeningBalances() {
  const userId = await currentUserId();
  const { error } = await supabase.from("customers").update({ opening_balance: 0 }).eq("user_id", userId);
  if (error) throw error;
}

// ==================== Backup Validation ====================

export type BackupValidationResult = {
  valid: boolean;
  error?: string;
  tableCount?: number;
  totalRows?: number;
};

/** Validates a JSON backup payload without restoring it. */
export function validateBackupJson(value: unknown): BackupValidationResult {
  if (!value || typeof value !== "object") {
    return { valid: false, error: "الملف فارغ أو ليس كائناً" };
  }
  const payload = value as Record<string, unknown>;

  if (payload.app !== "segilly") {
    return { valid: false, error: "الملف ليس نسخة احتياطية سِجلّي" };
  }
  if (![1, 2].includes(Number(payload.version))) {
    return { valid: false, error: "إصدار النسخة غير مدعوم" };
  }
  if (!payload.tables || typeof payload.tables !== "object") {
    return { valid: false, error: "بيانات الجداول ناقصة" };
  }
  if (!payload.exportedAt || typeof payload.exportedAt !== "string") {
    return { valid: false, error: "تاريخ التصدير غير موجود" };
  }

  const tables = payload.tables as Record<string, unknown[]>;
  const tableNames = Object.keys(tables);
  let totalRows = 0;
  for (const name of tableNames) {
    if (!Array.isArray(tables[name])) {
      return { valid: false, error: `الجدول "${name}" بياناته غير صالحة` };
    }
    totalRows += tables[name].length;
  }

  return { valid: true, tableCount: tableNames.length, totalRows };
}

// ==================== Auto Backup Executor ====================

const AUTO_BACKUP_KEY = "segilly_last_auto_backup_v1";

/** Checks if auto-backup is due and returns true if so. */
export function isAutoBackupDue(frequency: "weekly" | "monthly" | "off"): boolean {
  if (frequency === "off") return false;
  const lastRun = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!lastRun) return true;

  const last = new Date(lastRun).getTime();
  const now = Date.now();
  const diffMs = now - last;

  if (frequency === "weekly" && diffMs >= 7 * 24 * 60 * 60 * 1000) return true;
  if (frequency === "monthly" && diffMs >= 30 * 24 * 60 * 60 * 1000) return true;
  return false;
}

/** Marks auto-backup as completed. */
export function markAutoBackupDone(): void {
  localStorage.setItem(AUTO_BACKUP_KEY, new Date().toISOString());
}

/** Executes auto-backup if due. Returns the backup payload or null. */
export async function executeAutoBackup(
  frequency: "weekly" | "monthly" | "off",
): Promise<BackupPayload | null> {
  if (!isAutoBackupDue(frequency)) return null;
  try {
    const backup = await buildBackup();
    downloadBlob(
      JSON.stringify(backup, null, 2),
      `segilly-backup-${stamp()}.json`,
      "application/json",
    );
    markAutoBackupDone();
    return backup;
  } catch (e) {
    console.error("Auto-backup failed:", e);
    return null;
  }
}
