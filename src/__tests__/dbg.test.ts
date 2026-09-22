import { describe, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/shipping-finance", () => ({ recordCarrierSettlementInTreasury: vi.fn() }));
import { runComprehensiveReconciliation } from "@/lib/reconciliation-engine";
const empty = () => ({ customers: [], invoices: [], payments: [], expenses: [], invoiceItems: [], suppliers: [], purchases: [], purchaseItems: [], supplierPayments: [], stockItems: [], warehouseItems: [], returns: [], returnItems: [], branches: [], paymentVouchers: [], carriers: [], zones: [], shipments: [], loading: false }) as any;
const cust = (o: any = {}) => ({ id: "cust-1", name: "م", phone: "0101", rating: 5, status: "committed", customerType: "installment", notes: null, frozen: false, address: null, joiningDate: "2026-01-01", creditLimit: 0, dueDay: 1, openingBalance: 0, createdAt: "2026-01-01", ...o });
const inv = (o: any = {}) => ({ id: "inv-1", customerId: "cust-1", total: 10000, downPayment: 2000, monthlyInstallment: 2000, firstDueDate: "2026-01-15", paid: 2000, notes: null, createdAt: "2026-01-01", status: "pending", ...o });
const stk = (o: any = {}) => ({ id: "stock-1", name: "هاتف", quantity: 10, lastUnitCost: 5000, salePrice: 7000, barcode: "123", size: null, itemType: null, minStock: 5, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...o });
describe("dbg", () => {
  it("cancel", () => {
    const db = empty();
    db.customers = [cust()];
    db.invoices = [inv({ id: "inv-cancel", total: 5000, paid: 0, status: "cancelled" })];
    const r = runComprehensiveReconciliation(db);
    console.log("CANCEL", JSON.stringify(r.findings.map(f => [f.id, f.severity, f.title, f.targetId])));
  });
  it("health", () => {
    const db = empty();
    db.stockItems = [stk({ id: "stk-s1", quantity: -1, name: "سالب" }), stk({ id: "stk-s2", quantity: 1, minStock: 10, name: "منخفض" })];
    db.customers = [cust({ id: "cust-s" })];
    db.invoices = [inv({ id: "inv-s", total: 1000, paid: 2000 })];
    db.payments = [];
    const r = runComprehensiveReconciliation(db);
    console.log("HEALTH", r.healthScore, JSON.stringify(r.findings.map(f => [f.id, f.severity])));
  });
});
