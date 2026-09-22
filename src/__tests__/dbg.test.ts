import { describe, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/shipping-finance", () => ({ recordCarrierSettlementInTreasury: vi.fn() }));
import { runComprehensiveReconciliation } from "@/lib/reconciliation-engine";
const empty = () => ({ customers: [], invoices: [], payments: [], expenses: [], invoiceItems: [], suppliers: [], purchases: [], purchaseItems: [], supplierPayments: [], stockItems: [], warehouseItems: [], returns: [], returnItems: [], branches: [], paymentVouchers: [], carriers: [], zones: [], shipments: [], loading: false }) as any;
const cust = (o: any = {}) => ({ id: "cust-1", name: "م", phone: "0101", rating: 5, status: "committed", customerType: "installment", notes: null, frozen: false, address: null, joiningDate: "2026-01-01", creditLimit: 0, dueDay: 1, openingBalance: 0, createdAt: "2026-01-01", ...o });
describe("dbg", () => {
  it("caps", () => {
    const db = empty();
    db.customers = [cust({ id: "cust-ok" })];
    db.invoices = [{ id: "inv-ok", customerId: "cust-ok", number: "1", date: "2026-01-01", total: 10000, paid: 10000, downPayment: 0, status: "active", installmentsCount: 1, installmentAmount: 10000, notes: null, createdAt: "2026-01-01" }];
    db.payments = [{ id: "p1", invoiceId: "inv-ok", amount: 10000, date: "2026-01-02", method: "cash", notes: null, createdAt: "2026-01-02" }];
    const r = runComprehensiveReconciliation(db);
    console.log("CAPS", r.healthScore, JSON.stringify(r.findings.map(f => [f.id, f.severity, f.title])));
  });
  it("cancel", () => {
    const db = empty();
    db.customers = [cust()];
    db.invoices = [{ id: "inv-cancel", customerId: "cust-1", number: "2", date: "2026-01-01", total: 5000, paid: 0, downPayment: 0, status: "cancelled", installmentsCount: 1, installmentAmount: 5000, notes: null, createdAt: "2026-01-01" }];
    const r = runComprehensiveReconciliation(db);
    console.log("CANCEL", JSON.stringify(r.findings.map(f => [f.id, f.severity, f.title, f.targetId])));
  });
});
