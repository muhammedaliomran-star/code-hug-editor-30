/**
 * مزامنة بيانات الموظفين والورديات مع قاعدة البيانات السحابية.
 */

import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/retry";
import { enqueueOffline } from "@/lib/offline-queue";
import type { StaffMember, AttendanceRecord, ShiftRecord } from "@/lib/staff";
import type { CashShift } from "@/lib/shifts";
import type { CashierShift } from "@/lib/cashier-shifts";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ==================== Staff Members ==================== */

export async function pushStaffMember(member: StaffMember): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: member.id, user_id, name: member.name, phone: member.phone, role: member.role, pin_code: member.pinCode || null, branch_name: member.branchName || null, is_active: member.active, commission_pct: member.commissionRatePct || 0, base_salary: member.baseSalary || 0, permissions: member.permissions, notes: member.notes || null };
  try { await withRetry(() => table("staff_members").upsert(payload)); } catch { enqueueOffline({ tableName: "staff_members", operation: "upsert", payload }); }
}

export async function removeStaffMember(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  try { await withRetry(() => table("staff_members").delete().eq("user_id", user_id).eq("id", id)); } catch { enqueueOffline({ tableName: "staff_members", operation: "delete", payload: { id, user_id } }); }
}

/* ==================== Shift Records (staff.ts) ==================== */

export async function pushShift(shift: ShiftRecord): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: shift.id, user_id, shift_number: shift.shiftNumber, cashier_name: shift.staffName, opened_at: shift.openedAt, closed_at: shift.closedAt || null, opening_balance: shift.openingFloat, expected_cash: shift.expectedClosingCash, actual_cash: shift.actualClosingCash, cash_sales: shift.totalCashSales, electronic_sales: shift.totalCardSales, installment_sales: shift.totalInstallmentSales, expenses: shift.totalExpensesAmount, returns: shift.totalRefundsAmount, variance: shift.cashVariance, status: shift.status, notes: shift.closeNotes || null };
  try { await withRetry(() => table("shifts").upsert(payload)); } catch { enqueueOffline({ tableName: "shifts", operation: "upsert", payload }); }
}

/* ==================== Attendance Records ==================== */

export async function pushAttendance(record: AttendanceRecord): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: record.id, user_id, staff_id: record.staffId, staff_name: record.staffName, branch_name: record.branchName, date: record.date, clock_in: record.clockIn, clock_out: record.clockOut || null, total_hours: record.totalHours || 0, notes: record.notes || null, status: record.status };
  try { await withRetry(() => table("staff_attendance").upsert(payload)); } catch { enqueueOffline({ tableName: "staff_attendance", operation: "upsert", payload }); }
}

/* ==================== Shifts (shifts.ts) ==================== */

export async function pushCashShift(shift: CashShift): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: shift.id, user_id, shift_number: shift.shiftNumber, cashier_name: shift.cashierName, opened_at: shift.openedAt, closed_at: shift.closedAt || null, opening_balance: shift.openingBalance, expected_cash: shift.expectedCash, actual_cash: shift.closingCashCount, cash_sales: shift.totalCashSales, electronic_sales: shift.totalElectronicSales, installment_sales: shift.totalInstallmentCash, expenses: shift.totalExpenses, purchases: shift.totalPurchases, returns: shift.totalReturns, variance: shift.variance, status: shift.status, notes: shift.notes || null };
  try { await withRetry(() => table("shifts").upsert(payload)); } catch { enqueueOffline({ tableName: "shifts", operation: "upsert", payload }); }
}

/* ==================== CashierShifts (cashier-shifts.ts) ==================== */

export async function pushCashierShift(shift: CashierShift): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  const payload = { id: shift.id, user_id, shift_number: 0, cashier_name: shift.cashierName, opened_at: shift.openedAt, closed_at: shift.closedAt || null, opening_balance: shift.openingCash, expected_cash: shift.expectedCash, actual_cash: shift.actualCash, cash_sales: shift.summary?.cashSales || 0, installment_sales: shift.summary?.installmentDownPayments || 0, expenses: shift.summary?.cashExpenses || 0, variance: shift.difference, status: shift.status, notes: shift.notes || null };
  try { await withRetry(() => table("shifts").upsert(payload)); } catch { enqueueOffline({ tableName: "shifts", operation: "upsert", payload }); }
}

/* ==================== Pull ==================== */

export async function pullStaffFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const [staffRes, shiftRes, attRes] = await Promise.all([
    table("staff_members").select("*").eq("user_id", user_id),
    table("shifts").select("*").eq("user_id", user_id).order("opened_at", { ascending: false }),
    table("staff_attendance").select("*").eq("user_id", user_id).order("date", { ascending: false }),
  ]);

  const staffMod = await import("@/lib/staff");

  // Restore staff members
  if (!staffRes.error && Array.isArray(staffRes.data) && staffRes.data.length > 0) {
    const members: StaffMember[] = staffRes.data.map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      role: r.role,
      pinCode: r.pin_code,
      branchName: r.branch_name,
      active: r.is_active,
      commissionRatePct: Number(r.commission_pct || 0),
      baseSalary: Number(r.base_salary || 0),
      permissions: r.permissions || (staffMod.ROLE_DEFAULT_PERMISSIONS as any)[r.role || "cashier"],
      notes: r.notes,
      createdAt: r.created_at,
    }));
    localStorage.setItem("segilly_staff_members_v1", JSON.stringify(members));
  }

  // Restore shifts
  if (!shiftRes.error && Array.isArray(shiftRes.data) && shiftRes.data.length > 0) {
    const shifts: ShiftRecord[] = shiftRes.data.map((r: any) => ({
      id: r.id,
      shiftNumber: r.shift_number || 0,
      staffId: "",
      staffName: r.cashier_name || "",
      staffRole: "cashier" as const,
      branchName: "الفرع الرئيسي",
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      status: r.status || "closed",
      openingFloat: Number(r.opening_balance || 0),
      actualClosingCash: Number(r.actual_cash || 0),
      expectedClosingCash: Number(r.expected_cash || 0),
      cashVariance: Number(r.variance || 0),
      totalCashSales: Number(r.cash_sales || 0),
      totalCardSales: Number(r.electronic_sales || 0),
      totalInstallmentSales: Number(r.installment_sales || 0),
      totalGrossSales: (Number(r.cash_sales || 0) + Number(r.electronic_sales || 0) + Number(r.installment_sales || 0)),
      totalDiscountsGiven: 0,
      totalRefundsAmount: Number(r.returns || 0),
      totalExpensesAmount: Number(r.expenses || 0),
      invoicesCount: 0,
      refundsCount: 0,
      closeNotes: r.notes,
    }));
    localStorage.setItem("segilly_shifts_records_v1", JSON.stringify(shifts));
    localStorage.setItem("segilly:cash_shifts", JSON.stringify(shifts));
  }

  // Restore attendance
  if (!attRes.error && Array.isArray(attRes.data) && attRes.data.length > 0) {
    const records: AttendanceRecord[] = attRes.data.map((r: any) => ({
      id: r.id,
      staffId: r.staff_id,
      staffName: r.staff_name,
      branchName: r.branch_name,
      date: r.date,
      clockIn: r.clock_in,
      clockOut: r.clock_out,
      totalHours: Number(r.total_hours || 0),
      notes: r.notes,
      status: r.status || "completed",
    }));
    localStorage.setItem("segilly_staff_attendance_v1", JSON.stringify(records));
  }

  return true;
}
