import { openDB, type IDBPDatabase } from "idb";
import type {
  Customer,
  Invoice,
  Payment,
  Expense,
  InvoiceItem,
  Supplier,
  Purchase,
  PurchaseItem,
  SupplierPayment,
  StockItem,
  WarehouseItem,
  ReturnRecord,
  ReturnItem,
  Branch,
  PaymentVoucher,
  ShipmentCarrier,
  ShippingZone,
  Shipment,
} from "@/types";

const DB_NAME = "segilly-cache";
const DB_VERSION = 1;
const STORE_NAME = "app-cache";
const CACHE_KEY = "db-state";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export interface CachedDBState {
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  invoiceItems: InvoiceItem[];
  suppliers: Supplier[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  supplierPayments: SupplierPayment[];
  stockItems: StockItem[];
  warehouseItems: WarehouseItem[];
  returns: ReturnRecord[];
  returnItems: ReturnItem[];
  branches: Branch[];
  paymentVouchers: PaymentVoucher[];
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shipments: Shipment[];
  savedAt: number;
}

/**
 * Save the in-memory cache to IndexedDB.
 * Called after every successful fetchAll().
 */
export async function saveCacheToIDB(state: Omit<CachedDBState, "savedAt">): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, { ...state, savedAt: Date.now() }, CACHE_KEY);
  } catch (e) {
    console.warn("[IDB] Failed to save cache:", e);
  }
}

/**
 * Load the cached state from IndexedDB.
 * Returns null if no cache exists or if there's an error.
 */
export async function loadCacheFromIDB(): Promise<CachedDBState | null> {
  try {
    const db = await getDB();
    const state = await db.get(STORE_NAME, CACHE_KEY);
    if (!state) return null;
    // Expire cache after 7 days
    if (Date.now() - state.savedAt > 7 * 24 * 60 * 60 * 1000) {
      await db.delete(STORE_NAME, CACHE_KEY);
      return null;
    }
    return state;
  } catch (e) {
    console.warn("[IDB] Failed to load cache:", e);
    return null;
  }
}

/**
 * Clear the entire IndexedDB cache.
 */
export async function clearCacheFromIDB(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, CACHE_KEY);
  } catch (e) {
    console.warn("[IDB] Failed to clear cache:", e);
  }
}
