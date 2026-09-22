import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveCacheToIDB, loadCacheFromIDB } from "@/lib/db-cache";

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

async function fetchAll() {
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

  cache = {
    customers: (c.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, phone: r.phone, rating: r.rating,
      status: r.status as CustomerStatus, customerType: (r.customer_type ?? 'installment') as CustomerType,
      notes: r.notes, frozen: r.frozen,
      address: r.address, joiningDate: r.joining_date,
      creditLimit: Number(r.credit_limit ?? 0), dueDay: r.due_day ?? 1,
      openingBalance: Number(r.opening_balance ?? 0), nationalId: r.national_id,
      createdAt: r.created_at,
    })),
    invoices: (i.data ?? []).map((r: any) => ({
      id: r.id, customerId: r.customer_id, total: Number(r.total),
      downPayment: Number(r.down_payment), monthlyInstallment: Number(r.monthly_installment),
      firstDueDate: r.first_due_date, paid: Number(r.paid), notes: r.notes, createdAt: r.created_at,
      discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0),
      taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0),
      status: (r.status ?? "pending") as InvoiceStatus, invoiceNumber: r.invoice_number, date: r.date || r.created_at,
      receiptToken: r.receipt_token,
    })),
    payments: (p.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, amount: Number(r.amount), paidAt: r.paid_at,
    })),
    expenses: (e.data ?? []).map((r: any) => ({
      id: r.id, amount: Number(r.amount), category: r.category as ExpenseCategory,
      expenseDate: r.expense_date, notes: r.notes, createdAt: r.created_at,
    })),
    invoiceItems: (ii.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, name: r.name,
      cost: Number(r.cost ?? 0), price: Number(r.price ?? 0), quantity: Number(r.quantity ?? 1),
      discountPct: Number(r.discount_pct ?? 0), discountAmount: Number(r.discount_amount ?? 0),
      taxPct: Number(r.tax_pct ?? 0), taxAmount: Number(r.tax_amount ?? 0),
      lineTotal: Number(r.line_total ?? (Number(r.price ?? 0) * Number(r.quantity ?? 1))),
      serialNumbers: Array.isArray(r.serial_numbers) ? r.serial_numbers : [], createdAt: r.created_at,
    })),
    suppliers: (s.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, contact: r.contact ?? "", notes: r.notes,
      openingBalance: Number(r.opening_balance ?? 0), nationalId: r.national_id, createdAt: r.created_at,
    })),
    purchases: (pu.data ?? []).map((r: any) => ({
      id: r.id, supplierId: r.supplier_id, total: Number(r.total),
      paymentType: r.payment_type as PurchasePaymentType,
      purchaseDate: r.purchase_date, notes: r.notes, createdAt: r.created_at,
    })),
    purchaseItems: (pi.data ?? []).map((r: any) => ({
      id: r.id, purchaseId: r.purchase_id, name: r.name,
      unitCost: Number(r.unit_cost ?? 0), quantity: Number(r.quantity ?? 1), createdAt: r.created_at,
    })),
    supplierPayments: (sp.data ?? []).map((r: any) => ({
      id: r.id, supplierId: r.supplier_id, amount: Number(r.amount), paidAt: r.paid_at,
    })),
    stockItems: (st.data ?? []).map((r: any) => ({
      id: r.id, name: r.name,
      quantity: Number(r.quantity ?? 0),
      lastUnitCost: Number(r.last_unit_cost ?? 0),
      salePrice: Number(r.sale_price ?? 0),
      barcode: r.barcode ?? null,
      size: r.size ?? null,
      itemType: r.item_type ?? null,
      minStock: Number(r.min_stock ?? 0),
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    warehouseItems: (wh.data ?? []).map((r: any) => ({
      id: r.id, name: r.name,
      quantity: Number(r.quantity ?? 0),
      unitCost: Number(r.unit_cost ?? 0),
      salePrice: Number(r.sale_price ?? 0),
      season: (r.season ?? "all") as WarehouseSeason,
      category: r.category ?? "other",
      notes: r.notes ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    returns: (rr.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, type: r.type as "sale" | "supplier",
      totalAmount: Number(r.total_amount), reason: r.reason, notes: r.notes, createdAt: r.created_at,
    })),
    returnItems: (ri.data ?? []).map((r: any) => ({
      id: r.id, returnId: r.return_id, name: r.name,
      unitPrice: Number(r.unit_price), quantity: Number(r.quantity), createdAt: r.created_at,
    })),
    branches: (br.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, location: r.location, phone: r.phone,
      managerName: r.manager_name, isMain: r.is_main, createdAt: r.created_at,
    })),
    paymentVouchers: (pv.data ?? []).map((r: any) => ({
      id: r.id, customerId: r.customer_id, supplierId: r.supplier_id,
      amount: Number(r.amount), type: r.type as "receipt" | "payment",
      paymentMethod: r.payment_method, description: r.description,
      voucherDate: r.voucher_date, createdAt: r.created_at, partyName: r.party_name, partyPhone: r.party_phone,
    })),
    carriers: (sc.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, contactPerson: r.contact_person, phone: r.phone,
      email: r.email, baseCost: Number(r.base_cost ?? 0), active: r.active, createdAt: r.created_at,
    })),
    zones: (sz.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, carrierId: r.carrier_id,
      deliveryCost: Number(r.delivery_cost ?? 0), estimatedDays: r.estimated_days ?? 2, createdAt: r.created_at,
    })),
    shipments: (sh.data ?? []).map((r: any) => ({
      id: r.id, invoiceId: r.invoice_id, carrierId: r.carrier_id, zoneId: r.zone_id,
      trackingNumber: r.tracking_number, status: r.status as ShipmentStatus,
      recipientName: r.recipient_name, recipientPhone: r.recipient_phone,
      deliveryAddress: r.delivery_address, actualDeliveryDate: r.actual_delivery_date,
      processingAt: r.processing_at ?? null, shippedAt: r.shipped_at ?? null,
      deliveredAt: r.delivered_at ?? null, returnedAt: r.returned_at ?? null,
      statusUpdatedBy: r.status_updated_by ?? null,
      shippingCost: Number(r.shipping_cost ?? 0),
      codAmount: Number(r.cod_amount ?? 0),
      collectionStatus: (r.collection_status ?? "uncollected") as ShipmentCollectionStatus,
      collectedAt: r.collected_at ?? null,
      settledAt: r.settled_at ?? null,
      weightKg: Number(r.weight_kg ?? 0),
      pieces: Number(r.pieces ?? 1),
      expectedDeliveryDate: r.expected_delivery_date ?? null,
      notes: r.notes, createdAt: r.created_at,
    })),

  };
  loading = false;
  loaded = true;
  notify();
  // Persist to IndexedDB so the app works offline after reload
  saveCacheToIDB(cache).catch(() => {});
}

export async function invalidateCache() {
  loaded = false;
  await fetchAll();
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

async function restoreStockByName(items: Array<{ name: string; quantity: number }>) {
  const user_id = await uid();
  const merged = new Map<string, number>();
  for (const it of items) {
    const name = (it.name || "").trim();
    if (!name || !it.quantity) continue;
    merged.set(name, (merged.get(name) ?? 0) + it.quantity);
  }
  for (const [name, qty] of merged) {
    const { data: existing } = await supabase
      .from("stock_items").select("id,quantity")
      .eq("user_id", user_id).eq("name", name).maybeSingle();
    if (!existing?.id) continue;
    await supabase.from("stock_items")
      .update({ quantity: Math.max(0, Number(existing.quantity) + qty) })
      .eq("id", existing.id);
  }
}

function invoiceItemFinancials(item: {
  price: number;
  quantity?: number;
  discountPct?: number;
  taxPct?: number;
  serialNumbers?: string[];
}) {
  const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
  const gross = Math.max(0, Number(item.price) * quantity);
  const discountPct = Math.min(100, Math.max(0, Number(item.discountPct ?? 0)));
  const discountAmount = gross * discountPct / 100;
  const taxable = Math.max(0, gross - discountAmount);
  const taxPct = Math.max(0, Number(item.taxPct ?? 0));
  const taxAmount = taxable * taxPct / 100;
  return {
    discount_pct: discountPct,
    discount_amount: discountAmount,
    tax_pct: taxPct,
    tax_amount: taxAmount,
    line_total: taxable + taxAmount,
    serial_numbers: (item.serialNumbers ?? []).map((value) => value.trim()).filter(Boolean),
  };
}

// ─── DB object ────────────────────────────────────────────────────────────────

export const db = {

  invalidate: fetchAll,
  async addCustomer(c: Partial<Omit<Customer, "id" | "createdAt">> & { name: string }): Promise<Customer | undefined> {
    const user_id = await uid();
    const { data: inserted, error } = await supabase.from("customers").insert({
      user_id, name: c.name, phone: c.phone ?? "", rating: c.rating, status: c.status,
      customer_type: c.customerType ?? 'installment',
      notes: c.notes, frozen: c.frozen,
      address: c.address, joining_date: c.joiningDate,
      credit_limit: c.creditLimit, due_day: c.dueDay,
      opening_balance: c.openingBalance,
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return inserted ? ({ ...(c as any), id: inserted.id, createdAt: new Date().toISOString() } as Customer) : undefined;
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
    if (patch.joiningDate !== undefined) upd.joining_date = patch.joiningDate;
    if (patch.creditLimit !== undefined) upd.credit_limit = patch.creditLimit;
    if (patch.dueDay !== undefined) upd.due_day = patch.dueDay;
    if (patch.openingBalance !== undefined) upd.opening_balance = patch.openingBalance;
    const { error } = await supabase.from("customers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeCustomer(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addInvoice(inv: Omit<Invoice, "id" | "createdAt" | "paid" | "receiptToken"> & { paid?: number; items?: Array<{ name: string; cost: number; price: number; quantity?: number; discountPct?: number; taxPct?: number; serialNumbers?: string[] }> }) {
    const user_id = await uid();
    await assertInvoiceAllowed(inv);

    const { data, error } = await supabase.from("invoices").insert({
      user_id, customer_id: inv.customerId, total: inv.total, down_payment: inv.downPayment,
      monthly_installment: inv.monthlyInstallment, first_due_date: inv.firstDueDate,
      paid: inv.paid ?? inv.downPayment, notes: inv.notes,
      discount_pct: inv.discountPct ?? 0, discount_amount: inv.discountAmount ?? 0,
      tax_pct: inv.taxPct ?? 0, tax_amount: inv.taxAmount ?? 0,
      status: inv.status ?? "pending",
    }).select("id").single();
    if (error) throw error;
    if (inv.items && inv.items.length > 0 && data?.id) {
      const rows = inv.items.map((it) => ({
        user_id, invoice_id: data.id, name: it.name, cost: it.cost, price: it.price,
        quantity: Math.max(1, Math.floor(it.quantity ?? 1)),
        ...invoiceItemFinancials(it),
      }));
      const { error: e2 } = await supabase.from("invoice_items").insert(rows);
      if (e2) throw e2;
    }
    await fetchAll();
  },
  async addInvoiceItem(invoiceId: string, item: { name: string; cost: number; price: number; quantity?: number; discountPct?: number; taxPct?: number; serialNumbers?: string[] }) {
    const user_id = await uid();
    const { error } = await supabase.from("invoice_items").insert({
      user_id, invoice_id: invoiceId, name: item.name, cost: item.cost, price: item.price,
      quantity: Math.max(1, Math.floor(item.quantity ?? 1)), ...invoiceItemFinancials(item),
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateInvoiceItem(id: string, patch: Partial<{ name: string; cost: number; price: number; quantity: number; discountPct: number; taxPct: number; serialNumbers: string[] }>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.cost !== undefined) upd.cost = patch.cost;
    if (patch.price !== undefined) upd.price = patch.price;
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
    const { error } = await supabase.from("invoice_items").delete().eq("id", id);
    if (error) throw error;
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
      amount: v.amount, type: v.type, payment_method: v.paymentMethod,
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
    const { data: items } = await supabase
      .from("invoice_items").select("name").eq("invoice_id", id);
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw error;
    if (items && items.length > 0) {
      await restoreStockByName(items.map((it: any) => ({ name: it.name, quantity: 1 })));
    }
    await fetchAll();
  },

  async updateInvoice(id: string, patch: Partial<Pick<Invoice, "total" | "downPayment" | "monthlyInstallment" | "firstDueDate" | "notes" | "status" | "paid">>) {
    const upd: any = {};
    if (patch.total !== undefined) upd.total = patch.total;
    if (patch.downPayment !== undefined) upd.down_payment = patch.downPayment;
    if (patch.monthlyInstallment !== undefined) upd.monthly_installment = patch.monthlyInstallment;
    if (patch.firstDueDate !== undefined) upd.first_due_date = patch.firstDueDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.paid !== undefined) upd.paid = patch.paid;
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
    const { error } = await supabase.from("stock_items").update({ last_unit_cost: cost }).eq("id", stockId);
    if (error) throw error;
    await fetchAll();
  },
  async updatePayment(id: string, amount: number) {
    const { error } = await supabase.rpc("update_invoice_payment", { p_payment_id: id, p_amount: amount });
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
      p_amount: amount,
      p_payment_id: crypto.randomUUID(),
    });
    if (error) throw error;
    await fetchAll();
  },
  async addExpense(exp: Omit<Expense, "id" | "createdAt">): Promise<string | undefined> {
    const user_id = await uid();
    const { data, error } = await supabase.from("expenses").insert({
      user_id, amount: exp.amount, category: exp.category,
      expense_date: exp.expenseDate, notes: exp.notes,
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return (data as { id?: string } | null)?.id;
  },
  async updateExpense(id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) {
    const upd: any = {};
    if (patch.amount !== undefined) upd.amount = patch.amount;
    if (patch.category !== undefined) upd.category = patch.category;
    if (patch.expenseDate !== undefined) upd.expense_date = patch.expenseDate;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    const { error } = await supabase.from("expenses").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },

  async addSupplier(s: Omit<Supplier, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("suppliers").insert({
      user_id, name: s.name, contact: s.contact, notes: s.notes,
      opening_balance: s.openingBalance,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateSupplier(id: string, patch: Partial<Omit<Supplier, "id" | "createdAt">>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.contact !== undefined) upd.contact = patch.contact;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (patch.openingBalance !== undefined) upd.opening_balance = patch.openingBalance;
    const { error } = await supabase.from("suppliers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async removeSupplier(id: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addPurchase(
    p: Omit<Purchase, "id" | "createdAt"> & { items: Array<{ name: string; unitCost: number; quantity: number }> }
  ) {
    const { error } = await (supabase as any).rpc("record_purchase_with_inventory", {
      p_supplier_id: p.supplierId, p_total: p.total, p_payment_type: p.paymentType,
      p_purchase_date: p.purchaseDate, p_notes: p.notes, p_items: p.items.map((item) => ({ name: item.name, unitCost: item.unitCost, quantity: item.quantity })),
    });
    if (error) throw error;
    await fetchAll();
  },
  async removePurchase(id: string) {
    const { error } = await supabase.rpc("delete_purchase_with_inventory", { p_purchase_id: id });
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
      purchaseDate: string; notes: string | null;
      items: Array<{ name: string; unitCost: number; quantity: number }>;
    },
  ) {
    const { error } = await (supabase as any).rpc("update_purchase_with_inventory", {
      p_purchase_id: id, p_supplier_id: p.supplierId, p_total: p.total, p_payment_type: p.paymentType,
      p_purchase_date: p.purchaseDate, p_notes: p.notes, p_items: p.items.map((item) => ({ name: item.name, unitCost: item.unitCost, quantity: item.quantity })),
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
          last_unit_cost: it.unitCost,
        };
        if (it.barcode) upd.barcode = it.barcode;
        await supabase.from("stock_items")
          .update(upd)
          .eq("id", existing.id);
      } else {
        await supabase.from("stock_items").insert({
          user_id, name, quantity: it.quantity, last_unit_cost: it.unitCost,
          barcode: it.barcode || null,
        });
      }
    }
  },
  async deductStock(items: Array<{ stockId: string; quantity: number }>) {
    for (const it of items) {
      if (!it.stockId || it.quantity <= 0) continue;
      const { data: existing } = await supabase
        .from("stock_items")
        .select("quantity")
        .eq("id", it.stockId)
        .maybeSingle();
      const current = Number(existing?.quantity ?? 0);
      const next = Math.max(0, current - it.quantity);
      await supabase.from("stock_items")
        .update({ quantity: next })
        .eq("id", it.stockId);
    }
  },
  async recordSupplierPayment(supplierId: string, amount: number) {
    const user_id = await uid();
    const { error } = await supabase.from("supplier_payments").insert({
      user_id, supplier_id: supplierId, amount,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateSupplierPayment(id: string, amount: number) {
    if (!(amount > 0)) throw new Error("أدخل مبلغ صحيح");
    const { error } = await supabase.from("supplier_payments").update({ amount }).eq("id", id);
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
    patch: Partial<{ name: string; quantity: number; lastUnitCost: number; salePrice: number; barcode: string | null; size: string | null; itemType: string | null; minStock: number }>,
    adjustment?: { delta: number; reason: string; notes?: string },
  ) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.quantity !== undefined) upd.quantity = patch.quantity;
    if (patch.lastUnitCost !== undefined) upd.last_unit_cost = patch.lastUnitCost;
    if (patch.salePrice !== undefined) upd.sale_price = patch.salePrice;
    if (patch.barcode !== undefined) upd.barcode = patch.barcode || null;
    if (patch.size !== undefined) upd.size = patch.size || null;
    if (patch.itemType !== undefined) upd.item_type = patch.itemType || null;
    if (patch.minStock !== undefined) upd.min_stock = patch.minStock;
    const { error } = await supabase.from("stock_items").update(upd).eq("id", id);
    if (error) throw error;
    if (adjustment && adjustment.delta !== 0) {
      const user_id = await uid();
      await supabase.from("stock_adjustments").insert({
        user_id, stock_item_id: id, delta: adjustment.delta,
        reason: adjustment.reason, notes: adjustment.notes ?? null,
      });
    }
    await fetchAll();
  },
  async removeStockItem(id: string) {
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async adjustStock(id: string, delta: number, reason: string, notes?: string) {
    if (!delta) throw new Error("أدخل كمية التعديل");
    const user_id = await uid();
    const { data: existing, error: e0 } = await supabase
      .from("stock_items").select("quantity").eq("id", id).single();
    if (e0) throw e0;
    const next = Math.max(0, Number(existing?.quantity ?? 0) + delta);
    const applied = next - Number(existing?.quantity ?? 0);
    const { error: e1 } = await supabase.from("stock_items").update({ quantity: next }).eq("id", id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("stock_adjustments").insert({
      user_id, stock_item_id: id, delta: applied, reason, notes: notes?.trim() || null,
    });
    if (e2) throw e2;
    await fetchAll();
    return next;
  },
  async addStockItem(item: {
    name: string; quantity?: number; lastUnitCost?: number; salePrice?: number; barcode?: string | null;
    size?: string | null; itemType?: string | null; minStock?: number;
    lowStockAlert?: number; season?: string | null; category?: string | null; notes?: string | null;
  }) {
    const user_id = await uid();
    const { data, error } = await supabase.from("stock_items").insert({
      user_id,
      name: item.name,
      quantity: item.quantity ?? 0,
      last_unit_cost: item.lastUnitCost ?? 0,
      sale_price: item.salePrice ?? 0,
      barcode: item.barcode ?? null,
      size: item.size ?? null,
      item_type: item.itemType ?? null,
      min_stock: item.minStock ?? 0,
    }).select("id").single();
    if (error) throw error;
    await fetchAll();
    return data?.id as string | undefined;
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
      sale_price: item.salePrice ?? 0,
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
    if (patch.salePrice !== undefined) upd.sale_price = patch.salePrice;
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
        p_items: r.items.map((item) => ({ name: item.name, unit_price: item.unitPrice, quantity: item.quantity })),
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
      total_amount: r.totalAmount,
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
        unit_price: it.unitPrice,
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
      email: c.email, base_cost: c.baseCost, active: c.active
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
    if (patch.baseCost !== undefined) upd.base_cost = patch.baseCost;
    if (patch.active !== undefined) upd.active = patch.active;
    const { error } = await supabase.from("shipping_carriers").update(upd).eq("id", id);
    if (error) throw error;
    await fetchAll();
  },
  async addZone(z: Omit<ShippingZone, "id" | "createdAt">) {
    const user_id = await uid();
    const { error } = await supabase.from("shipping_zones").insert({
      user_id, name: z.name, carrier_id: z.carrierId,
      delivery_cost: z.deliveryCost, estimated_days: z.estimatedDays,
    });
    if (error) throw error;
    await fetchAll();
  },
  async updateZone(id: string, patch: Partial<ShippingZone>) {
    const upd: any = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.carrierId !== undefined) upd.carrier_id = patch.carrierId;
    if (patch.deliveryCost !== undefined) upd.delivery_cost = patch.deliveryCost;
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
    if (s.shippingCost) moneyPatch.shipping_cost = s.shippingCost;
    if (s.codAmount) moneyPatch.cod_amount = s.codAmount;
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
    if (patch.shippingCost !== undefined) upd.shipping_cost = patch.shippingCost;
    if (patch.codAmount !== undefined) upd.cod_amount = patch.codAmount;
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
