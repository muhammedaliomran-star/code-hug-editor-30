/**
 * مزامنة نظام الفروع والمخزون مع قاعدة البيانات السحابية.
 */

import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/retry";
import { enqueueOffline } from "@/lib/offline-queue";
import type { BranchStockItem, BranchTransfer, BranchShift, BranchRemittance } from "@/lib/branch-system";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ==================== Push Functions ==================== */

export async function pushBranchStock(item: BranchStockItem): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: item.id, user_id, branch_id: item.branchId, stock_item_id: item.stockItemId, quantity: item.quantity, min_stock: item.minStock, max_stock: item.maxStock || null, shelf_location: item.shelfLocation || null };
  try { await withRetry(() => table("branch_stock").upsert(payload)); } catch { enqueueOffline({ tableName: "branch_stock", operation: "upsert", payload }); }
}

export async function pushBranchTransfer(transfer: BranchTransfer): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: transfer.id, user_id, transfer_number: transfer.transferNumber, from_branch_id: transfer.fromBranchId, to_branch_id: transfer.toBranchId, status: transfer.status, items: transfer.items, notes: transfer.notes || null, driver_name: transfer.driverName || null, driver_phone: transfer.driverPhone || null, vehicle_number: transfer.vehicleNumber || null, created_by: transfer.createdBy, dispatched_by: transfer.dispatchedBy || null, received_by: transfer.receivedBy || null, dispatched_at: transfer.dispatchedAt || null, received_at: transfer.receivedAt || null };
  try { await withRetry(() => table("branch_transfers").upsert(payload)); } catch { enqueueOffline({ tableName: "branch_transfers", operation: "upsert", payload }); }
}

export async function pushBranchShift(shift: BranchShift): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: shift.id, user_id, shift_number: 0, cashier_name: shift.cashierName, opened_at: shift.openedAt, closed_at: shift.closedAt || null, opening_balance: shift.openingBalance, expected_cash: shift.expectedCash, actual_cash: shift.actualCash, cash_sales: shift.systemCashSales, installment_sales: shift.systemInstallmentsCash, expenses: shift.systemExpenses, variance: shift.variance, status: shift.status, notes: shift.notes || null };
  try { await withRetry(() => table("shifts").upsert(payload)); } catch { enqueueOffline({ tableName: "shifts", operation: "upsert", payload }); }
}

export async function pushBranchRemittance(remittance: BranchRemittance): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: remittance.id, user_id, from_account_id: remittance.branchId, to_account_id: remittance.destinationName, amount: remittance.amount, type: "remittance", status: remittance.status, notes: remittance.notes || null };
  try { await withRetry(() => table("treasury_transactions").upsert(payload)); } catch { enqueueOffline({ tableName: "treasury_transactions", operation: "upsert", payload }); }
}

/* ==================== Pull Functions ==================== */

export async function pullBranchDataFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const [stockRes, transferRes, shiftRes] = await Promise.all([
    table("branch_stock").select("*").eq("user_id", user_id),
    table("branch_transfers").select("*").eq("user_id", user_id).order("created_at", { ascending: false }),
    table("shifts").select("*").eq("user_id", user_id).order("opened_at", { ascending: false }),
  ]);

  // Restore branch stock
  if (!stockRes.error && Array.isArray(stockRes.data)) {
    const stock: BranchStockItem[] = stockRes.data.map((r: any) => ({
      id: r.id,
      branchId: r.branch_id,
      stockItemId: r.stock_item_id,
      quantity: Number(r.quantity || 0),
      minStock: Number(r.min_stock || 3),
      maxStock: r.max_stock ? Number(r.max_stock) : undefined,
      shelfLocation: r.shelf_location,
      updatedAt: r.updated_at || new Date().toISOString(),
    }));
    localStorage.setItem("segilly_branch_stock_v1", JSON.stringify(stock));
  }

  // Restore transfers
  if (!transferRes.error && Array.isArray(transferRes.data)) {
    const transfers: BranchTransfer[] = transferRes.data.map((r: any) => ({
      id: r.id,
      transferNumber: r.transfer_number,
      fromBranchId: r.from_branch_id,
      toBranchId: r.to_branch_id,
      status: r.status,
      items: r.items || [],
      notes: r.notes,
      driverName: r.driver_name,
      driverPhone: r.driver_phone,
      vehicleNumber: r.vehicle_number,
      createdBy: r.created_by,
      dispatchedBy: r.dispatched_by,
      receivedBy: r.received_by,
      createdAt: r.created_at,
      dispatchedAt: r.dispatched_at,
      receivedAt: r.received_at,
    }));
    localStorage.setItem("segilly_branch_transfers_v1", JSON.stringify(transfers));
  }

  // Restore branch shifts
  if (!shiftRes.error && Array.isArray(shiftRes.data)) {
    const shifts: BranchShift[] = shiftRes.data
      .filter((r: any) => r.shift_number === 0) // Only branch-specific shifts
      .map((r: any) => ({
        id: r.id,
        branchId: "",
        shiftNumber: r.shift_number ? String(r.shift_number) : "Z-0001",
        cashierName: r.cashier_name || "",
        openedAt: r.opened_at,
        closedAt: r.closed_at,
        openingBalance: Number(r.opening_balance || 0),
        systemCashSales: Number(r.cash_sales || 0),
        systemInstallmentsCash: Number(r.installment_sales || 0),
        systemExpenses: Number(r.expenses || 0),
        systemRemittances: 0,
        expectedCash: Number(r.expected_cash || 0),
        actualCash: Number(r.actual_cash || 0),
        variance: Number(r.variance || 0),
        status: r.status || "closed",
        notes: r.notes,
      }));
    localStorage.setItem("segilly_branch_shifts_v1", JSON.stringify(shifts));
  }

  return true;
}
