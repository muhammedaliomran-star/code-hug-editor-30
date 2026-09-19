import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getShopSettings, type ShopSettings } from "./store";

const CASHIER_MODE_KEY = "segilly:cashier_mode_active";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function isCashierModeActive(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  const val = localStorage.getItem(CASHIER_MODE_KEY);
  return val === "true";
}

export function setCashierMode(active: boolean): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  localStorage.setItem(CASHIER_MODE_KEY, active ? "true" : "false");
  notify();
}

export const setCashierModeActive = setCashierMode;

export function getManagerPin(_shop?: Partial<ShopSettings>): string {
  // Manager PIN is now server-verified via RPC — this function is kept for
  // legacy callers but should not be used for security decisions.
  return "";
}

export async function verifyManagerPinAsync(pin: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc("verify_manager_pin", {
      _user_id: user.id,
      _pin: pin.trim(),
    });

    if (error) {
      console.error("verify_manager_pin RPC failed:", error);
      return false;
    }

    return data === true;
  } catch (e) {
    console.error("Manager PIN verification error:", e);
    return false;
  }
}

export function verifyManagerPin(pin: string, _shop?: Partial<ShopSettings>): boolean {
  // DEPRECATED: synchronous fallback kept for backward compatibility only.
  // All security-critical paths MUST use verifyManagerPinAsync().
  // This always returns false — callers must migrate to async.
  return false;
}

export function shouldRequireManagerPinForDiscount(
  discountPct: number,
  shop: Partial<ShopSettings>,
  isCashier: boolean,
): boolean {
  if (!isCashier) return false;
  const maxAllowed = shop.maxDiscountWithoutPin ?? 5;
  return discountPct > maxAllowed;
}

export function shouldHideCostAndProfits(
  shop: Partial<ShopSettings>,
  isCashier: boolean,
): boolean {
  if (!isCashier) return false;
  return shop.hideCostAndProfitsFromCashier ?? true;
}

export function useSecurity() {
  const [isCashierMode, setIsCashierModeState] = useState<boolean>(isCashierModeActive());
  const shop = getShopSettings();

  useEffect(() => {
    const l = () => setIsCashierModeState(isCashierModeActive());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const toggleCashierMode = useCallback(
    async (targetState?: boolean, pin?: string): Promise<{ success: boolean; error?: string }> => {
      const next = targetState !== undefined ? targetState : !isCashierMode;
      // If exiting cashier mode (going back to manager mode), require PIN
      if (!next && isCashierMode) {
        if (!pin) {
          return { success: false, error: "الرقم السري للمدير مطلوب" };
        }
        const valid = await verifyManagerPinAsync(pin);
        if (!valid) {
          return { success: false, error: "الرقم السري للمدير غير صحيح" };
        }
      }
      setCashierMode(next);
      return { success: true };
    },
    [isCashierMode],
  );

  const hideCostAndProfits = shouldHideCostAndProfits(shop, isCashierMode);
  const maxAllowedDiscountPct = isCashierMode ? (shop.maxDiscountWithoutPin ?? 5) : 100;
  const requiresPinForDelete = isCashierMode && (shop.preventInvoiceDeletionWithoutPin ?? true);
  const requiresPinForAnalytics =
    isCashierMode && (shop.preventViewingTotalAnalyticsWithoutPin ?? true);

  return {
    isCashierMode,
    cashierMode: isCashierMode,
    toggleCashierMode,
    shouldHideCostAndProfits: hideCostAndProfits,
    maxAllowedDiscountPct,
    requiresPinForDelete,
    requiresPinForAnalytics,
    verifyPin: async (pin: string) => verifyManagerPinAsync(pin),
    verifyPinAsync: (pin: string) => verifyManagerPinAsync(pin),
  };
}

export const useCashierSecurity = useSecurity;
