/**
 * مزامنة منظومة الخزينة (Cashbox) مع قاعدة البيانات السحابية.
 * الاستراتيجية: التخزين المحلي يظل الكاش السريع للواجهة،
 * وكل عملية كتابة تُدفع للسحابة، وعند فتح الصفحة تُسحب البيانات من السحابة وتحل محل الكاش.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  TreasuryAccount,
  InternalTransfer,
  ManualCashTransaction,
  CashDenominationAudit,
} from "@/lib/cashbox-system";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ==================== Mappers ==================== */

const accountToRow = (a: TreasuryAccount, user_id: string) => ({
  user_id,
  id: a.id,
  name: a.name,
  type: a.type,
  balance: a.initialBalance ?? 0,
  currency: "ج.م",
  is_active: a.active !== false,
});

const rowToAccount = (r: any): TreasuryAccount => ({
  id: r.id,
  name: r.name,
  type: r.type,
  initialBalance: Number(r.balance || 0),
  active: r.is_active !== false,
  createdAt: r.created_at,
});

const manualToRow = (t: ManualCashTransaction, user_id: string) => ({
  id: t.id,
  user_id,
  from_account_id: t.type === "out" ? t.accountId : null,
  to_account_id: t.type === "in" ? t.accountId : null,
  type: t.type === "in" ? "manual_in" : "manual_out",
  amount: t.amount ?? 0,
  category: t.category || "عام",
  description: t.title,
  reference_number: t.referenceNumber ?? null,
  created_at: t.createdAt || new Date().toISOString(),
});

const rowToManual = (r: any): ManualCashTransaction => ({
  id: r.id,
  accountId: r.from_account_id || r.to_account_id || "acc-cash-main",
  type: r.type === "manual_in" ? "in" : "out",
  category: r.category || "عام",
  amount: Number(r.amount || 0),
  date: r.created_at,
  title: r.description || "",
  notes: r.notes ?? undefined,
  referenceNumber: r.reference_number ?? undefined,
  performedBy: "",
  createdAt: r.created_at,
});

const transferToRow = (t: InternalTransfer, user_id: string) => ({
  id: t.id,
  user_id,
  from_account_id: t.fromAccountId,
  to_account_id: t.toAccountId,
  type: "transfer",
  amount: t.amount ?? 0,
  fee: t.fee ?? 0,
  reference_number: t.referenceNumber ?? null,
  description: `تحويل ${t.transferNumber}`,
  created_at: t.createdAt || new Date().toISOString(),
});

const rowToTransfer = (r: any): InternalTransfer => ({
  id: r.id,
  transferNumber: r.description?.match(/#TR-\d+/)?.[0] || `#TR-${r.id.slice(0, 4)}`,
  fromAccountId: r.from_account_id || "",
  toAccountId: r.to_account_id || "",
  amount: Number(r.amount || 0),
  fee: Number(r.fee || 0),
  feeRecordedAsExpense: false,
  date: r.created_at,
  referenceNumber: r.reference_number ?? undefined,
  notes: r.description ?? undefined,
  performedBy: "",
  createdAt: r.created_at,
});

const auditToRow = (a: CashDenominationAudit, user_id: string) => ({
  id: a.id,
  user_id,
  account_id: a.accountId,
  denominations: a.denominations,
  total_counted: a.totalActualCash ?? 0,
  expected_balance: a.systemExpectedCash ?? 0,
  variance: a.variance ?? 0,
  notes: a.notes ?? null,
  created_at: a.countedAt || new Date().toISOString(),
});

const rowToAudit = (r: any): CashDenominationAudit => ({
  id: r.id,
  auditNumber: `#AUDIT-${r.id.slice(0, 4)}`,
  accountId: r.account_id || "acc-cash-main",
  countedAt: r.created_at,
  countedBy: "",
  denominations: r.denominations || { d200: 0, d100: 0, d50: 0, d20: 0, d10: 0, d5: 0, coins: 0 },
  totalActualCash: Number(r.total_counted || 0),
  systemExpectedCash: Number(r.expected_balance || 0),
  variance: Number(r.variance || 0),
  varianceReason: undefined,
  notes: r.notes ?? undefined,
  status: Number(r.variance || 0) === 0 ? "settled" : "flagged",
});

/* ==================== Push (كتابة للسحابة) ==================== */

export async function pushAccount(acc: TreasuryAccount): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_accounts").upsert(accountToRow(acc, user_id));
}

export async function removeAccount(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_accounts").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushManualTransaction(tx: ManualCashTransaction): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_transactions").upsert(manualToRow(tx, user_id));
}

export async function removeManualTransaction(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_transactions").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushTransfer(tr: InternalTransfer): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_transactions").upsert(transferToRow(tr, user_id));
}

export async function removeTransfer(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_transactions").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushAudit(audit: CashDenominationAudit): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("treasury_denomination_audits").upsert(auditToRow(audit, user_id));
}

/* ==================== Pull (سحب من السحابة) ==================== */

export async function pullCashboxFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const [accounts, transactions, audits] = await Promise.all([
    table("treasury_accounts").select("*").eq("user_id", user_id).order("created_at", { ascending: true }),
    table("treasury_transactions").select("*").eq("user_id", user_id).order("created_at", { ascending: false }),
    table("treasury_denomination_audits").select("*").eq("user_id", user_id).order("created_at", { ascending: false }),
  ]);

  const mod = await import("@/lib/cashbox-system");

  if (!accounts.error && Array.isArray(accounts.data)) {
    if (accounts.data.length > 0) {
      mod.saveTreasuryAccounts(accounts.data.map(rowToAccount));
    } else {
      const local = mod.getTreasuryAccounts();
      await table("treasury_accounts").upsert(
        local.map((a) => accountToRow(a, user_id))
      );
    }
  }

  if (!transactions.error && Array.isArray(transactions.data)) {
    const transfers = transactions.data.filter((r: any) => r.type === "transfer").map(rowToTransfer);
    const manualTxs = transactions.data.filter((r: any) => r.type === "manual_in" || r.type === "manual_out").map(rowToManual);
    mod.saveInternalTransfers(transfers);
    mod.saveManualTransactions(manualTxs);
  }

  if (!audits.error && Array.isArray(audits.data)) {
    mod.saveDenominationAudits(audits.data.map(rowToAudit));
  }

  return true;
}
