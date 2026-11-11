import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = process.env;
const ready = Boolean(
  env.SUPABASE_TEST_URL
  && env.SUPABASE_TEST_ANON_KEY
  && env.SUPABASE_TEST_EMAIL
  && env.SUPABASE_TEST_PASSWORD
  && env.SUPABASE_TEST_CUSTOMER_ID
  && env.SUPABASE_TEST_STOCK_ITEM_ID,
);

describe.skipIf(!ready)("sales integrity against Supabase", () => {
  let client: SupabaseClient;
  const customerId = env.SUPABASE_TEST_CUSTOMER_ID!;
  const stockItemId = env.SUPABASE_TEST_STOCK_ITEM_ID!;

  beforeAll(async () => {
    client = createClient(env.SUPABASE_TEST_URL!, env.SUPABASE_TEST_ANON_KEY!);
    const { error } = await client.auth.signInWithPassword({
      email: env.SUPABASE_TEST_EMAIL!,
      password: env.SUPABASE_TEST_PASSWORD!,
    });
    if (error) throw error;
  });

  async function createTestSale(invoiceId: string, quantity = 1) {
    const { data, error } = await client.rpc("create_sale_with_workflow_v3" as never, {
      p_customer_id: customerId,
      p_total: 10000 * quantity,
      p_down_payment: 0,
      p_monthly_installment: 10000 * quantity,
      p_first_due_date: "2030-01-01",
      p_notes: "integration-test",
      p_discount_pct: 0,
      p_discount_amount: 0,
      p_tax_pct: 0,
      p_tax_amount: 0,
      p_status: "pending",
      p_paid: 0,
      p_items: [{
        name: "integration-test",
        cost: 5000,
        price: 10000,
        quantity,
        discount_pct: 0,
        tax_pct: 0,
        serial_numbers: [],
        stock_item_id: stockItemId,
      }],
      p_invoice_id: invoiceId,
      p_down_payment_method: "cash",
      p_down_payment_account_id: null,
      p_down_payment_reference: null,
      p_split_cash_amount: 0,
      p_split_electronic_amount: 0,
      p_split_electronic_method: null,
      p_shipment: null,
      p_branch_id: null,
      p_cashier_id: null,
      p_source: "integration-test",
      p_external_order_number: null,
    } as never);
    if (error) throw error;
    expect(data).toBe(invoiceId);
    return invoiceId;
  }

  async function cleanup(invoiceId: string) {
    await client.rpc("delete_invoice_with_stock" as never, { p_invoice_id: invoiceId } as never);
  }

  it("creates a sale and deducts stock atomically", async () => {
    const invoiceId = crypto.randomUUID();
    const before = await client.from("stock_items").select("quantity").eq("id", stockItemId).single();
    if (before.error) throw before.error;
    if ((before.data.quantity ?? 0) < 1) return;

    await createTestSale(invoiceId);
    const after = await client.from("stock_items").select("quantity").eq("id", stockItemId).single();
    if (after.error) throw after.error;
    expect(after.data.quantity).toBe(before.data.quantity - 1);
    await cleanup(invoiceId);
  });

  it("is idempotent for a repeated payment command", async () => {
    const invoiceId = crypto.randomUUID();
    await createTestSale(invoiceId);
    const paymentId = crypto.randomUUID();
    const args = {
      p_invoice_id: invoiceId,
      p_amount: 1000,
      p_payment_id: paymentId,
      p_payment_method: "cash",
      p_account_id: null,
      p_reference_number: "integration-test",
    } as never;
    const first = await client.rpc("record_invoice_payment" as never, args);
    const second = await client.rpc("record_invoice_payment" as never, args);
    if (first.error) throw first.error;
    if (second.error) throw second.error;
    const payments = await client.from("payments").select("id").eq("id", paymentId);
    if (payments.error) throw payments.error;
    expect(payments.data).toHaveLength(1);
    await cleanup(invoiceId);
  });

  it("allows only one concurrent sale when one stock unit remains", async () => {
    const stock = await client.from("stock_items").select("quantity").eq("id", stockItemId).single();
    if (stock.error) throw stock.error;
    if ((stock.data.quantity ?? 0) !== 1) return;

    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const results = await Promise.allSettled(ids.map((id) => createTestSale(id)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "fulfilled") await cleanup(result.value);
    }
  });
});
