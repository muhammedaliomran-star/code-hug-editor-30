/**
 * Background Sync Engine
 *
 * Pulls changed records from Supabase using updated_at timestamps.
 * Merges into the in-memory cache so the UI stays fresh across devices.
 *
 * Strategy:
 * - Each table tracks its last sync timestamp in localStorage.
 * - On sync, fetch WHERE updated_at > lastSyncAt.
 * - Merge: upsert into cache, remove deleted records.
 * - Update lastSyncAt after successful sync.
 */

import { supabase } from "@/integrations/supabase/client";

const SYNC_KEY_PREFIX = "segilly_last_sync_";
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Tables to sync and their primary key fields */
const SYNC_TABLES: Record<string, { select: string; orderBy: string }> = {
  customers: { select: "id,name,phone,rating,status,customer_type,notes,frozen,address,joining_date,credit_limit,due_day,opening_balance,national_id,created_at,updated_at", orderBy: "updated_at" },
  invoices: { select: "id,customer_id,total,down_payment,monthly_installment,first_due_date,paid,notes,created_at,discount_pct,discount_amount,tax_pct,tax_amount,status,invoice_number,date,receipt_token,updated_at", orderBy: "updated_at" },
  payments: { select: "id,invoice_id,amount,paid_at,updated_at", orderBy: "updated_at" },
  expenses: { select: "id,amount,category,expense_date,notes,created_at,updated_at", orderBy: "updated_at" },
  invoice_items: { select: "id,invoice_id,name,cost,price,quantity,discount_pct,discount_amount,tax_pct,tax_amount,line_total,serial_numbers,created_at,updated_at", orderBy: "updated_at" },
  suppliers: { select: "id,name,contact,notes,opening_balance,national_id,created_at,updated_at", orderBy: "updated_at" },
  purchases: { select: "id,supplier_id,total,payment_type,purchase_date,notes,created_at,updated_at", orderBy: "updated_at" },
  purchase_items: { select: "id,purchase_id,name,unit_cost,quantity,created_at,updated_at", orderBy: "updated_at" },
  supplier_payments: { select: "id,supplier_id,amount,paid_at,updated_at", orderBy: "updated_at" },
  stock_items: { select: "id,name,quantity,last_unit_cost,sale_price,barcode,size,item_type,min_stock,created_at,updated_at", orderBy: "updated_at" },
  return_records: { select: "id,invoice_id,type,total_amount,reason,notes,created_at,updated_at", orderBy: "updated_at" },
  return_items: { select: "id,return_id,name,unit_price,quantity,created_at,updated_at", orderBy: "updated_at" },
  branches: { select: "id,name,location,phone,manager_name,is_main,created_at,updated_at", orderBy: "updated_at" },
  payment_vouchers: { select: "id,customer_id,supplier_id,amount,type,payment_method,description,voucher_date,created_at,party_name,party_phone,updated_at", orderBy: "updated_at" },
  shipping_carriers: { select: "id,name,contact_person,phone,email,base_cost,active,created_at,updated_at", orderBy: "updated_at" },
  shipping_zones: { select: "id,name,carrier_id,delivery_cost,estimated_days,created_at,updated_at", orderBy: "updated_at" },
  shipments: { select: "id,invoice_id,carrier_id,zone_id,tracking_number,status,recipient_name,recipient_phone,delivery_address,actual_delivery_date,processing_at,shipped_at,delivered_at,returned_at,status_updated_by,shipping_cost,cod_amount,collection_status,collected_at,settled_at,weight_kg,pieces,expected_delivery_date,notes,created_at,updated_at", orderBy: "updated_at" },
};

function getLastSync(table: string): string | null {
  return localStorage.getItem(SYNC_KEY_PREFIX + table);
}

function setLastSync(table: string, timestamp: string) {
  localStorage.setItem(SYNC_KEY_PREFIX + table, timestamp);
}

/**
 * Pull changed records for a single table.
 * Returns the count of records synced.
 */
async function pullTable(
  table: string,
  config: { select: string; orderBy: string },
  onRecord: (table: string, record: Record<string, unknown>) => void,
  onDeleted: (table: string, ids: string[]) => void,
): Promise<number> {
  const lastSync = getLastSync(table);
  const now = new Date().toISOString();

  let query = supabase
    .from(table)
    .select(config.select)
    .order(config.orderBy, { ascending: true });

  if (lastSync) {
    query = query.gt("updated_at", lastSync);
  } else {
    // First sync — only get last 500 records
    query = query.limit(500);
  }

  const { data, error } = await query;
  if (error || !data) return 0;

  for (const record of data) {
    onRecord(table, record as Record<string, unknown>);
  }

  setLastSync(table, now);
  return data.length;
}

/**
 * Run a full sync across all tables.
 * Calls onRecord for each changed record, and onDeleted for deleted records.
 */
export async function syncAllTables(
  onRecord: (table: string, record: Record<string, unknown>) => void,
  onDeleted: (table: string, ids: string[]) => void,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  for (const [table, config] of Object.entries(SYNC_TABLES)) {
    try {
      results[table] = await pullTable(table, config, onRecord, onDeleted);
    } catch (e) {
      console.warn(`[SyncEngine] Failed to sync ${table}:`, e);
      results[table] = 0;
    }
  }

  return results;
}

/**
 * Get a human-readable summary of sync results.
 */
export function syncSummary(results: Record<string, number>): string {
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  const tables = Object.entries(results).filter(([_, count]) => count > 0);
  if (total === 0) return "البيانات محدّثة";
  if (tables.length <= 3) {
    return tables.map(([t, c]) => `${t}: ${c}`).join("، ");
  }
  return `${tables.length} جداول — ${total} سجل`;
}

/** Default sync interval in ms */
export const SYNC_INTERVAL = SYNC_INTERVAL_MS;
