import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import type {
  ShopSettings,
  ThemeMode,
  PrintPaper,
  ColorPalette,
  NumeralsFormat,
  AutoBackupFrequency,
} from "@/types";

import {
  EMPTY_SHOP_SETTINGS,
  DEFAULT_EXPENSE_CATEGORIES_LIST,
} from "@/types/constants";

import { uid } from "./db";

// ─── Cache ────────────────────────────────────────────────────────────────────

export let shopCache: ShopSettings | null = null;
const shopListeners = new Set<() => void>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function getShopSettings(): ShopSettings {
  return shopCache ?? EMPTY_SHOP_SETTINGS;
}

export function currency() {
  return getShopSettings().currency || "ج.م";
}

export function money(n: number) {
  return `${fmt(n)} ${currency()}`;
}

// ─── Async operations ─────────────────────────────────────────────────────────

export async function fetchShopSettings(): Promise<ShopSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_SHOP_SETTINGS;
  const { data } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  shopCache = row
    ? {
        shopName: (row.shop_name as string) ?? "",
        phone: (row.phone as string) ?? "",
        address: (row.address as string) ?? "",
        logoUrl: (row.logo_url as string | null) ?? null,
        footerNote: (row.footer_note as string) ?? "",
        currency: (row.currency as string) || "ج.م",
        taxNumber: (row.tax_number as string) ?? "",
        whatsapp: (row.whatsapp as string) ?? "",
        lowStockThreshold: num(row.low_stock_threshold, 5),
        defaultInstallmentMonths: num(row.default_installment_months, 6),
        defaultDueDay: num(row.default_due_day, 1),
        invoicePrefix: (row.invoice_prefix as string) ?? "",
        printPaper: ((row.print_paper as PrintPaper) ?? "a4"),
        theme: ((row.theme as ThemeMode) ?? "dark"),
        reminderDaysBefore: num(row.reminder_days_before, 3),
        alertsEnabled: (row.alerts_enabled as boolean) ?? true,
        colorPalette: (row.color_palette as ColorPalette) ?? "emerald",
        numeralsFormat: (row.numerals_format as NumeralsFormat) ?? "latn",
        autoBackupFrequency: (row.auto_backup_frequency as AutoBackupFrequency) ?? "weekly",
        commercialRegister: (row.commercial_register as string) ?? "",
        email: (row.email as string) ?? "",
        website: (row.website as string) ?? "",
        enableVat: (row.enable_vat as boolean) ?? false,
        defaultVatRate: num(row.default_vat_rate, 14),
        warrantyPolicy: (row.warranty_policy as string) ?? "",
        autoPrintOnSave: (row.auto_print_on_save as boolean) ?? true,
        thermalShowBarcode: (row.thermal_show_barcode as boolean) ?? true,
        thermalShowHeader: (row.thermal_show_header as boolean) ?? true,
        customExpenseCategories: (row.custom_expense_categories as string[]) ?? DEFAULT_EXPENSE_CATEGORIES_LIST,
        whatsappReminderTemplate: (row.whatsapp_reminder_template as string) ?? "",
        whatsappPaymentThankYouTemplate: (row.whatsapp_payment_thank_you_template as string) ?? "",
        criticalOverdueDays: num(row.critical_overdue_days, 15),
        audioAlertsEnabled: (row.audio_alerts_enabled as boolean) ?? true
      }
    : EMPTY_SHOP_SETTINGS;
  shopListeners.forEach((l) => l());
  return shopCache;
}

export async function saveShopSettings(patch: ShopSettings) {
  const user_id = await uid();
  const { error } = await supabase.from("shop_settings").upsert(
    {
      user_id,
      shop_name: patch.shopName.trim(),
      phone: patch.phone.trim(),
      address: patch.address.trim(),
      logo_url: patch.logoUrl?.trim() || null,
      footer_note: patch.footerNote.trim(),
      currency: patch.currency.trim() || "ج.م",
      tax_number: patch.taxNumber.trim(),
      whatsapp: patch.whatsapp.trim(),
      low_stock_threshold: Math.max(0, Math.round(patch.lowStockThreshold)),
      default_installment_months: Math.max(1, Math.round(patch.defaultInstallmentMonths)),
      default_due_day: Math.min(28, Math.max(1, Math.round(patch.defaultDueDay))),
      invoice_prefix: patch.invoicePrefix.trim(),
      print_paper: patch.printPaper,
      theme: patch.theme,
      reminder_days_before: Math.min(30, Math.max(0, Math.round(patch.reminderDaysBefore))),
      alerts_enabled: patch.alertsEnabled,
      color_palette: patch.colorPalette,
      numerals_format: patch.numeralsFormat,
      auto_backup_frequency: patch.autoBackupFrequency,
      commercial_register: patch.commercialRegister.trim(),
      email: patch.email.trim(),
      website: patch.website.trim(),
      enable_vat: patch.enableVat,
      default_vat_rate: patch.defaultVatRate,
      warranty_policy: patch.warrantyPolicy.trim(),
      auto_print_on_save: patch.autoPrintOnSave,
      thermal_show_barcode: patch.thermalShowBarcode,
      thermal_show_header: patch.thermalShowHeader,
      custom_expense_categories: patch.customExpenseCategories,
      whatsapp_reminder_template: patch.whatsappReminderTemplate.trim(),
      whatsapp_payment_thank_you_template: patch.whatsappPaymentThankYouTemplate.trim(),
      critical_overdue_days: patch.criticalOverdueDays,
      audio_alerts_enabled: patch.audioAlertsEnabled
    } as never,
    { onConflict: "user_id" },
  );
  if (error) throw error;
  await fetchShopSettings();
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings>(shopCache ?? EMPTY_SHOP_SETTINGS);
  const [loading, setLoading] = useState(shopCache === null);
  useEffect(() => {
    const l = () => setSettings(shopCache ?? EMPTY_SHOP_SETTINGS);
    shopListeners.add(l);
    if (shopCache === null) {
      fetchShopSettings().finally(() => setLoading(false));
    }
    return () => { shopListeners.delete(l); };
  }, []);
  return { settings, loading, reload: fetchShopSettings };
}
