import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type StaffRole } from "@/lib/staff";

export type AuditActionType =
  | "INVOICE_CREATE"
  | "INVOICE_UPDATE"
  | "INVOICE_DELETE"
  | "PAYMENT_COLLECT"
  | "PAYMENT_DELETE"
  | "CUSTOMER_CREATE"
  | "CUSTOMER_UPDATE"
  | "CUSTOMER_DELETE"
  | "STOCK_CREATE"
  | "STOCK_UPDATE"
  | "STOCK_DELETE"
  | "STOCK_DELTA"
  | "EXPENSE_CREATE"
  | "RETURN_CREATE"
  | "DISCOUNT_APPLIED"
  | "LOYALTY_REDEEM"
  | "SHIFT_OPEN"
  | "SHIFT_CLOSE"
  | "SETTINGS_UPDATE"
  | "PRICE_OVERRIDE";

export type AuditModule =
  | "invoices"
  | "payments"
  | "customers"
  | "inventory"
  | "expenses"
  | "returns"
  | "discounts"
  | "staff"
  | "settings";

export type AuditSeverity = "info" | "warning" | "danger" | "critical";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  action: AuditActionType;
  module: AuditModule;
  severity: AuditSeverity;
  staffId?: string;
  staffName: string;
  staffRole: StaffRole | "system";
  branchName?: string;
  entityId?: string;
  entityName?: string;
  title: string;
  details?: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  ipAddress?: string;
}

function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const session = supabase.auth.getSession();
    // Sync fallback - return null if we can't get user
    return null;
  } catch {
    return null;
  }
}

async function getUserIdAsync(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export function getActiveStaffSnapshot(): { staffId: string; staffName: string; staffRole: StaffRole; branchName: string } {
  if (typeof window === "undefined") {
    return { staffId: "system", staffName: "المدير العام", staffRole: "admin", branchName: "الفرع الرئيسي" };
  }
  try {
    // Use Supabase auth user ID instead of localStorage for attribution
    const session = supabase.auth.getSession();
    // session is a Promise but we can't await in sync context
    // Fallback: read from localStorage for staff display only (not for security)
    const activeStaffId = localStorage.getItem("segilly_active_staff_id_v1") || "staff-admin-main";
    const staffMembersRaw = localStorage.getItem("segilly_staff_members_v1");
    if (staffMembersRaw) {
      const list = JSON.parse(staffMembersRaw);
      const found = Array.isArray(list) ? list.find((s: any) => s.id === activeStaffId) : null;
      if (found) {
        return {
          staffId: found.id,
          staffName: found.name,
          staffRole: found.role || "admin",
          branchName: found.branchName || "الفرع الرئيسي",
        };
      }
    }
  } catch (e) {
    // ignore
  }
  return { staffId: "staff-admin-main", staffName: "المدير العام (المالك)", staffRole: "admin", branchName: "الفرع الرئيسي" };
}

/**
 * Global helper to record any system or user activity
 * Saves to Supabase database with localStorage fallback for offline
 */
export async function recordAuditLog(entry: Partial<AuditLogEntry> & { action: AuditActionType; module: AuditModule; title: string }) {
  const staff = getActiveStaffSnapshot();
  const userId = await getUserIdAsync();

  if (!userId) {
    console.warn("Audit log skipped: no authenticated user");
    return null;
  }

  const newLog: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    severity: entry.severity || "info",
    staffId: entry.staffId || staff.staffId,
    staffName: entry.staffName || staff.staffName,
    staffRole: entry.staffRole || staff.staffRole,
    branchName: entry.branchName || staff.branchName,
    ...entry,
  };

  try {
    const { error } = await supabase.from("audit_logs").insert({
      id: newLog.id,
      user_id: userId,
      action: newLog.action,
      module: newLog.module,
      severity: newLog.severity,
      staff_id: newLog.staffId || null,
      staff_name: newLog.staffName,
      staff_role: newLog.staffRole,
      branch_name: newLog.branchName || null,
      entity_id: newLog.entityId || null,
      entity_name: newLog.entityName || null,
      title: newLog.title,
      details: newLog.details || null,
      old_value: newLog.oldValue != null ? String(newLog.oldValue) : null,
      new_value: newLog.newValue != null ? String(newLog.newValue) : null,
      ip_address: newLog.ipAddress || null,
      created_at: newLog.timestamp,
    });

    if (error) {
      console.error("Failed to save audit log to Supabase:", error);
      // Fallback to localStorage for offline
      saveToLocalStorageFallback(newLog);
    }

    window.dispatchEvent(new Event("segilly_audit_updated"));
    return newLog;
  } catch (e) {
    console.error("Audit log error:", e);
    saveToLocalStorageFallback(newLog);
    return newLog;
  }
}

function saveToLocalStorageFallback(log: AuditLogEntry) {
  if (typeof window === "undefined") return;
  try {
    const key = "segilly_audit_offline_queue_v1";
    const raw = localStorage.getItem(key);
    const queue: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    queue.push(log);
    localStorage.setItem(key, JSON.stringify(queue.slice(-200)));
  } catch {
    // silent
  }
}

/**
 * Re-sync offline audit queue back to Supabase when online
 */
export async function syncOfflineAuditQueue(): Promise<number> {
  if (typeof window === "undefined") return 0;
  const key = "segilly_audit_offline_queue_v1";
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const queue: AuditLogEntry[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    const userId = await getUserIdAsync();
    if (!userId) return 0;

    let synced = 0;
    const failed: AuditLogEntry[] = [];

    for (const log of queue) {
      try {
        const { error } = await supabase.from("audit_logs").upsert({
          id: log.id,
          user_id: userId,
          action: log.action,
          module: log.module,
          severity: log.severity,
          staff_id: log.staffId || null,
          staff_name: log.staffName,
          staff_role: log.staffRole,
          branch_name: log.branchName || null,
          entity_id: log.entityId || null,
          entity_name: log.entityName || null,
          title: log.title,
          details: log.details || null,
          old_value: log.oldValue != null ? String(log.oldValue) : null,
          new_value: log.newValue != null ? String(log.newValue) : null,
          ip_address: log.ipAddress || null,
          created_at: log.timestamp,
        }, { onConflict: "id" });

        if (!error) synced++;
        else failed.push(log);
      } catch {
        failed.push(log);
      }
    }

    // Keep only failed items in queue
    localStorage.setItem(key, JSON.stringify(failed.slice(-200)));
    return synced;
  } catch {
    return 0;
  }
}

async function fetchAuditLogsFromDB(): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500);

    if (error) {
      console.error("Failed to fetch audit logs:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      action: row.action as AuditActionType,
      module: row.module as AuditModule,
      severity: row.severity as AuditSeverity,
      staffId: row.staff_id || undefined,
      staffName: row.staff_name || "",
      staffRole: (row.staff_role as StaffRole | "system") || "system",
      branchName: row.branch_name || undefined,
      entityId: row.entity_id || undefined,
      entityName: row.entity_name || undefined,
      title: row.title || "",
      details: row.details || undefined,
      oldValue: row.old_value || undefined,
      newValue: row.new_value || undefined,
      ipAddress: row.ip_address || undefined,
    }));
  } catch (e) {
    console.error("Failed to fetch audit logs:", e);
    return [];
  }
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const dbLogs = await fetchAuditLogsFromDB();
    setLogs(dbLogs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    const handler = () => loadLogs();
    window.addEventListener("segilly_audit_updated", handler);
    return () => window.removeEventListener("segilly_audit_updated", handler);
  }, [loadLogs]);

  const reload = useCallback(() => {
    loadLogs();
  }, [loadLogs]);

  const addLog = useCallback(async (entry: Omit<AuditLogEntry, "id" | "timestamp">) => {
    return await recordAuditLog(entry);
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter((l) => l.timestamp.startsWith(today));
    const warnings = logs.filter((l) => l.severity === "warning" || l.severity === "danger" || l.severity === "critical");
    const staffActions = new Map<string, number>();

    logs.forEach((l) => {
      staffActions.set(l.staffName, (staffActions.get(l.staffName) ?? 0) + 1);
    });

    return {
      total: logs.length,
      todayCount: todayLogs.length,
      warningCount: warnings.length,
      staffActionCounts: Array.from(staffActions.entries()).map(([name, count]) => ({ name, count })),
    };
  }, [logs]);

  return {
    logs,
    stats,
    loading,
    addLog,
    reload,
  };
}

export const ACTION_TYPE_META: Record<
  AuditActionType,
  { label: string; module: AuditModule; severity: AuditSeverity; iconName: string }
> = {
  INVOICE_CREATE: { label: "إصدار فاتورة بيع", module: "invoices", severity: "info", iconName: "FilePlus" },
  INVOICE_UPDATE: { label: "تعديل بيانات فاتورة", module: "invoices", severity: "warning", iconName: "FileEdit" },
  INVOICE_DELETE: { label: "حذف فاتورة بيع", module: "invoices", severity: "critical", iconName: "FileX" },
  PAYMENT_COLLECT: { label: "تحصيل دفعة أو قسط", module: "payments", severity: "info", iconName: "CheckCircle2" },
  PAYMENT_DELETE: { label: "إلغاء أو حذف دفعة", module: "payments", severity: "danger", iconName: "Trash2" },
  CUSTOMER_CREATE: { label: "إضافة عميل جديد", module: "customers", severity: "info", iconName: "UserPlus" },
  CUSTOMER_UPDATE: { label: "تعديل بيانات عميل", module: "customers", severity: "info", iconName: "UserCheck" },
  CUSTOMER_DELETE: { label: "حذف عميل من النظام", module: "customers", severity: "danger", iconName: "UserX" },
  STOCK_CREATE: { label: "إضافة صنف جديد بالمخزن", module: "inventory", severity: "info", iconName: "PackagePlus" },
  STOCK_UPDATE: { label: "تعديل سعر أو بيانات منتج", module: "inventory", severity: "warning", iconName: "PackageCheck" },
  STOCK_DELETE: { label: "حذف صنف من المخزن", module: "inventory", severity: "danger", iconName: "PackageX" },
  STOCK_DELTA: { label: "تسوية كميات الجرد والمخزن", module: "inventory", severity: "warning", iconName: "Layers" },
  EXPENSE_CREATE: { label: "تسجيل مصروف من الخزينة", module: "expenses", severity: "warning", iconName: "Receipt" },
  RETURN_CREATE: { label: "معالجة مرتجع بضاعة", module: "returns", severity: "warning", iconName: "RotateCcw" },
  DISCOUNT_APPLIED: { label: "تطبيق خصم أو كوبون", module: "discounts", severity: "warning", iconName: "Tag" },
  LOYALTY_REDEEM: { label: "استبدال نقاط ولاء العميل", module: "discounts", severity: "info", iconName: "Gift" },
  SHIFT_OPEN: { label: "فتح وردية كاشير", module: "staff", severity: "info", iconName: "Unlock" },
  SHIFT_CLOSE: { label: "إغلاق وردية وجرد الدرج", module: "staff", severity: "warning", iconName: "Lock" },
  SETTINGS_UPDATE: { label: "تعديل إعدادات النظام الحساسة", module: "settings", severity: "danger", iconName: "Sliders" },
  PRICE_OVERRIDE: { label: "تغيير سعر بيع مباشر في الكاشير", module: "invoices", severity: "danger", iconName: "AlertTriangle" },
};

export const MODULE_META: Record<AuditModule, { label: string; color: string }> = {
  invoices: { label: "الفواتير والمبيعات", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  payments: { label: "التحصيلات والدفعات", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  customers: { label: "العملاء والحسابات", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  inventory: { label: "المخزن والمنتجات", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  expenses: { label: "المصروفات والخزينة", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  returns: { label: "المرتجعات", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  discounts: { label: "الخصومات والولاء", color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
  staff: { label: "الموظفين والورديات", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  settings: { label: "إعدادات النظام", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
};
