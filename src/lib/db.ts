import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { calculateLineFinancials } from "@/lib/financial-engine";

/** Phase 3 (#17): generated row type for fetchAll mappings. */
type TableRow<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
/** payment_vouchers rows may carry legacy columns absent from generated types. */
type VoucherRow = TableRow<"payment_vouchers"> & {
  party_name?: string | null;
  party_phone?: string | null;
};
/** courier_token lands in generated types on next regen; read tolerantly meanwhile. */
type CarrierRow = TableRow<"shipping_carriers"> & {
  courier_token?: string | null;
};
import { saveCacheToIDB, loadCacheFromIDB } from "@/lib/db-cache";
import { toast } from "sonner";

import type {
  Customer,
  CustomerStatus,
  CustomerType,
  Invoice,
  InvoiceStatus,
  InvoiceItem,
  Payment,
  Expense,
  ExpenseCategory,
  Supplier,
  PurchasePaymentType,
  Purchase,
  PurchaseItem,
  SupplierPayment,
  StockItem,
  WarehouseItem,
  WarehouseSeason,
  ReturnRecord,
  ReturnItem,
  Branch,
  PaymentVoucher,
  ShipmentCarrier,
  ShippingZone,
  ShipmentStatus,
  ShipmentCollectionStatus,
  Shipment,
  DBState,
} from "@/types";

// ─── Cache system ─────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let cache: {
  customers: Customer[]; invoices: Invoice[]; payments: Payment[]; expenses: Expense[]; invoiceItems: InvoiceItem[];
  suppliers: Supplier[]; purchases: Purchase[]; purchaseItems: PurchaseItem[]; supplierPayments: SupplierPayment[];
  stockItems: StockItem[];
  warehouseItems: WarehouseItem[];
  returns: ReturnRecord[];
  returnItems: ReturnItem[];
  branches: Branch[];
  paymentVouchers: PaymentVoucher[];
  carriers: ShipmentCarrier[];
  zones: ShippingZone[];
  shipments: Shipment[];
} = {
  customers: [], invoices: [], payments: [], expenses: [], invoiceItems: [],
  suppliers: [], purchases: [], purchaseItems: [], supplierPayments: [], stockItems: [], warehouseItems: [],
  returns: [], returnItems: [],
  branches: [], paymentVouchers: [],
  carriers: [], zones: [], shipments: [],
};

let loading = true;
let loaded = false;
let lastFetchErrors: string[] = [];

function notify() { listeners.forEach((l) => l()); }

function isMissingSupplierSchema(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? error).toLowerCase();
  return message.includes("schema cache") && (message.includes("suppliers") || message.includes("supplier"));
}

function isSchemaCacheError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? error).toLowerCase();
  return message.includes("schema cache") && message.includes("column");
}

function isMissingPurchaseWorkflowRpc(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? "");
  return /record_purchase_with_inventory/i.test(message) && /schema cache|could not find the function/i.test(message);
}

/**
 * Hydrate the in-memory cache from IndexedDB.
 * This runs before fetchAll() so the user sees data immediately,
 * even if offline. fetchAll() then runs in the background to refresh.
 */
export async function hydrateFromIDB() {
  if (loaded) return;
  try {
    const cached = await loadCacheFromIDB();
    if (!cached) return;
    // Strip savedAt before assigning to cache
    const { savedAt: _, ...state } = cached;
    cache = state;
    loading = false;
    loaded = true;
    notify();
  } catch (e) {
    console.warn("[db] hydrateFromIDB failed:", e);
  }
}

let inflight: Promise<void> | null = null;
async function fetchAll() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // Safety net: never leave pages stuck on the loading skeleton.
      await Promise.race([
        fetchAllInner(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("انتهت مهلة تحميل البيانات — تحقق من الاتصال")), 20000)),
      ]);
    } catch (e) {
      console.error("[db] fetchAll failed:", e);
      lastFetchErrors = [e instanceof Error ? e.message : String(e)];
    } finally {
      loading = false;
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

async function fetchAllInner() {
  loading = true;
  lastFetchErrors = [];
  notify();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    cache = { customers: [], invoices: [], payments: [], expenses: [], invoiceItems: [], suppliers: [], purchases: [], purchaseItems: [], supplierPayments: [], stockItems: [], warehouseItems: [], returns: [], returnItems: [], branches: [], paymentVouchers: [], carriers: [], zones: [], shipments: [] };
    loading = false;
    notify();
    return;
  }
  const [c, i, p, e, ii, s, pu, pi, sp, st, wh, rr, ri, br, pv, sc, sz, sh] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*"),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("invoice_items").select("*").order("created_at"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("purchases").select("*").order("created_at", { ascending: false }),
    supabase.from("purchase_items").select("*").order("created_at"),
    supabase.from("supplier_payments").select("*"),
    supabase.from("stock_items").select("*").order("name"),
    supabase.from("warehouse_items").select("*").order("name"),
    supabase.from("return_records").select("*").order("created_at", { ascending: false }),
    supabase.from("return_items").select("*").order("created_at"),
    supabase.from("branches").select("*").order("name"),
    supabase.from("payment_vouchers").select("*").order("voucher_date", { ascending: false }),
    supabase.from("shipping_carriers").select("*").order("name"),
    supabase.from("shipping_zones").select("*").order("name"),
    supabase.from("shipments").select("*").order("created_at", { ascending: false }),
  ]);

  const tableNames = ["customers", "invoices", "payments", "expenses", "invoice_items", "suppliers", "purchases", "purchase_items", "supplier_payments", "stock_items", "warehouse_items", "return_records", "return_items", "branches", "payment_vouchers", "shipping_carriers", "shipping_zones", "shipments"];
  const results = [c, i, p, e, ii, s, pu, pi, sp, st, wh, rr, ri, br, pv, sc, sz, sh];
  const failedTables: string[] = [];
  results.forEach((r, idx) => {
    if (r.error) {
      failedTables.push(`${tableNames[idx]}: ${r.error.message}`);
    }
  });

  if (failedTables.length > 0) {
    lastFetchErrors = failedTables;
    console.error("[fetchAll] Failed tables:", failedTables);
    toast.error(`فشل تحميل البيانات: ${failedTables.length} جدول`, {
      description: failedTables.slice(0, 3).join(", ") + (failedTables.length > 3 ? "..." : ""),
    });
  }

  cache = ({
    customers: (c.data ?? []).map((r: TableRow<"customers">) => ({
      id: r.id, name: r.name, phone: r.phone, rating: r.rating,
      status: r.status as CustomerStatus, customerType: (r.customer_type ?? 'installment') as CustomerType,
      notes: r.notes, frozen: r.frozen,
      address: r.address, joiningDate: r.joining_date,
      creditLimit: Number(r.credit_limit ?? 0) / 100, dueDay: r.due_day ?? 1,
      openingBalance: Number(r.opening_balance ?? 0) / 100, nationalId: r.national_id,
      customerCode: r.customer_code, paperLedgerNumber: r.paper_ledger_number,
      segment: r.customer_segment ?? "regular", assignedStaffId: r.assigned_staff_id,
      preferredContact: r.preferred_contact ?? "whatsapp", preferredPaymentMethod: r.preferred_payment_method ?? "cash",
      debtAlertThreshold: Number(r.debt_alert_threshold ?? 0) / 100,
      dueNotifications: r.due_notifications ?? true, tags: r.tags ?? [],
      createdAt: r.created_at,
    })),
    invoices: (i.data ?? []).map((r: TableRow<"invoices">) => ({
      id: r.id, customerId: r.customer_id, total: Number(r.total) / 100,
      downPayment: Number(r.down_payment) / 100, monthlyInstallment: Number(r.monthly_installment) / 100,
      firstDueDate: r.first_due_date, paid: Number(r.paid) / 100, notes: r.notes, createdAt: r.created_at,
      discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0) / 100,
      taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0) / 100,
      status: (r.status ?? "pending") as InvoiceStatus, invoiceNumber: r.invoice_number, date: r.date || r.created_at,
      receiptToken: r.receipt_token,
    })),
    payments: (p.data ?? []).map((r: TableRow<"payments">) => ({
      id: r.id, invoiceId: r.invoice_id, amount: Number(r.amount) / 100, paidAt: r.paid_at,
    })),
    expenses: (e.data ?? []).map((r: TableRow<"expenses">) => ({
      id: r.id, amount: Number(r.amount) / 100, category: r.category as ExpenseCategory,
      expenseDate: r.expense_date, notes: r.notes, createdAt: r.created_at,
      accountId: (r as any).account_id ?? null,
      branchId: (r as any).branch_id ?? null,
    })),
    invoiceItems: (ii.data ?? []).map((r: TableRow<"invoice_items">) => ({
      id: r.id, invoiceId: r.invoice_id, name: r.name,
      cost: Number(r.cost ?? 0) / 100, price: Number(r.price ?? 0) / 100, quantity: Number(r.quantity ?? 1),
      discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0) / 100,
      taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0) / 100,
      lineTotal: Number(r.line_total ?? (Number(r.price ?? 0) * Number(r.quantity ?? 1))) / 100,
      serialNumbers: Array.isArray(r.serial_numbers) ? r.serial_numbers : [],
      stockItemId: (r as any).stock_item_id ?? null,
      createdAt: r.created_at,
    })),
    suppliers: (s.data ?? []).map((r: TableRow<"suppliers">) => ({
      id: r.id, code: Number((r as any).supplier_code ?? 0) || undefined, name: r.name, contact: r.contact ?? "", notes: r.notes,
      email: (r as any).email ?? null, address: (r as any).address ?? null,
      category: (r as any).category ?? null, tags: Array.isArray((r as any).tags) ? (r as any).tags : [],
      taxNumber: (r as any).tax_number ?? null, commercialRegister: (r as any).commercial_register ?? null,
      preferredContactMethod: (r as any).preferred_contact_method ?? null,
      preferredPaymentMethod: (r as any).preferred_payment_method ?? null,
      paymentTermDays: Number((r as any).payment_term_days ?? 0), creditLimit: Number((r as any).credit_limit ?? 0) / 100,
      status: (r as any).status === "paused" ? "paused" : "active", joinedAt: (r as any).joined_at ?? r.created_at,
      attachmentUrl: (r as any).attachment_url ?? null,
      openingBalance: Number(r.opening_balance ?? 0) / 100, nationalId: r.national_id, createdAt: r.created_at,
    })),
    purchases: (pu.data ?? []).map((r: TableRow<"purchases">) => ({
      id: r.id, supplierId: r.supplier_id, total: Number(r.total) / 100,
      purchaseNumber: Number((r as any).purchase_number ?? 0) || undefined,
      supplierInvoiceNumber: (r as any).supplier_invoice_number ?? null,
      subtotal: Number((r as any).subtotal ?? r.total) / 100,
      discountAmount: Number((r as any).discount_amount ?? 0) / 100,
      taxAmount: Number((r as any).tax_amount ?? 0) / 100,
      shippingAmount: Number((r as any).shipping_amount ?? 0) / 100,
      paidAmount: Number((r as any).paid_amount ?? (r.payment_type === "cash" ? r.total : 0)) / 100,
      dueDate: (r as any).due_date ?? null,
      status: ((r as any).status ?? "posted") as any,
      archived: Boolean((r as any).archived),
      archivedAt: (r as any).archived_at ?? null,
      archiveReason: (r as any).archive_reason ?? null,
      deleted: Boolean((r as any).deleted),
      deletedAt: (r as any).deleted_at ?? null,
      deleteReason: (r as any).delete_reason ?? null,
      paymentType: r.payment_type as PurchasePaymentType,
      purchaseDate: r.purchase_date, notes: r.notes, attachmentPath: (r as any).attachment_path ?? null, createdAt: r.created_at,
    })),
    purchaseItems: (pi.data ?? []).map((r: TableRow<"purchase_items">) => ({
      id: r.id, purchaseId: r.purchase_id, name: r.name,
      unitCost: Number(r.unit_cost ?? 0) / 100, quantity: Number(r.quantity ?? 1), createdAt: r.created_at,
      unit: (r as any).unit ?? "قطعة", batchNumber: (r as any).batch_number ?? null, expiryDate: (r as any).expiry_date ?? null,
    })),
    supplierPayments: (sp.data ?? []).map((r: TableRow<"supplier_payments">) => ({
      id: r.id, supplierId: r.supplier_id, amount: Number(r.amount) / 100, paidAt: r.paid_at,
    })),
    stockItems: (st.data ?? []).map((r: TableRow<"stock_items">) => ({
       id: r.id, productCode: Number(r.product_code ?? 0), name: r.name,
      quantity: Number(r.quantity ?? 0),
      lastUnitCost: Number(r.last_unit_cost ?? 0) / 100,
      salePrice: Number(r.sale_price ?? 0) / 100,
      barcode: r.barcode ?? null,
      size: r.size ?? null,
      itemType: r.item_type ?? null,
      minStock: Number(r.min_stock ?? 0),
      archived: r.archived ?? false,
      variants: Array.isArray(r.variants) ? r.variants : [],
      imageUrl: r.image_url ?? null,
      supplierId: r.supplier_id ?? null,
      category: r.category ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    warehouseItems: (wh.data ?? []).map((r: TableRow<"warehouse_items">) => ({
      id: r.id, name: r.name,
      quantity: Number(r.quantity ?? 0),
      unitCost: Number(r.unit_cost ?? 0) / 100,
      salePrice: Number(r.sale_price ?? 0) / 100,
      season: (r.season ?? "all") as WarehouseSeason,
      category: r.category ?? "other",
      notes: r.notes ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    returns: (rr.data ?? []).map((r: TableRow<"return_records">) => ({
      id: r.id, invoiceId: r.invoice_id, type: r.type as "sale" | "supplier",
      purchaseId: (r as any).purchase_id ?? null,
      totalAmount: Number(r.total_amount) / 100, reason: r.reason, notes: r.notes, createdAt: r.created_at,
    })),
    returnItems: (ri.data ?? []).map((r: TableRow<"return_items">) => ({
      id: r.id, returnId: r.return_id, name: r.name,
      unitPrice: Number(r.unit_price) / 100, quantity: Number(r.quantity), createdAt: r.created_at,
    })),
    branches: (br.data ?? []).map((r: TableRow<"branches">) => ({
      id: r.id, name: r.name, location: r.location, phone: r.phone,
      managerName: r.manager_name, isMain: r.is_main, createdAt: r.created_at,
    })),
    paymentVouchers: (pv.data ?? []).map((r: VoucherRow) => ({
      id: r.id, customerId: r.customer_id, supplierId: r.supplier_id,
      amount: Number(r.amount) / 100, type: r.type as "receipt" | "payment",
      paymentMethod: r.payment_method, description: r.description,
      voucherDate: r.voucher_date, createdAt: r.created_at, partyName: r.party_name, partyPhone: r.party_phone,
    })),
    carriers: (sc.data ?? []).map((r: CarrierRow) => ({
      id: r.id, name: r.name, contactPerson: r.contact_person, phone: r.phone,
      email: r.email, baseCost: Number(r.base_cost ?? 0) / 100, active: r.active !== false, createdAt: r.created_at,
      courierToken: r.courier_token ?? null,
    })),
    zones: (sz.data ?? []).map((r: TableRow<"shipping_zones">) => ({
      id: r.id, name: r.name, carrierId: r.carrier_id,
      deliveryCost: Number(r.delivery_cost ?? 0) / 100, estimatedDays: r.estimated_days ?? 2, createdAt: r.created_at,
    })),
    shipments: (sh.data ?? []).map((r: TableRow<"shipments">) => ({
      id: r.id, invoiceId: r.invoice_id, carrierId: r.carrier_id, zoneId: r.zone_id,
      trackingNumber: r.tracking_number, status: r.status as ShipmentStatus,
      recipientName: r.recipient_name, recipientPhone: r.recipient_phone,
      deliveryAddress: r.delivery_address, actualDeliveryDate: r.actual_delivery_date,
      processingAt: r.processing_at ?? null, shippedAt: r.shipped_at ?? null,
      deliveredAt: r.delivered_at ?? null, returnedAt: r.returned_at ?? null,
      statusUpdatedBy: r.status_updated_by ?? null,
      shippingCost: Number(r.shipping_cost ?? 0) / 100,
      codAmount: Number(r.cod_amount ?? 0) / 100,
      collectionStatus: (r.collection_status ?? "uncollected") as ShipmentCollectionStatus,
      collectedAt: r.collected_at ?? null,
      settledAt: r.settled_at ?? null,
      weightKg: Number(r.weight_kg ?? 0),
      pieces: Number(r.pieces ?? 1),
      expectedDeliveryDate: r.expected_delivery_date ?? null,
      notes: r.notes, createdAt: r.created_at,
    })),

  } as unknown as NonNullable<typeof cache>);
  loading = false;
  loaded = true;
  notify();
  // Persist to IndexedDB so the app works offline after reload
  saveCacheToIDB(cache).catch(() => {});
}

// Optional `table` enables a partial refresh (single table) instead of reloading
// all 18 tables. Used by realtime handlers to avoid heavy full reloads.
// NOTE: any single-table refresh MUST reuse the same row→cache mapping used by
// fetchAll, otherwise raw snake_case/cents rows land in a camelCase cache and the
// UI silently renders wrong numbers.
export async function invalidateCache(table?: string) {
  const dailyMap: Record<string, { cacheKey: keyof typeof cache; fetch: () => PromiseLike<{ data: any[] | null; error: any }>; map: (r: any) => any }> = {
    invoices: {
      cacheKey: "invoices",
      fetch: () => supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      map: (r) => ({
        id: r.id, customerId: r.customer_id, total: Number(r.total) / 100,
        downPayment: Number(r.down_payment) / 100, monthlyInstallment: Number(r.monthly_installment) / 100,
        firstDueDate: r.first_due_date, paid: Number(r.paid) / 100, notes: r.notes, createdAt: r.created_at,
        discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0) / 100,
        taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0) / 100,
        status: r.status ?? "pending", invoiceNumber: r.invoice_number, date: r.date || r.created_at,
        receiptToken: r.receipt_token,
      }),
    },
    payments: {
      cacheKey: "payments",
      fetch: () => supabase.from("payments").select("*"),
      map: (r) => ({ id: r.id, invoiceId: r.invoice_id, amount: Number(r.amount) / 100, paidAt: r.paid_at }),
    },
    expenses: {
      cacheKey: "expenses",
      fetch: () => supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      map: (r) => ({
        id: r.id, amount: Number(r.amount) / 100, category: r.category,
        expenseDate: r.expense_date, notes: r.notes, createdAt: r.created_at,
        accountId: r.account_id ?? null, branchId: r.branch_id ?? null,
      }),
    },
    return_records: {
      cacheKey: "returns",
      fetch: () => supabase.from("return_records").select("*").order("created_at", { ascending: false }),
      map: (r) => ({
        id: r.id, invoiceId: r.invoice_id, type: r.type,
        totalAmount: Number(r.total_amount) / 100, reason: r.reason, notes: r.notes, createdAt: r.created_at,
      }),
    },
    customers: {
      cacheKey: "customers",
      fetch: () => supabase.from("customers").select("*").order("name"),
      map: (r) => ({
        id: r.id, name: r.name, phone: r.phone, rating: r.rating,
        status: r.status, customerType: r.customer_type ?? "installment",
        notes: r.notes, frozen: r.frozen,
        address: r.address, joiningDate: r.joining_date,
        creditLimit: Number(r.credit_limit ?? 0) / 100, dueDay: r.due_day ?? 1,
        openingBalance: Number(r.opening_balance ?? 0) / 100, nationalId: r.national_id,
        customerCode: r.customer_code, paperLedgerNumber: r.paper_ledger_number,
        segment: r.customer_segment ?? "regular", assignedStaffId: r.assigned_staff_id,
        preferredContact: r.preferred_contact ?? "whatsapp", preferredPaymentMethod: r.preferred_payment_method ?? "cash",
        debtAlertThreshold: Number(r.debt_alert_threshold ?? 0) / 100,
        dueNotifications: r.due_notifications ?? true, tags: r.tags ?? [],
        createdAt: r.created_at,
      }),
    },
    invoice_items: {
      cacheKey: "invoiceItems",
      fetch: () => supabase.from("invoice_items").select("*").order("created_at"),
      map: (r) => ({
        id: r.id, invoiceId: r.invoice_id, name: r.name,
        cost: Number(r.cost ?? 0) / 100, price: Number(r.price ?? 0) / 100, quantity: Number(r.quantity ?? 1),
        discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0) / 100,
        taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0) / 100,
        lineTotal: Number(r.line_total ?? (Number(r.price ?? 0) * Number(r.quantity ?? 1))) / 100,
        serialNumbers: Array.isArray(r.serial_numbers) ? r.serial_numbers : [],
        stockItemId: r.stock_item_id ?? null,
        createdAt: r.created_at,
      }),
    },
    return_items: {
      cacheKey: "returnItems",
      fetch: () => supabase.from("return_items").select("*").order("created_at"),
      map: (r) => ({
        id: r.id, returnId: r.return_id, name: r.name,
        unitPrice: Number(r.unit_price) / 100, quantity: Number(r.quantity), createdAt: r.created_at,
      }),
    },
    payment_vouchers: {
      cacheKey: "paymentVouchers",
      fetch: () => supabase.from("payment_vouchers").select("*").order("voucher_date", { ascending: false }),
      map: (r) => ({
        id: r.id, customerId: r.customer_id, supplierId: r.supplier_id,
        amount: Number(r.amount) / 100, type: r.type, paymentMethod: r.payment_method,
        description: r.description, voucherDate: r.voucher_date, createdAt: r.created_at,
        partyName: r.party_name, partyPhone: r.party_phone,
      }),
    },
    stock_items: {
      cacheKey: "stockItems",
      fetch: () => supabase.from("stock_items").select("*").order("name"),
      map: (r) => ({
        id: r.id, name: r.name,
        quantity: Number(r.quantity ?? 0),
        lastUnitCost: Number(r.last_unit_cost ?? 0) / 100,
        salePrice: Number(r.sale_price ?? 0) / 100,
        barcode: r.barcode ?? null,
        size: r.size ?? null,
        itemType: r.item_type ?? null,
        minStock: Number(r.min_stock ?? 0),
        archived: r.archived ?? false,
        variants: Array.isArray(r.variants) ? r.variants : [],
        imageUrl: r.image_url ?? null,
        supplierId: r.supplier_id ?? null,
        category: r.category ?? null,
        createdAt: r.created_at, updatedAt: r.updated_at,
      }),
    },
  };
  const entry = table ? dailyMap[table] : undefined;
  if (!entry) {
    loaded = false;
    await fetchAll();
    return;
  }
  try {
    const { data, error } = await entry.fetch();
    if (error) throw error;
    (cache as any)[entry.cacheKey] = (data ?? []).map(entry.map);
  } catch (e) {
    console.error("[db] refreshTable failed, falling back to full reload:", e);
    loaded = false;
    await fetchAll();
    return;
  }
  // keep the offline IndexedDB snapshot in sync with the partial refresh
  saveCacheToIDB(cache).catch(() => {});
  notify();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function uid() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function recomputeInvoicePaid(invoiceId: string) {
  try {
    const { error } = await supabase.rpc("recalculate_invoice_paid", { p_invoice_id: invoiceId });
    if (!error) return;
  } catch {
    // Continue to fallback
  }

  try {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, down_payment, total, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (inv) {
      const { data: pmts } = await supabase
        .from("payments")
        .select("amount")
        .eq("invoice_id", invoiceId);

      const sumP = (pmts || []).reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const correctPaid = Number(inv.down_payment || 0) + sumP;
      const newStatus = correctPaid >= Number(inv.total || 0) ? "paid" : (inv.status === "cancelled" ? "cancelled" : "pending");
      
      await supabase
        .from("invoices")
        .update({ paid: correctPaid, status: newStatus })
        .eq("id", invoiceId);
    }
  } catch (err) {
    console.error("recomputeInvoicePaid error:", err);
  }
}

async function assertInvoiceAllowed(inv: {
  customerId: string; total: number; downPayment: number; monthlyInstallment: number; paid?: number;
}) {
  const { data: c, error } = await supabase
    .from("customers")
    .select("id,name,frozen,status,credit_limit,opening_balance,customer_type")
    .eq("id", inv.customerId)
    .maybeSingle();
  if (error) throw error;
  if (!c) throw new Error("العميل غير موجود");
  if (c.frozen) throw new Error(`العميل «${c.name}» مجمّد — لا يمكن فتح فاتورة جديدة قبل تسوية حسابه`);
  if (c.status === "defaulter") throw new Error(`العميل «${c.name}» مماطل — لا يمكن فتح فاتورة جديدة قبل تسوية حسابه`);

  const paid = inv.paid ?? inv.downPayment;
  const remaining = Math.max(0, Number(inv.total) - Number(paid));

  if (c.customer_type === "cash" && (remaining > 0 || Number(inv.monthlyInstallment) > 0)) {
    throw new Error(`«${c.name}» عميل فوري (نقدي) — لازم تحصيل كامل المبلغ، أو غيّر نوع العميل لقسط أولًا`);
  }

  const limit = Number(c.credit_limit ?? 0);
  if (limit > 0 && remaining > 0) {
    const { data: invs } = await supabase
      .from("invoices").select("total,paid").eq("customer_id", inv.customerId);
    const openBalance = (invs ?? []).reduce((s: number, r: any) => s + (Number(r.total) - Number(r.paid)), 0)
      + Number(c.opening_balance ?? 0);
    if (openBalance + remaining > limit) {
      throw new Error(`تجاوز سقف المديونية: الحد ${Math.round(limit)} والمديونية بعد الفاتورة ${Math.round(openBalance + remaining)}`);
    }
  }
}

export function invoiceItemFinancials(item: {
  price: number;
  quantity?: number;
  discountPct?: number;
  taxPct?: number;
  serialNumbers?: string[];
}) {
  const lf = calculateLineFinancials({
    price: item.price,
    quantity: item.quantity,
    discountPct: item.discountPct,
    taxPct: item.taxPct,
  });
  return {
    discount_pct: lf.discountPct,
    discount_amount: lf.discountAmount * 100,
    tax_pct: lf.taxPct,
    tax_amount: lf.taxAmount * 100,
    line_total: lf.lineTotal * 100,
    serial_numbers: (item.serialNumbers ?? []).map((value) => value.trim()).filter(Boolean),
  };
}

// ─── DB object ────────────────────────────────────────────────────────────────

/** True when PostgREST reports a missing column (database not migrated yet). */
function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message ?? "");
  return /column .* does not exist|schema cache|Could not find the '[^']+' column/i.test(msg);
}

export const db = {

  invalidate: fetchAll,
  async addCustomer(c: Partial<Omit<Customer, "id" | "createdAt">> & { name: string }): Promise<Customer | undefined> {
    const user_id = await uid();
    const { data: inserted, error } = await supabase.from("customers").insert({
      user_id, name: c.name, phone: c.phone ?? "", rating: c.rating, status: c.status,
      customer_type: c.customerType ?? 'installment',
      notes: c.notes, frozen: c.frozen,
      address: c.address, joining_date: c.joiningDate, national_id: c.nationalId,
      paper_ledger_number: c.paperLedgerNumber,
      customer_segment: c.segment ?? "regular", assigned_staff_id: c.assignedStaffId,
      preferred_contact: c.preferredContact ?? "whatsapp", preferred_payment_method: c.preferredPaymentMethod ?? "cash",
      debt_alert_threshold: (c.debtAlertThreshold ?? 0) * 100, due_notifications: c.dueNotifications ?? true,
      tags: c.tags ?? [],
      credit_limit: (c.creditLimit ?? 0) * 100, due_day: c.dueDay,
      opening_balance: (c.openingBalance ?? 0) * 100,
    }).select("id").single();
    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error("CUSTOMER_PROFILE_MIGRATION_REQUIRED");
      }
      throw error;
    }
    await fetchAll();
    return inserted
      ? cache.customers.find((item) => item.id === inserted.id) ?? ({ ...(c as any), id: inserted.id, createdAt: new Date().toISOString() } as Customer)
      : undefined;
  },
  async updateCustomer(id: string, patch: Partial<Customer>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.phone !== undefined) upd.phone = patch.phone;
    if (patch.rating !== undefined) upd.rating = patch.rating;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.customerType !== undefined) upd.customer_type = patch.customerType;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.frozen !== undefined) upd.frozen = patch.frozen;
    if (patch.address !== undefined) upd.address = patch.address;
    if (patch.nationalId !== undefined) upd.national_id = patch.nationalId;
    if (patch.paperLedgerNumber !== undefined) upd.paper_ledger_number = patch.paperLedgerNumber;
    if (patch.segment !== undefined) upd.customer_segment = patch.segment;
    if (patch.assignedStaffId !== undefined) upd.assigned_staff_id = patch.assignedStaffId;
    if (patch.preferredContact !== undefined) upd.preferred_contact = patch.preferredContact;
    if (patch.preferredPaymentMethod !== undefined) upd.preferred_payment_method = patch.preferredPaymentMethod;
    if (patch.debtAlertThreshold !== undefined) upd.debt_alert_threshold = (patch.debtAlertThreshold ?? 0) * 100;
    if (patch.dueNotifications !== undefined) upd.due_notifications = patch.dueNotifications;
    if (patch.tags !== undefined) upd.tags = patch.tags;
    if (patch.joiningDate !== undefined) upd.joining_date = patch.joiningDate;
    if (patch.creditLimit !== undefined) upd.credit_limit = (patch.creditLimit ?? 0) * 100;
    if (patch.dueDay !== undefined) upd.due_day = patch.dueDay;
    if (patch.openingBalance !== undefined) upd.opening_balance = (patch.openingBalance ?? 0) * 100;
    const { error } = await supabase.from("customers").update(upd).eq("id", id);
    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error("CUSTOMER_PROFILE_MIGRATION_REQUIRED");
      }
      throw error;
    }
    await fetchAll();
  },
  async removeCustomer(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addInvoice(inv: Omit<Invoice, "id" | "createdAt" | "paid" | "receiptToken"> & { paid?: number; items?: Array<{ name: string; cost: number; price: number; quantity?: number; discountPct?: number; taxPct?: number; serialNumbers?: string[]; stockId?: string | null }> }): Promise<string | undefined> {
    const user_id = await uid();
    await assertInvoiceAllowed(inv);

    const items = (inv.items ?? []).map((it) => ({
      name: it.name,
      cost: it.cost,
      price: it.price,
      quantity: Math.max(1, Math.floor(it.quantity ?? 1)),
      discount_pct: it.discountPct ?? 0,
      tax_pct: it.taxPct ?? 0,
      serial_numbers: it.serialNumbers ?? [],
      stock_item_id: it.stockId ?? null,
    }));

    const { data, error } = await (supabase.rpc as any)("create_sale", {
      p_customer_id: inv.customerId,
      p_total: (inv.total ?? 0) * 100,
      p_down_payment: (inv.downPayment ?? 0) * 100,
      p_monthly_installment: (inv.monthlyInstallment ?? 0) * 100,
      p_first_due_date: inv.firstDueDate,
      p_notes: inv.notes,
      p_discount_pct: inv.discountPct ?? 0,
      p_discount_amount: (inv.discountAmount ?? 0) * 100,
      p_tax_pct: inv.taxPct ?? 0,
      p_tax_amount: (inv.taxAmount ?? 0) * 100,
      p_status: inv.status ?? "pending",
      p_paid: (inv.paid ?? inv.downPayment ?? 0) * 100,
      p_items: items.map((it) => ({
        ...it,
        cost: (it.cost ?? 0) * 100,
        price: (it.price ?? 0) * 100,
      })),
    });
    if (error) throw error;
    await fetchAll();
    return (data as string | undefined) ?? undefined;
  },
  async addInvoiceItem(invoiceId: string, item: { name: string; cost: number; price: number; quantity?: number; discountPct?: number; taxPct?: number; serialNumbers?: string[]; stockId?: string | null }) {
    const user_id = await uid();
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    const { error } = await supabase.from("invoice_items").insert({
      user_id, invoice_id: invoiceId, name: item.name, cost: (item.cost ?? 0) * 100, price: (item.price ?? 0) * 100,
      quantity: qty, ...invoiceItemFinancials(item),
      stock_item_id: item.stockId ?? null,
    });
    if (error) throw error;
    // deduct stock (quantity only — the insert trigger logs the 'sale' movement)
    if (item.stockId && qty > 0) {
      const { data: existing } = await supabase
        .from("stock_items").select("quantity").eq("id", item.stockId).maybeSingle();
      const next = Math.max(0, Number(existing?.quantity ?? 0) - qty);
      await supabase.from("stock_items").update({ quantity: next }).eq("id", item.stockId);
    }
    await fetchAll();
  },
  async updateInvoiceItem(id: string, patch: Partial<{ name: string; cost: number; price: number; quantity: number; discountPct: number; taxPct: number; serialNumbers: string[] }>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.cost !== undefined) upd.cost = (patch.cost ?? 0) * 100;
    if (patch.price !== undefined) upd.price = (patch.price ?? 0) * 100;
    if (patch.quantity !== undefined) upd.quantity = Math.max(1, Math.floor(patch.quantity));
    if (patch.discountPct !== undefined) upd.discount_pct = patch.discountPct;
    if (patch.taxPct !== undefined) upd.tax_pct = patch.taxPct;
    if (patch.serialNumbers !== undefined) upd.serial_numbers = patch.serialNumbers;
    if (patch.price !== undefined || patch.quantity !== undefined || patch.discountPct !== undefined || patch.taxPct !== undefined) {
      const { data: current, error: currentError } = await supabase.from("invoice_items").select("price,quantity,discount_pct,tax_pct,serial_numbers").eq("id", id).single();
      if (currentError) throw currentError;
      Object.assign(upd, invoiceItemFinancials({
        price: patch.price ?? Number(current.price),
        quantity: patch.quantity ?? Number(current.quantity),
        discountPct: patch.discountPct ?? Number(current.discount_pct),
        taxPct: patch.taxPct ?? Number(current.tax_pct),
        serialNumbers: patch.serialNumbers ?? current.serial_numbers,
      }));
    }
    const { error } = await supabase.from("invoice_items").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeInvoiceItem(id: string) {
    // read first so we can restore stock + log a movement
    const { data: row } = await supabase
      .from("invoice_items").select("name, quantity, stock_item_id, cost, invoice_id, user_id").eq("id", id).maybeSingle();
    const { error } = await supabase.from("invoice_items").delete().eq("id", id);
    if (error) throw error;
    if (row?.stock_item_id && row.quantity > 0) {
      const sid = row.stock_item_id as string;
      const { data: existing } = await supabase
        .from("stock_items").select("quantity").eq("id", sid).maybeSingle();
      const next = Number(existing?.quantity ?? 0) + Number(row.quantity);
      await supabase.from("stock_items").update({ quantity: next }).eq("id", sid);
      const user_id = row.user_id;
      await supabase.from("stock_movements").insert({
        user_id, stock_item_id: sid, movement_type: "return",
        quantity: Number(row.quantity), unit_cost: Number(row.cost ?? 0),
        reference_id: row.invoice_id, notes: "حذف بند فاتورة",
      });
    }
    await fetchAll();
  },

  async addBranch(b: Omit<Branch, "id" | "createdAt">) {
    const user_id = await uid();
    const { data, error } = await supabase.from("branches").insert({
      user_id, name: b.name, location: b.location, phone: b.phone,
      manager_name: b.managerName, is_main: b.isMain
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return data ? { id: data.id as string } : null;
  },
  async updateBranch(id: string, patch: Partial<Branch>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.location !== undefined) upd.location = patch.location;
    if (patch.phone !== undefined) upd.phone = patch.phone;
    if (patch.managerName !== undefined) upd.manager_name = patch.managerName;
    if (patch.isMain !== undefined) upd.is_main = patch.isMain;
    const { error } = await supabase.from("branches").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeBranch(id: string) {
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  async addPaymentVoucher(v: Omit<PaymentVoucher, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("payment_vouchers").insert({
      user_id, customer_id: v.customerId, supplier_id: v.supplierId,
      amount: (v.amount ?? 0) * 100, type: v.type, payment_method: v.paymentMethod,
      description: v.description, voucher_date: v.voucherDate
    });
    if (error) throw error;
    await fetchAll();
  },
  async removePaymentVoucher(id: string) {
    const { error } = await supabase.from("payment_vouchers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeInvoice(id: string) {
    const { error } = await (supabase.rpc as any)("delete_invoice_with_stock", { p_invoice_id: id });
    if (error) throw error;
    await fetchAll();
  },

  async updateInvoice(id: string, patch: Partial<Pick<Invoice, "total" | "downPayment" | "monthlyInstallment" | "firstDueDate" | "notes" | "status" | "paid">>) {
    const upd: any = {};
    if (patch.total !== undefined) upd.total = (patch.total ?? 0) * 100;
    if (patch.downPayment !== undefined) upd.down_payment = (patch.downPayment ?? 0) * 100;
    if (patch.monthlyInstallment !== undefined) upd.monthly_installment = (patch.monthlyInstallment ?? 0) * 100;
    if (patch.firstDueDate !== undefined) upd.first_due_date = patch.firstDueDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.paid !== undefined) upd.paid = (patch.paid ?? 0) * 100;
    const { error } = await supabase.from("invoices").update(upd).eq("id", id);
    if (error) throw error;
    if (patch.paid === undefined && patch.downPayment !== undefined) {
      await recomputeInvoicePaid(id);
    }
    await fetchAll();
  },
  async reconcileInvoicePaid(invoiceId: string) {
    await recomputeInvoicePaid(invoiceId);
    await fetchAll();
  },
  async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
    if (error) throw error;
    await fetchAll();
  },
  async setInvoicePaidAndStatus(invoiceId: string, paid: number, status?: InvoiceStatus) {
    const upd: any = { paid };
    if (status) upd.status = status;
    const { error } = await supabase.from("invoices").update(upd).eq("id", invoiceId);
    if (error) throw error;
    await fetchAll();
  },
  async updateStockCost(stockId: string, cost: number) {
    const { error } = await supabase.from("stock_items").update({ last_unit_cost: (cost ?? 0) * 100 }).eq("id", stockId);
    if (error) throw error;
    await fetchAll();
  },
  async updatePayment(id: string, amount: number) {
    const { error } = await supabase.rpc("update_invoice_payment", { p_payment_id: id, p_amount: (amount ?? 0) * 100 });
    if (error) throw error;
    await fetchAll();
  },
  async removePayment(id: string) {
    const { error } = await supabase.rpc("delete_invoice_payment", { p_payment_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async recordPayment(invoiceId: string, amount: number) {
    const { error } = await supabase.rpc("record_invoice_payment", {
      p_invoice_id: invoiceId,
      p_amount: (amount ?? 0) * 100,
      p_payment_id: crypto.randomUUID(),
    });
    if (error) throw error;
    await fetchAll();
  },
  async addExpense(exp: Omit<Expense, "id" | "createdAt">): Promise<string | undefined> {
    let user_id: string;
    try {
      user_id = await uid();
    } catch {
      // offline auth failure — try cached session
      try {
        const { data } = await supabase.auth.getSession();
        user_id = data.session?.user?.id ?? "";
      } catch { user_id = ""; }
      if (!user_id) throw new Error("Not authenticated");
    }
    try {
      const row: any = {
        user_id, amount: (exp.amount ?? 0) * 100, category: exp.category,
        expense_date: exp.expenseDate, notes: exp.notes,
      };
      if (exp.accountId !== undefined) row.account_id = exp.accountId ?? null;
      if (exp.branchId !== undefined) row.branch_id = exp.branchId ?? null;

      let res = await supabase.from("expenses").insert(row).select("id").single();
      if (res.error && isMissingColumnError(res.error)) {
        // pre-migration database: fall back to the legacy column set
        delete row.account_id;
        delete row.branch_id;
        res = await supabase.from("expenses").insert(row).select("id").single();
      }
      if (res.error) throw res.error;

      await invalidateCache("expenses");
      return (res.data as { id?: string } | null)?.id;
    } catch (err) {
      // offline fallback: enqueue for later replay
      let queuedId: string | null = null;
      try {
        const { enqueueOffline } = await import("./offline-queue");
        queuedId = `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        enqueueOffline({
          tableName: "expenses",
          operation: "upsert",
          payload: {
            id: queuedId!,
            user_id,
            amount: (exp.amount ?? 0) * 100,
            category: exp.category,
            expense_date: exp.expenseDate,
            notes: exp.notes,
            ...(exp.accountId !== undefined ? { account_id: exp.accountId ?? null } : {}),
            ...(exp.branchId !== undefined ? { branch_id: exp.branchId ?? null } : {}),
          },
          onConflict: "id",
        });
      } catch { /* ignore */ }
      if (queuedId) return queuedId;
      throw err;
    }
  },
  async updateExpense(id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) {
    const upd: any = {};
    if (patch.amount !== undefined) upd.amount = (patch.amount ?? 0) * 100;
    if (patch.category !== undefined) upd.category = patch.category;
    if (patch.expenseDate !== undefined) upd.expense_date = patch.expenseDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.accountId !== undefined) upd.account_id = patch.accountId ?? null;
    if (patch.branchId !== undefined) upd.branch_id = patch.branchId ?? null;
    try {
      let res = await supabase.from("expenses").update(upd).eq("id", id);
      if (res.error && isMissingColumnError(res.error)) {
        const legacy: any = { ...upd };
        delete legacy.account_id;
        delete legacy.branch_id;
        res = await supabase.from("expenses").update(legacy).eq("id", id);
      }
      if (res.error) throw res.error;

      await invalidateCache("expenses");
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        enqueueOffline({ tableName: "expenses", operation: "update", payload: { id, ...upd } });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async removeExpense(id: string) {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      await invalidateCache("expenses");
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        let user_id;
        try { user_id = await uid(); } catch { user_id = undefined; }
        enqueueOffline({ tableName: "expenses", operation: "delete", payload: user_id ? { id, user_id } : { id } });
      } catch { /* ignore */ }
      throw err;
    }
  },

  async getDailyNote(dateFrom: string, dateTo: string): Promise<string | null> {
    try {
      const user_id = await uid();
      const { data, error } = await supabase
        .from("daily_notes")
        .select("note")
        .eq("user_id", user_id)
        .eq("date_from", dateFrom)
        .eq("date_to", dateTo)
        .maybeSingle();
      if (error) return null;
      return (data as { note?: string } | null)?.note ?? null;
    } catch {
      return null;
    }
  },

  async saveDailyNote(dateFrom: string, dateTo: string, note: string): Promise<void> {
    let user_id: string;
    try { user_id = await uid(); }
    catch {
      try { const { data } = await supabase.auth.getSession(); user_id = data.session?.user?.id ?? ""; } catch { user_id = ""; }
      if (!user_id) throw new Error("Not authenticated");
    }
    try {
      const { error } = await supabase
        .from("daily_notes")
        .upsert(
          { user_id, date_from: dateFrom, date_to: dateTo, note, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date_from,date_to" },
        );
      if (error) throw error;
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        enqueueOffline({ tableName: "daily_notes", operation: "upsert", payload: { user_id, date_from: dateFrom, date_to: dateTo, note, updated_at: new Date().toISOString() }, onConflict: "user_id,date_from,date_to" });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async addSupplier(s: Omit<Supplier, "id" | "createdAt">) {
    const user_id = await uid();
    const fullInsert = {
      user_id, supplier_code: s.code ?? null, name: s.name, contact: s.contact, notes: s.notes,
      email: s.email ?? null, address: s.address ?? null, category: s.category ?? null, tags: s.tags ?? [],
      tax_number: s.taxNumber ?? null, commercial_register: s.commercialRegister ?? null,
      preferred_contact_method: s.preferredContactMethod ?? null, preferred_payment_method: s.preferredPaymentMethod ?? null,
      payment_term_days: s.paymentTermDays ?? 0, credit_limit: (s.creditLimit ?? 0) * 100,
      status: s.status ?? "active", joined_at: s.joinedAt ?? new Date().toISOString().slice(0, 10), attachment_url: s.attachmentUrl ?? null,
      opening_balance: (s.openingBalance ?? 0) * 100,
    };
    const { error } = await supabase.from("suppliers").insert(fullInsert);
    if (error) {
      if (!isMissingSupplierSchema(error)) throw error;
      const legacy = await supabase.from("suppliers").insert({
        user_id, name: s.name, contact: s.contact, notes: s.notes,
        opening_balance: (s.openingBalance ?? 0) * 100,
      });
      if (legacy.error) throw legacy.error;
      toast.info("تم حفظ المورد بالحقول الأساسية. طبّق تحديث قاعدة البيانات لحفظ باقي التفاصيل.");
    }
    await fetchAll();
  },
  async updateSupplier(id: string, patch: Partial<Omit<Supplier, "id" | "createdAt">>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.contact !== undefined) upd.contact = patch.contact;
    if (patch.email !== undefined) upd.email = patch.email;
    if (patch.address !== undefined) upd.address = patch.address;
    if (patch.category !== undefined) upd.category = patch.category;
    if (patch.tags !== undefined) upd.tags = patch.tags;
    if (patch.taxNumber !== undefined) upd.tax_number = patch.taxNumber;
    if (patch.commercialRegister !== undefined) upd.commercial_register = patch.commercialRegister;
    if (patch.preferredContactMethod !== undefined) upd.preferred_contact_method = patch.preferredContactMethod;
    if (patch.preferredPaymentMethod !== undefined) upd.preferred_payment_method = patch.preferredPaymentMethod;
    if (patch.paymentTermDays !== undefined) upd.payment_term_days = patch.paymentTermDays;
    if (patch.creditLimit !== undefined) upd.credit_limit = (patch.creditLimit ?? 0) * 100;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.joinedAt !== undefined) upd.joined_at = patch.joinedAt;
    if (patch.attachmentUrl !== undefined) upd.attachment_url = patch.attachmentUrl;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.openingBalance !== undefined) upd.opening_balance = (patch.openingBalance ?? 0) * 100;
    const { error } = await supabase.from("suppliers").update(upd).eq("id", id);
    if (error) {
      if (!isMissingSupplierSchema(error)) throw error;
      const legacyUpd: Record<string, unknown> = {};
      if (patch.name !== undefined) legacyUpd.name = patch.name;
      if (patch.contact !== undefined) legacyUpd.contact = patch.contact;
      if (patch.notes !== undefined) legacyUpd.notes = patch.notes;
      if (patch.openingBalance !== undefined) legacyUpd.opening_balance = (patch.openingBalance ?? 0) * 100;
      const legacy = await supabase.from("suppliers").update(legacyUpd).eq("id", id);
      if (legacy.error) throw legacy.error;
      toast.info("تم تحديث البيانات الأساسية. طبّق تحديث قاعدة البيانات لحفظ باقي التفاصيل.");
    }
    await fetchAll();
  },
  async removeSupplier(id: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addPurchase(
    p: Omit<Purchase, "id" | "createdAt"> & { items: Array<{ name: string; unitCost: number; quantity: number; unit?: string; batchNumber?: string | null; expiryDate?: string | null }> }
  ) {
    const items = p.items.map((item) => ({ name: item.name, unitCost: (item.unitCost ?? 0) * 100, quantity: item.quantity, unit: item.unit ?? "قطعة", batchNumber: item.batchNumber ?? null, expiryDate: item.expiryDate ?? null }));
    const workflowPayload = {
      p_supplier_id: p.supplierId, p_total: (p.total ?? 0) * 100, p_payment_type: p.paymentType,
      p_purchase_date: p.purchaseDate, p_notes: p.notes, p_purchase_id: undefined,
      p_supplier_invoice_number: p.supplierInvoiceNumber ?? null, p_due_date: p.dueDate ?? null,
      p_paid_amount: (p.paidAmount ?? (p.paymentType === "cash" ? p.total : 0)) * 100,
      p_discount_amount: (p.discountAmount ?? 0) * 100, p_tax_amount: (p.taxAmount ?? 0) * 100,
      p_shipping_amount: (p.shippingAmount ?? 0) * 100, p_subtotal: (p.subtotal ?? p.total) * 100,
      p_status: p.status ?? "posted",
      p_items: items,
    };
    let rpcResult = await (supabase as any).rpc("record_purchase_with_inventory", workflowPayload);
    let { data: purchaseId, error } = rpcResult;
    if (error && isMissingPurchaseWorkflowRpc(error)) {
      if (p.status === "draft") {
        throw new Error("لا يمكن حفظ المسودة قبل تطبيق تحديث قاعدة البيانات. طبّق Migration الخاصة بفواتير الشراء أولاً.");
      }
      const legacyItems = p.items.map((item) => ({ name: item.name, unitCost: (item.unitCost ?? 0) * 100, quantity: item.quantity }));
      const legacyNotes = [p.supplierInvoiceNumber ? `رقم فاتورة المورد: ${p.supplierInvoiceNumber}` : "", p.notes ?? ""].filter(Boolean).join(" — ") || null;
      const legacy = await (supabase as any).rpc("record_purchase_with_inventory", {
        p_supplier_id: p.supplierId, p_total: (p.total ?? 0) * 100, p_payment_type: p.paymentType,
        p_purchase_date: p.purchaseDate, p_notes: legacyNotes, p_items: legacyItems,
      });
      purchaseId = legacy.data;
      error = legacy.error;
      if (!error) toast.info("تم حفظ الفاتورة بالوضع المتوافق. طبّق Migration فواتير الشراء لتفعيل الكود والتفاصيل الإضافية.");
    }
    if (error) throw error;
    if (p.attachmentPath) {
      const savedPurchaseId = typeof purchaseId === "string" ? purchaseId : null;
      const latest = savedPurchaseId ? { data: { id: savedPurchaseId } } : await supabase.from("purchases").select("id").eq("supplier_id", p.supplierId).eq("purchase_date", p.purchaseDate).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latest.data?.id) {
        const attached = await supabase.from("purchases").update({ attachment_path: p.attachmentPath }).eq("id", latest.data.id);
        if (attached.error && !isSchemaCacheError(attached.error)) throw attached.error;
      }
    }
    await fetchAll();
  },
  async getNextPurchaseNumber() {
    const { data, error } = await (supabase as any).rpc("get_next_purchase_number");
    if (error) throw error;
    return Number(data ?? 1);
  },
  async postPurchaseDraft(id: string) {
    const { error } = await (supabase as any).rpc("post_purchase_draft", { p_purchase_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async archivePurchase(id: string, reason?: string) {
    const { error } = await (supabase as any).rpc("archive_purchase", { p_purchase_id: id, p_reason: reason || null });
    if (error) throw error;
    await fetchAll();
  },
  async unarchivePurchase(id: string) {
    const { error } = await (supabase as any).rpc("unarchive_purchase", { p_purchase_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async removePurchase(id: string, reason?: string) {
    const { error } = await (supabase as any).rpc("delete_purchase_with_inventory", { p_purchase_id: id, p_reason: reason || null });
    if (error) throw error;
    await fetchAll();
  },
  async restorePurchase(id: string) {
    const { error } = await (supabase as any).rpc("restore_purchase_from_trash", { p_purchase_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async permanentlyDeletePurchase(id: string) {
    const { error } = await (supabase as any).rpc("permanently_delete_purchase", { p_purchase_id: id });
    if (error) throw error;
    await fetchAll();
  },
  async getFinancialReport(start: Date, end: Date) {
    const s = start.toISOString();
    const e = end.toISOString();
    
    const [sales, purchases, expenses, returns, saleItems] = await Promise.all([
      supabase.from("invoices").select("id, total, tax_amount, status").gte("created_at", s).lte("created_at", e),
      supabase.from("purchases").select("total").gte("purchase_date", s).lte("purchase_date", e),
      supabase.from("expenses").select("amount, category").gte("expense_date", s).lte("expense_date", e),
      supabase.from("return_records").select("total_amount").gte("created_at", s).lte("created_at", e),
      supabase.from("invoice_items").select("invoice_id, cost"),
    ]);
    
    const validSales = (sales.data ?? []).filter((invoice: any) => invoice.status !== "cancelled");
    const totalSales = validSales.reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const totalTax = validSales.reduce((acc: number, curr: any) => acc + (Number(curr.tax_amount) || 0), 0);
    const totalPurchases = (purchases.data ?? []).reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const cashPurchases = (purchases.data ?? []).filter((purchase: any) => purchase.payment_type === "cash").reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const totalExpenses = (expenses.data ?? []).reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    const totalReturns = (returns.data ?? []).filter((item: any) => item.type === "sale").reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);
    
    const netSales = totalSales - totalTax - totalReturns;

    const periodInvoiceIds = new Set(validSales.map((invoice: any) => invoice.id));
    const periodSaleItems = (saleItems.data ?? []).filter((item: any) => periodInvoiceIds.has(item.invoice_id));
    const cogs = periodSaleItems.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0);
    
    const grossProfit = netSales - cogs;
    const netProfit = grossProfit - totalExpenses - cashPurchases;
    
    return {
      sales: totalSales,
      purchases: totalPurchases,
      expenses: totalExpenses,
      grossProfit,
      netProfit,
      tax: totalTax,
      returns: totalReturns,
      expenseBreakdown: (expenses.data ?? []),
    };
  },
  async updatePurchase(
    id: string,
    p: {
      supplierId: string; total: number; paymentType: PurchasePaymentType;
      purchaseDate: string; notes: string | null; supplierInvoiceNumber?: string | null;
      dueDate?: string | null; paidAmount?: number; subtotal?: number; discountAmount?: number; taxAmount?: number; shippingAmount?: number;
      items: Array<{ name: string; unitCost: number; quantity: number; unit?: string; batchNumber?: string | null; expiryDate?: string | null }>;
    },
  ) {
    const { error } = await (supabase as any).rpc("update_purchase_with_inventory", {
      p_purchase_id: id, p_supplier_id: p.supplierId, p_total: p.total * 100, p_payment_type: p.paymentType,
      p_purchase_date: p.purchaseDate, p_notes: p.notes,
      p_supplier_invoice_number: p.supplierInvoiceNumber ?? null, p_due_date: p.dueDate ?? null,
      p_paid_amount: (p.paidAmount ?? 0) * 100, p_subtotal: (p.subtotal ?? p.total) * 100,
      p_discount_amount: (p.discountAmount ?? 0) * 100, p_tax_amount: (p.taxAmount ?? 0) * 100, p_shipping_amount: (p.shippingAmount ?? 0) * 100,
      p_items: p.items.map((item) => ({ name: item.name, unitCost: item.unitCost * 100, quantity: item.quantity, unit: item.unit ?? "قطعة", batchNumber: item.batchNumber ?? null, expiryDate: item.expiryDate ?? null })),
    });
    if (error) throw error;
    await fetchAll();
  },


  async upsertStockDeltas(items: Array<{ name: string; quantity: number; unitCost: number; barcode?: string | null }>) {
    const user_id = await uid();
    for (const it of items) {
      const name = it.name.trim();
      if (!name || it.quantity <= 0) continue;
      let existing: { id: string; quantity: number } | null = null;
      if (it.barcode) {
        const { data } = await supabase
          .from("stock_items")
          .select("id,quantity")
          .eq("user_id", user_id)
          .eq("barcode", it.barcode)
          .maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await supabase
          .from("stock_items")
          .select("id,quantity")
          .eq("user_id", user_id)
          .eq("name", name)
          .maybeSingle();
        existing = data;
      }
      if (existing?.id) {
        const upd: { quantity: number; last_unit_cost: number; barcode?: string } = {
          quantity: Number(existing.quantity) + it.quantity,
          last_unit_cost: (it.unitCost ?? 0) * 100,
        };
        if (it.barcode) upd.barcode = it.barcode;
        await supabase.from("stock_items")
          .update(upd)
          .eq("id", existing.id);
      } else {
        await supabase.from("stock_items").insert({
          user_id, name, quantity: it.quantity, last_unit_cost: (it.unitCost ?? 0) * 100,
          barcode: it.barcode || null,
        });
      }
    }
  },
  async deductStock(items: Array<{ stockId: string; quantity: number }>) {
    const mapped = (items ?? [])
      .filter((it) => it.stockId && it.quantity > 0)
      .map((it) => ({ stock_item_id: it.stockId, quantity: it.quantity }));
    if (mapped.length === 0) return;
    const { error } = await (supabase.rpc as any)("deduct_stock", { p_items: mapped });
    if (error) throw error;
    await fetchAll();
  },
  async recordSupplierPayment(supplierId: string, amount: number) {
    const user_id = await uid();
    const { error } = await supabase.from("supplier_payments").insert({
      user_id, supplier_id: supplierId, amount: (amount ?? 0) * 100,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateSupplierPayment(id: string, amount: number) {
    if (!(amount > 0)) throw new Error("أدخل مبلغ صحيح");
    const { error } = await supabase.from("supplier_payments").update({ amount: (amount ?? 0) * 100 }).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeSupplierPayment(id: string) {
    const { error } = await supabase.from("supplier_payments").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  async updateStockItem(
    id: string,
    patch: Partial<{ name: string; quantity: number; lastUnitCost: number; salePrice: number; barcode: string | null; size: string | null; itemType: string | null; minStock: number; variants: any[]; imageUrl: string | null; supplierId: string | null; category: string | null }>,
    adjustment?: { delta: number; reason: string; notes?: string },
    options?: { skipRefresh?: boolean },
  ) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.quantity !== undefined) upd.quantity = patch.quantity;
    if (patch.lastUnitCost !== undefined) upd.last_unit_cost = (patch.lastUnitCost ?? 0) * 100;
    if (patch.salePrice !== undefined) upd.sale_price = (patch.salePrice ?? 0) * 100;
    if (patch.barcode !== undefined) upd.barcode = patch.barcode || null;
    if (patch.size !== undefined) upd.size = patch.size || null;
    if (patch.itemType !== undefined) upd.item_type = patch.itemType || null;
    if (patch.minStock !== undefined) upd.min_stock = patch.minStock;
    if (patch.variants !== undefined) upd.variants = patch.variants;
    if (patch.imageUrl !== undefined) upd.image_url = patch.imageUrl;
    if (patch.supplierId !== undefined) upd.supplier_id = patch.supplierId;
    if (patch.category !== undefined) upd.category = patch.category;
    try {
      const { error } = await supabase.from("stock_items").update(upd).eq("id", id);
      if (error) throw error;
      if (adjustment && adjustment.delta !== 0) {
        const user_id = await uid();
        await supabase.from("stock_adjustments").insert({
          user_id, stock_item_id: id, delta: adjustment.delta,
          reason: adjustment.reason, notes: adjustment.notes ?? null,
        });
      }
      if (!options?.skipRefresh) await fetchAll();
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        const payload: any = { id, ...upd };
        enqueueOffline({ tableName: "stock_items", operation: "update", payload });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async archiveStockItem(id: string) {
    try {
      const { error } = await supabase.from("stock_items").update({ archived: true }).eq("id", id);
      if (error) throw error;
      await fetchAll();
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        enqueueOffline({ tableName: "stock_items", operation: "update", payload: { id, archived: true } });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async restoreStockItem(id: string) {
    try {
      const { error } = await supabase.from("stock_items").update({ archived: false }).eq("id", id);
      if (error) throw error;
      await fetchAll();
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        enqueueOffline({ tableName: "stock_items", operation: "update", payload: { id, archived: false } });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async hardDeleteStockItem(id: string) {
    try {
      const { error } = await supabase.from("stock_items").delete().eq("id", id);
      if (error) throw error;
      await fetchAll();
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        enqueueOffline({ tableName: "stock_items", operation: "delete", payload: { id } });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async removeStockItem(id: string) {
    // Backwards-compatible alias → archive (soft delete).
    return this.archiveStockItem(id);
  },
  async adjustStock(id: string, delta: number, reason: string, notes?: string) {
    if (!delta) throw new Error("أدخل كمية التعديل");
    try {
      const { data, error } = await (supabase.rpc as any)("adjust_stock_atomic", {
        p_stock_item_id: id,
        p_delta: delta,
        p_reason: reason,
        p_notes: notes?.trim() || null,
      });
      if (error) throw error;
      await fetchAll();
      return Number(data ?? 0);
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        enqueueOffline({ tableName: "stock_items", operation: "update", payload: { id, quantity_delta: delta } });
      } catch { /* ignore */ }
      throw err;
    }
  },
  async addStockItem(item: {
    name: string; quantity?: number; lastUnitCost?: number; salePrice?: number; barcode?: string | null;
    size?: string | null; itemType?: string | null; minStock?: number;
    lowStockAlert?: number; season?: string | null; category?: string | null; notes?: string | null;
    variants?: any[]; imageUrl?: string | null; supplierId?: string | null;
  }, options?: { skipRefresh?: boolean }) {
    let user_id: string;
    try {
      user_id = await uid();
    } catch {
      try {
        const { data } = await supabase.auth.getSession();
        user_id = data.session?.user?.id ?? "";
      } catch { user_id = ""; }
      if (!user_id) throw new Error("Not authenticated");
    }
    try {
      const { data, error } = await supabase.from("stock_items").insert({
        user_id,
        name: item.name,
        quantity: item.quantity ?? 0,
        last_unit_cost: (item.lastUnitCost ?? 0) * 100,
        sale_price: (item.salePrice ?? 0) * 100,
        barcode: item.barcode ?? null,
        size: item.size ?? null,
        item_type: item.itemType ?? null,
        min_stock: item.minStock ?? 0,
      variants: item.variants ?? [],
      image_url: item.imageUrl ?? null,
      supplier_id: item.supplierId ?? null,
      category: item.category ?? null,
      }).select("id").single();
      if (error) throw error;
      if (!options?.skipRefresh) await fetchAll();
      return data?.id as string | undefined;
    } catch (err) {
      try {
        const { enqueueOffline } = await import("./offline-queue");
        const queuedId = `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        enqueueOffline({
          tableName: "stock_items",
          operation: "upsert",
          payload: {
            id: queuedId,
            user_id,
            name: item.name,
            quantity: item.quantity ?? 0,
            last_unit_cost: (item.lastUnitCost ?? 0) * 100,
            sale_price: (item.salePrice ?? 0) * 100,
            barcode: item.barcode ?? null,
            size: item.size ?? null,
            item_type: item.itemType ?? null,
            min_stock: item.minStock ?? 0,
          },
          onConflict: "id",
        });
        return queuedId;
      } catch { /* ignore */ }
      throw err;
    }
  },

  async addWarehouseItem(item: {
    name: string; quantity?: number; unitCost?: number; salePrice?: number;
    season?: WarehouseSeason; category?: string; notes?: string | null;
  }) {
    const user_id = await uid();
    const { data, error } = await supabase.from("warehouse_items").insert({
      user_id,
      name: item.name,
      quantity: item.quantity ?? 0,
      unit_cost: item.unitCost ?? 0,
      sale_price: (item.salePrice ?? 0) * 100,
      season: item.season ?? "all",
      category: item.category ?? "other",
      notes: item.notes ?? null,
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return data?.id as string | undefined;
  },
  async updateWarehouseItem(id: string, patch: Partial<{
    name: string; quantity: number; unitCost: number; salePrice: number;
    season: WarehouseSeason; category: string; notes: string | null;
  }>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.quantity !== undefined) upd.quantity = patch.quantity;
    if (patch.unitCost !== undefined) upd.unit_cost = patch.unitCost;
    if (patch.salePrice !== undefined) upd.sale_price = (patch.salePrice ?? 0) * 100;
    if (patch.season !== undefined) upd.season = patch.season;
    if (patch.category !== undefined) upd.category = patch.category;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    const { error } = await supabase.from("warehouse_items").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeWarehouseItem(id: string) {
    const { error } = await supabase.from("warehouse_items").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  async addReturn(r: {
    invoiceId: string | null;
    purchaseId?: string | null;
    type: "sale" | "supplier";
    totalAmount: number;
    reason: string | null;
    notes: string | null;
    items: Array<{ name: string; unitPrice: number; quantity: number }>;
  }) {
    if (r.type === "sale" && r.invoiceId) {
      const { error } = await supabase.rpc("create_sale_return", {
        p_invoice_id: r.invoiceId,
        p_reason: r.reason?.trim() || "مرتجع بيع",
        p_items: r.items.map((item) => ({ name: item.name, unit_price: (item.unitPrice ?? 0) * 100, quantity: item.quantity })),
      });
      if (error) throw error;
      await fetchAll();
      return;
    }
    if (r.type === "supplier" && r.purchaseId) {
      const { error } = await (supabase.rpc as any)("create_supplier_return", {
        p_purchase_id: r.purchaseId,
        p_reason: r.reason?.trim() || "مرتجع مورد",
        p_items: r.items.map((item) => ({ name: item.name, unit_cost: (item.unitPrice ?? 0) * 100, quantity: item.quantity })),
      });
      if (error) throw error;
      await fetchAll();
      return;
    }
    const user_id = await uid();
    const { data, error } = await supabase.from("return_records").insert({
      user_id,
      invoice_id: r.invoiceId,
      type: r.type,
      total_amount: (r.totalAmount ?? 0) * 100,
      reason: r.reason,
      notes: r.notes,
    }).select("id").single();
    
    if (error) throw error;
    
    const returnId = data?.id;
    if (returnId && r.items.length > 0) {
      const rows = r.items.map((it) => ({
        user_id,
        return_id: returnId,
        name: it.name,
        unit_price: (it.unitPrice ?? 0) * 100,
        quantity: it.quantity,
      }));
      const { error: e2 } = await supabase.from("return_items").insert(rows);
      if (e2) throw e2;
    }
    await fetchAll();
  },
  async removeReturn(id: string) {
    const { error } = await supabase.from("return_records").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addCarrier(c: Omit<ShipmentCarrier, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("shipping_carriers").insert({
      user_id, name: c.name, contact_person: c.contactPerson, phone: c.phone,
      email: c.email, base_cost: c.baseCost * 100, active: c.active
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateCarrier(id: string, patch: Partial<ShipmentCarrier>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.contactPerson !== undefined) upd.contact_person = patch.contactPerson;
    if (patch.phone !== undefined) upd.phone = patch.phone;
    if (patch.email !== undefined) upd.email = patch.email;
    if (patch.baseCost !== undefined) upd.base_cost = patch.baseCost * 100;
    if (patch.active !== undefined) upd.active = patch.active;
    const { error } = await supabase.from("shipping_carriers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addZone(z: Omit<ShippingZone, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("shipping_zones").insert({
      user_id, name: z.name, carrier_id: z.carrierId,
      delivery_cost: z.deliveryCost * 100, estimated_days: z.estimatedDays,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateZone(id: string, patch: Partial<ShippingZone>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.carrierId !== undefined) upd.carrier_id = patch.carrierId;
    if (patch.deliveryCost !== undefined) upd.delivery_cost = patch.deliveryCost * 100;
    if (patch.estimatedDays !== undefined) upd.estimated_days = patch.estimatedDays;
    const { error } = await supabase.from("shipping_zones").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeZone(id: string) {
    const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addShipment(s: Omit<Shipment, "id" | "createdAt">) {
    if (s.status !== "pending") throw new Error("الشحنة الجديدة يجب أن تبدأ بحالة قيد الانتظار");
    const { data, error } = await (supabase as any).rpc("create_invoice_shipment", {
      p_invoice_id: s.invoiceId,
      p_carrier_id: s.carrierId,
      p_zone_id: s.zoneId,
      p_tracking_number: s.trackingNumber,
    });
    if (error) throw error;
    const created = Array.isArray(data) ? data[0] : data;
    const moneyPatch: any = {};
    if (s.shippingCost) moneyPatch.shipping_cost = s.shippingCost * 100;
    if (s.codAmount) moneyPatch.cod_amount = s.codAmount * 100;
    if (s.weightKg) moneyPatch.weight_kg = s.weightKg;
    if (s.pieces) moneyPatch.pieces = s.pieces;
    if (s.expectedDeliveryDate) moneyPatch.expected_delivery_date = s.expectedDeliveryDate;
    if (created?.id && Object.keys(moneyPatch).length) {
      await supabase.from("shipments").update(moneyPatch).eq("id", created.id);
    }
    await fetchAll();
  },
  async updateShipment(id: string, patch: Partial<Shipment>) {
    if (patch.status !== undefined) {
      await this.updateShipmentStatus(id, patch.status);
      delete patch.status;
    }
    const upd: any = {};
    if (patch.carrierId !== undefined) upd.carrier_id = patch.carrierId;
    if (patch.zoneId !== undefined) upd.zone_id = patch.zoneId;
    if (patch.trackingNumber !== undefined) upd.tracking_number = patch.trackingNumber;
    if (patch.recipientName !== undefined) upd.recipient_name = patch.recipientName;
    if (patch.recipientPhone !== undefined) upd.recipient_phone = patch.recipientPhone;
    if (patch.deliveryAddress !== undefined) upd.delivery_address = patch.deliveryAddress;
    if (patch.shippingCost !== undefined) upd.shipping_cost = patch.shippingCost * 100;
    if (patch.codAmount !== undefined) upd.cod_amount = patch.codAmount * 100;
    if (patch.weightKg !== undefined) upd.weight_kg = patch.weightKg;
    if (patch.pieces !== undefined) upd.pieces = patch.pieces;
    if (patch.expectedDeliveryDate !== undefined) upd.expected_delivery_date = patch.expectedDeliveryDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (Object.keys(upd).length === 0) return;
    const { error } = await supabase.from("shipments").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async updateShipmentStatus(id: string, status: ShipmentStatus, reason?: string) {
    const { error } = await supabase.from("shipments").update({ status, notes: reason?.trim() || null }).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async bulkShipmentStatus(ids: string[], status: ShipmentStatus, reason?: string) {
    let ok = 0; const errors: string[] = [];
    for (const id of ids) {
      const { error } = await supabase.from("shipments").update({ status, notes: reason?.trim() || null }).eq("id", id);
      if (error) errors.push(error.message); else ok += 1;
    }
    await fetchAll();
    return { ok, errors };
  },
  async bulkAssignCarrier(ids: string[], carrierId: string) {
    const { error } = await supabase.from("shipments").update({ carrier_id: carrierId }).in("id", ids);
    if (error) throw error;
    await fetchAll();
  },
  async settleCarrierCollections(carrierId: string) {
    const { data, error } = await supabase.rpc("settle_carrier_collections", { p_carrier_id: carrierId });
    if (error) throw error;
    await fetchAll();
    return Number(data ?? 0);
  },
};

// ─── React hook ───────────────────────────────────────────────────────────────

export function useDB(): DBState {
  const [, setTick] = useState(0);
  const refresh = useCallback(async () => { await fetchAll(); }, []);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    if (!loaded) {
      // Hydrate from IndexedDB first (fast, offline-ready), then fetch fresh data
      hydrateFromIDB().then(() => {
        if (!loaded) fetchAll();
      }).catch(() => {
        if (!loaded) fetchAll();
      });
    }
    return () => { listeners.delete(l); };
  }, []);
  return { 
    ...cache, 
    loading, 
    refresh,
    fetchErrors: lastFetchErrors,
    carriers: cache.carriers,
    zones: cache.zones,
    shipments: cache.shipments,

    addBranch: db.addBranch,
    updateBranch: db.updateBranch,
    removeBranch: db.removeBranch,
    addPaymentVoucher: db.addPaymentVoucher,
    removePaymentVoucher: db.removePaymentVoucher,
    addPurchase: db.addPurchase,
    removePurchase: db.removePurchase,
    getFinancialReport: db.getFinancialReport,
    addCarrier: db.addCarrier,
    updateCarrier: db.updateCarrier,
    addZone: db.addZone,
    updateZone: db.updateZone,
    removeZone: db.removeZone,
    addShipment: db.addShipment,
    updateShipment: db.updateShipment,
    updateShipmentStatus: db.updateShipmentStatus,
    settleCarrierCollections: db.settleCarrierCollections,
  };
}
