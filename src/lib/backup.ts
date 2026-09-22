import { supabase } from "@/integrations/supabase/client";
import { assertBackupAccess } from "./backup.functions";

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
 */
async function requireBackupAccess(): Promise<void> {
  try {
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
  return { app: "segilly", version: 2, exportedAt: new Date().toISOString(), tables };
}

export type RestoreReport = { inserted: number; skipped: number; failed: Array<{ table: string; error: string }> };

/** Validates and restores a JSON snapshot without allowing ownership to be imported. */
export async function restoreJsonBackup(value: unknown): Promise<RestoreReport> {
  await requireBackupAccess();
  const userId = await currentUserId();
  if (!value || typeof value !== "object") throw new Error("ملف النسخة غير صالح");
  const payload = value as Partial<BackupPayload>;
  if (payload.app !== "segilly" || ![1, 2].includes(Number(payload.version)) || !payload.tables || typeof payload.tables !== "object") {
    throw new Error("إصدار النسخة غير مدعوم أو البيانات ناقصة");
  }
  const report: RestoreReport = { inserted: 0, skipped: 0, failed: [] };
  for (const table of TABLES) {
    const rows = (payload.tables as Record<string, unknown[]>)[table];
    if (!Array.isArray(rows)) continue;
    for (const source of rows) {
      if (!source || typeof source !== "object") { report.skipped++; continue; }
      const row = { ...(source as Record<string, unknown>) };
      if ("user_id" in row) row.user_id = userId;
      delete row.created_at;
      delete row.updated_at;
      const { error } = await (supabase.from as any)(table).upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) report.failed.push({ table, error: error.message });
      else report.inserted++;
    }
  }
  return report;
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

/** Danger zone: deletes every business record for the signed-in user (settings kept). */
export async function wipeAllData() {
  await requireBackupAccess();
  const userId = await currentUserId();
  for (const t of DELETE_ORDER) {
    if (!USER_SCOPED_TABLES.has(t)) continue;
    const { error } = await (supabase as any).from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }
}

export async function downloadAccountingAuditLog() {
  const userId = await currentUserId();
  const { data, error } = await (supabase.from as any)("audit_events").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  downloadBlob(JSON.stringify(data, null, 2), `audit-log-${stamp()}.json`, "application/json");
}

export async function resetInventoryStock() {
  const userId = await currentUserId();
  const { error } = await (supabase.from as any)("stock_items").update({ quantity: 0 }).eq("user_id", userId);
  if (error) throw error;
}

export async function resetCustomerOpeningBalances() {
  const userId = await currentUserId();
  const { error } = await (supabase.from as any)("customers").update({ opening_balance: 0 }).eq("user_id", userId);
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
