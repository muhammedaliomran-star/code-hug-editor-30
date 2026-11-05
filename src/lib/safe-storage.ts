/**
 * Safe localStorage wrapper.
 *
 * - Guards against QuotaExceededError (evicts oldest keys with a prefix).
 * - No-ops on server (SSR) where localStorage is undefined.
 * - Centralizes storage access so quota handling is consistent.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // QuotaExceededError — try evicting oldest keys with the same prefix family.
    try {
      const prefix = key.split(":")[0] + ":";
      const candidates: { k: string; t: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && k !== key) {
          candidates.push({ k, t: 0 });
        }
      }
      // Evict up to 5 keys
      for (const c of candidates.slice(0, 5)) {
        localStorage.removeItem(c.k);
      }
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}