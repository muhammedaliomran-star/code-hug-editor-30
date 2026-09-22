import { openDB, type IDBPDatabase } from "idb";

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
  customers: any[];
  invoices: any[];
  payments: any[];
  expenses: any[];
  invoiceItems: any[];
  suppliers: any[];
  purchases: any[];
  purchaseItems: any[];
  supplierPayments: any[];
  stockItems: any[];
  warehouseItems: any[];
  returns: any[];
  returnItems: any[];
  branches: any[];
  paymentVouchers: any[];
  carriers: any[];
  zones: any[];
  shipments: any[];
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
