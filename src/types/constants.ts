import type { ColorPalette } from "@/lib/theme";

export type ExpenseCategory = "rent" | "electricity" | "salaries" | "transport" | "other";
export type WarehouseSeason = "summer" | "winter" | "all";
export type NumeralsFormat = "latn" | "arab";
export type AutoBackupFrequency = "weekly" | "monthly" | "off";
export type ThemeMode = "dark" | "light" | "system";
export type PrintPaper = "a4" | "thermal";

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  footerNote: string;
  currency: string;
  taxNumber: string;
  whatsapp: string;
  lowStockThreshold: number;
  defaultInstallmentMonths: number;
  defaultDueDay: number;
  invoicePrefix: string;
  printPaper: PrintPaper;
  theme: ThemeMode;
  reminderDaysBefore: number;
  alertsEnabled: boolean;
  colorPalette: ColorPalette;
  numeralsFormat: NumeralsFormat;
  autoBackupFrequency: AutoBackupFrequency;
  commercialRegister: string;
  email: string;
  website: string;
  enableVat: boolean;
  defaultVatRate: number;
  warrantyPolicy: string;
  autoPrintOnSave: boolean;
  thermalShowBarcode: boolean;
  thermalShowHeader: boolean;
  customExpenseCategories: string[];
  whatsappReminderTemplate: string;
  whatsappPaymentThankYouTemplate: string;
  criticalOverdueDays: number;
  audioAlertsEnabled: boolean;
  managerPin?: string;
  maxDiscountWithoutPin?: number;
  hideCostAndProfitsFromCashier?: boolean;
  preventInvoiceDeletionWithoutPin?: boolean;
  preventViewingTotalAnalyticsWithoutPin?: boolean;
  thermalPaperWidth?: "58mm" | "80mm" | string;
  openCashDrawerOnPrint?: boolean;
}

export const DEFAULT_EXPENSE_CATEGORIES_LIST = ["rent", "electricity", "salaries", "transport", "other"];

export const PRODUCT_TYPES = [
  "أخرى / غير محدد",
  "ملابس",
  "أحذية",
  "إلكترونيات",
  "أدوات منزلية",
  "مستحضرات",
  "قطع غيار",
  "أغذية",
] as const;

export const WAREHOUSE_SEASONS: { value: WarehouseSeason; label: string }[] = [
  { value: "all", label: "عام / مستمر" },
  { value: "summer", label: "صيفي" },
  { value: "winter", label: "شتوي" },
];

export const WAREHOUSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "clothes", label: "ملابس" },
  { value: "shoes", label: "أحذية" },
  { value: "fabrics", label: "أقمشة" },
  { value: "accessories", label: "إكسسوارات" },
  { value: "other", label: "أخرى / غير محدد" },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "إيجار" },
  { value: "electricity", label: "كهرباء" },
  { value: "salaries", label: "رواتب" },
  { value: "transport", label: "نقل" },
  { value: "other", label: "أخرى" },
];

export const LOW_STOCK_THRESHOLD = 5;

export const EMPTY_SHOP_SETTINGS: ShopSettings = {
  shopName: "",
  phone: "",
  address: "",
  logoUrl: null,
  footerNote: "",
  currency: "ج.م",
  taxNumber: "",
  whatsapp: "",
  lowStockThreshold: 5,
  defaultInstallmentMonths: 6,
  defaultDueDay: 1,
  invoicePrefix: "",
  printPaper: "a4",
  theme: "dark",
  reminderDaysBefore: 3,
  alertsEnabled: true,
  colorPalette: "emerald",
  numeralsFormat: "latn",
  autoBackupFrequency: "weekly",
  commercialRegister: "",
  email: "",
  website: "",
  enableVat: false,
  defaultVatRate: 14,
  warrantyPolicy: "",
  autoPrintOnSave: true,
  thermalShowBarcode: true,
  thermalShowHeader: true,
  customExpenseCategories: DEFAULT_EXPENSE_CATEGORIES_LIST,
  whatsappReminderTemplate: "",
  whatsappPaymentThankYouTemplate: "",
  criticalOverdueDays: 15,
  audioAlertsEnabled: true,
};
