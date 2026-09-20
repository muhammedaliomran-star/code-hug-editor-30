import type { ColorPalette } from "@/lib/theme";

export type { ColorPalette };

// Re-export types from constants (single source of truth, avoids circular deps)
export type {
  ExpenseCategory,
  WarehouseSeason,
  NumeralsFormat,
  AutoBackupFrequency,
  ThemeMode,
  PrintPaper,
  ShopSettings,
} from "./constants";

// ─── Core Types ───────────────────────────────────────────

export type CustomerStatus = "committed" | "neutral" | "defaulter";
export type CustomerType = "installment" | "cash";
export type InvoiceStatus = "paid" | "pending" | "cancelled";
export type PurchasePaymentType = "cash" | "credit";
export type ShipmentStatus = "pending" | "processing" | "shipped" | "delivered" | "returned" | "cancelled";
export type ShipmentCollectionStatus = "uncollected" | "collected" | "settled";
export type AuthProvider = "google" | "email" | "unknown";

// ─── Interfaces ───────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  managerName: string | null;
  isMain: boolean;
  createdAt: string;
}

export interface PaymentVoucher {
  id: string;
  customerId: string | null;
  supplierId: string | null;
  amount: number;
  type: "receipt" | "payment";
  paymentMethod: string;
  description: string | null;
  voucherDate: string;
  partyName?: string;
  partyPhone?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  rating: number;
  status: CustomerStatus;
  customerType: CustomerType;
  notes: string | null;
  frozen: boolean;
  address: string | null;
  joiningDate: string;
  creditLimit: number;
  dueDay: number;
  openingBalance: number;
  nationalId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  total: number;
  downPayment: number;
  monthlyInstallment: number;
  firstDueDate: string;
  paid: number;
  notes: string | null;
  createdAt: string;
  discountPct?: number;
  discountAmount?: number;
  taxPct?: number;
  taxAmount?: number;
  status?: InvoiceStatus;
  invoiceNumber?: string;
  date?: string;
  receiptToken?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  name: string;
  cost: number;
  price: number;
  quantity: number;
  discountPct: number;
  discountAmount: number;
  taxPct: number;
  taxAmount: number;
  lineTotal: number;
  serialNumbers: string[];
  createdAt: string;
}

export interface ShipmentCarrier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  baseCost: number;
  active: boolean;
  createdAt: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  carrierId: string;
  deliveryCost: number;
  estimatedDays: number;
  createdAt: string;
}

export interface Shipment {
  id: string;
  invoiceId: string | null;
  carrierId: string | null;
  zoneId: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddress: string | null;
  actualDeliveryDate: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  statusUpdatedBy: string | null;
  shippingCost: number;
  codAmount: number;
  collectionStatus: ShipmentCollectionStatus;
  collectedAt: string | null;
  settledAt: string | null;
  weightKg: number;
  pieces: number;
  expectedDeliveryDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  notes: string | null;
  openingBalance: number;
  nationalId?: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  total: number;
  paymentType: PurchasePaymentType;
  purchaseDate: string;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  name: string;
  unitCost: number;
  quantity: number;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  paidAt: string;
}

export interface ReturnRecord {
  id: string;
  invoiceId: string | null;
  type: "sale" | "supplier";
  totalAmount: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  createdAt: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  season: WarehouseSeason;
  category: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name?: string;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  quantity?: number;
  salePrice?: number;
  lastUnitCost?: number;
  costPrice?: number;
}

export interface SplitPaymentDetail {
  cash: number;
  electronic: number;
  method?: string;
  reference?: string;
}

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  lastUnitCost: number;
  salePrice: number;
  barcode: string | null;
  size: string | null;
  itemType: string | null;
  minStock: number;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
  lowStockAlert?: number;
  season?: string | null;
  category?: string | null;
  notes?: string | null;
}

export interface StockHistoryEntry {
  id: string;
  date: string;
  type: "purchase" | "sale" | "adjustment";
  qty: number;
  reason?: string;
  notes?: string | null;
  ref?: string;
}

export interface AuthIdentity {
  id: string;
  email?: string;
  metaName: string | null;
  metaAvatar: string | null;
  provider: AuthProvider;
  providers: string[];
  hasPassword: boolean;
  emailConfirmed: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface Profile {
  displayName: string;
  avatarUrl: string | null;
  phone: string;
}

// ─── DBState ──────────────────────────────────────────────

export interface DBState {
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

  loading: boolean;
  fetchErrors: string[];
  addBranch: (b: Omit<Branch, "id" | "createdAt">) => Promise<{ id: string } | null>;
  updateBranch: (id: string, patch: Partial<Branch>) => Promise<void>;
  removeBranch: (id: string) => Promise<void>;
  addPaymentVoucher: (v: Omit<PaymentVoucher, "id" | "createdAt">) => Promise<void>;
  removePaymentVoucher: (id: string) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id" | "createdAt" | "user_id"> & { items: Omit<PurchaseItem, "id" | "purchase_id" | "user_id">[] }) => Promise<void>;
  removePurchase: (id: string) => Promise<void>;
  getFinancialReport: (start: Date, end: Date) => Promise<{
    sales: number;
    purchases: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    tax: number;
    returns: number;
  }>;
  refresh: () => Promise<void>;
  addCarrier: (c: Omit<ShipmentCarrier, "id" | "createdAt">) => Promise<void>;
  updateCarrier: (id: string, patch: Partial<ShipmentCarrier>) => Promise<void>;
  addZone: (z: Omit<ShippingZone, "id" | "createdAt">) => Promise<void>;
  updateZone: (id: string, patch: Partial<ShippingZone>) => Promise<void>;
  removeZone: (id: string) => Promise<void>;
  addShipment: (s: Omit<Shipment, "id" | "createdAt">) => Promise<void>;
  updateShipment: (id: string, patch: Partial<Shipment>) => Promise<void>;
  updateShipmentStatus: (id: string, status: ShipmentStatus, reason?: string) => Promise<void>;
  settleCarrierCollections: (carrierId: string) => Promise<number>;
}
