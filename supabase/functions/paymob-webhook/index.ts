import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify Paymob HMAC SHA-512 signature.
 * Field order per Paymob docs: amount_cents, created_at, currency, error_occured,
 * has_parent_transaction, id, integration_id, is_3d_secure, is_auth, is_capture,
 * is_refunded, is_standalone_payment, is_voided, order.id, owner, pending,
 * source_data.pan, source_data.sub_type, source_data.type, success
 */
function computeHmac(obj: Record<string, unknown>, secret: string): string {
  const sourceData = (obj.source_data || {}) as Record<string, unknown>;
  const orderObj = (obj.order || {}) as Record<string, unknown>;
  const fields = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    orderObj.id,
    obj.owner,
    obj.pending,
    sourceData.pan,
    sourceData.sub_type,
    sourceData.type,
    obj.success,
  ];
  const data = fields.map(String).join("");
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);
  const key = crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return key.then((k) => crypto.subtle.sign("HMAC", k, msgData)).then((sig) => {
    const bytes = new Uint8Array(sig);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

serve(async (req) => {
  // Paymob sends POST for webhooks
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the callback query params for HMAC
    const url = new URL(req.url);
    const receivedHmac = url.searchParams.get("hmac");

    // Parse the body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const obj = body.obj as Record<string, unknown> | undefined;
    if (!obj) {
      return new Response(JSON.stringify({ error: "Missing obj in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract order info
    const orderObj = (obj.order || {}) as Record<string, unknown>;
    const orderId = (obj.special_reference as string) || (orderObj.id as string);

    // Look up the owner's HMAC secret from the order's storefront
    let hmacSecret: string | null = null;
    if (orderId) {
      const { data: order } = await serviceClient
        .from("store_orders")
        .select("storefront_id, storefronts(owner_id)")
        .eq("id", orderId)
        .single();

      if (order?.storefronts) {
        const ownerId = (order.storefronts as Record<string, unknown>).owner_id;
        const { data: config } = await serviceClient
          .from("storefront_payment_config")
          .select("hmac_secret")
          .eq("owner_id", ownerId)
          .single();
        hmacSecret = config?.hmac_secret ?? null;
      }
    }

    // Verify HMAC if secret is available
    if (hmacSecret && receivedHmac) {
      const computedHmac = await computeHmac(obj, hmacSecret);
      if (computedHmac !== receivedHmac) {
        console.error("HMAC verification failed for order:", orderId);
        return new Response(JSON.stringify({ error: "Invalid HMAC" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (hmacSecret && !receivedHmac) {
      console.warn("HMAC secret configured but no HMAC in callback for order:", orderId);
      // Continue processing — some payment methods may not send HMAC
    }

    // Determine payment status
    const success = obj.success === true;
    const paymentStatus = success ? "success" : "failed";
    const transactionId = String(obj.id || "");
    const intentionId = String(body.id || obj.id || "");
    const paymentMethod = (sourceData => {
      const type = sourceData?.type;
      if (type === "CARD") return "card";
      if (type === "WALLET") return "wallet";
      if (type === "APPLE_PAY") return "apple_pay";
      return "card";
    })((obj.source_data || {}) as Record<string, unknown>);

    // Record payment in DB
    if (orderId) {
      await serviceClient.rpc("record_storefront_payment", {
        p_order_id: orderId,
        p_paymob_intention_id: intentionId,
        p_paymob_transaction_id: transactionId,
        p_amount_cents: Number(obj.amount_cents || 0),
        p_currency: String(obj.currency || "EGP"),
        p_payment_method: paymentMethod,
        p_status: paymentStatus,
        p_hmac_payload: obj,
        p_paymob_response: body,
      });
    } else {
      console.error("No order ID found in webhook payload:", body);
    }

    // Always return 200 to Paymob
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Paymob webhook error:", error);
    // Still return 200 to prevent Paymob retries on our bugs
    return new Response(JSON.stringify({ received: true, error: "Internal processing error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
