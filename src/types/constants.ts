import type { ExpenseCategory, WarehouseSeason, ShopSettings } from "./index";

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
