import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Re-export types for backward compatibility
import type {
  ColorPalette,
  NumeralsFormat,
  AutoBackupFrequency,
  CustomerStatus,
  CustomerType,
  Branch,
  PaymentVoucher,
  Customer,
  InvoiceStatus,
  Invoice,
  Payment,
  InvoiceItem,
  ExpenseCategory,
  ShipmentCarrier,
  ShippingZone,
  ShipmentStatus,
  ShipmentCollectionStatus,
  Shipment,
  Expense,
  Supplier,
  PurchasePaymentType,
  Purchase,
  PurchaseItem,
  SupplierPayment,
  ReturnRecord,
  ReturnItem,
  WarehouseSeason,
  WarehouseItem,
  ProductVariant,
  SplitPaymentDetail,
  StockItem,
  StockHistoryEntry,
  AuthProvider,
  AuthIdentity,
  Profile,
  ThemeMode,
  PrintPaper,
  ShopSettings,
  DBState,
} from "@/types";

export type {
  ColorPalette,
  NumeralsFormat,
  AutoBackupFrequency,
  CustomerStatus,
  CustomerType,
  Branch,
  PaymentVoucher,
  Customer,
  InvoiceStatus,
  Invoice,
  Payment,
  InvoiceItem,
  ExpenseCategory,
  ShipmentCarrier,
  ShippingZone,
  ShipmentStatus,
  ShipmentCollectionStatus,
  Shipment,
  Expense,
  Supplier,
  PurchasePaymentType,
  Purchase,
  PurchaseItem,
  SupplierPayment,
  ReturnRecord,
  ReturnItem,
  WarehouseSeason,
  WarehouseItem,
  ProductVariant,
  SplitPaymentDetail,
  StockItem,
  StockHistoryEntry,
  AuthProvider,
  AuthIdentity,
  Profile,
  ThemeMode,
  PrintPaper,
  ShopSettings,
  DBState,
} from "@/types";

// Re-export constants for backward compatibility
export {
  DEFAULT_EXPENSE_CATEGORIES_LIST,
  PRODUCT_TYPES,
  WAREHOUSE_SEASONS,
  WAREHOUSE_CATEGORIES,
  EXPENSE_CATEGORIES,
  LOW_STOCK_THRESHOLD,
  EMPTY_SHOP_SETTINGS,
} from "@/types/constants";

// Re-export everything from sub-modules
export { db, useDB, uid, invalidateCache } from "./db";
export {
  fmt,
  getShopSettings,
  currency,
  money,
  fetchShopSettings,
  saveShopSettings,
  useShopSettings,
} from "./shop-settings";
export {
  expenseCategoryLabel,
  supplierBalance,
  customerBalance,
  daysLate,
  reminderDaysBefore,
  isDueSoonOrOverdue,
  daysUntilDue,
  invoiceNumber,
  lowStockThreshold,
  lowStockCount,
  findStockByBarcode,
  fetchStockHistory,
  aiScript,
} from "./financial-utils";

// ─── Auth helpers (kept here to avoid circular deps with useDB) ───────────────

function toIdentity(u: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: { provider: string }[] | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}): AuthIdentity {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === "string" && meta[k] ? (meta[k] as string) : null);
  const linked = (u.identities ?? []).map((i) => i.provider);
  const appProviders = Array.isArray((u.app_metadata as { providers?: unknown })?.providers)
    ? ((u.app_metadata as { providers?: string[] }).providers as string[])
    : [];
  const providers = Array.from(new Set([...linked, ...appProviders])).filter(Boolean);
  const primary = (u.app_metadata as { provider?: string })?.provider ?? providers[0] ?? "";
  return {
    id: u.id,
    email: u.email,
    metaName: str("full_name") ?? str("name") ?? str("display_name"),
    metaAvatar: str("avatar_url") ?? str("picture"),
    provider: primary === "google" ? "google" : primary === "email" ? "email" : "unknown",
    providers: providers.length ? providers : primary ? [primary] : [],
    hasPassword: providers.includes("email") || primary === "email",
    emailConfirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
  };
}

export function useAuth() {
  const [user, setUser] = useState<AuthIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const verify = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(error || !data.user ? null : toIdentity(data.user));
      setReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive) return;
      setUser(session?.user ? toIdentity(session.user) : null);
      setReady(true);
      if (session?.user) void verify();
      // Refresh data on auth change
      invalidateCache();
    });

    void verify();

    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  return { user, ready };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

const emptyProfile: Profile = { displayName: "", avatarUrl: null, phone: "" };

export function useProfile() {
  const { user, ready: authReady } = useAuth();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setProfile(emptyProfile); setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, phone")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(
      data
        ? { displayName: data.display_name ?? "", avatarUrl: data.avatar_url ?? null, phone: data.phone ?? "" }
        : { displayName: user.metaName ?? "", avatarUrl: user.metaAvatar ?? null, phone: "" },
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { if (authReady) void load(); }, [authReady, load]);

  const save = useCallback(async (patch: Partial<Profile>) => {
    if (!user) throw new Error("لازم تكون مسجل دخول");
    const next = { ...profile, ...patch };
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: next.displayName,
      avatar_url: next.avatarUrl,
      phone: next.phone,
    });
    if (error) throw error;
    setProfile(next);
  }, [user, profile]);

  const label = profile.displayName || user?.metaName || user?.email?.split("@")[0] || "";
  const avatar = profile.avatarUrl || user?.metaAvatar || null;

  return { profile, label, avatar, loading: loading || !authReady, save, reload: load, user, authReady };
}
