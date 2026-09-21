import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Paymob config from DB
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: config, error: configError } = await serviceClient.rpc("get_storefront_payment_config", {
      p_owner_id: user.id,
    });

    if (configError || !config || !config.secret_key || !config.enabled) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_id, amount_cents, currency, customer_name, customer_phone, items, integration_id } = body;

    if (!order_id || !amount_cents || !currency) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine integration ID (card or wallet)
    const methodIntegrationId = integration_id || config.integration_id_card;
    if (!methodIntegrationId) {
      return new Response(JSON.stringify({ error: "No integration ID configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the app URL from the request origin or env
    const appUrl = Deno.env.get("APP_URL") || new URL(req.url).origin;

    // Create Paymob Intention
    const intentionPayload = {
      amount: amount_cents,
      currency,
      payment_methods: [methodIntegrationId],
      items: (items || []).map((item: { name: string; amount: number }) => ({
        name: item.name,
        amount: item.amount,
      })),
      billing_data: {
        first_name: customer_name.split(" ")[0] || customer_name,
        last_name: customer_name.split(" ").slice(1).join(" ") || customer_name,
        email: "na@na.com",
        phone_number: customer_phone || "+20000000000",
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        shipping_method: "NA",
        postal_code: "NA",
        city: "NA",
        country: "EG",
        state: "NA",
      },
      special_reference: order_id,
      notification_url: `${supabaseUrl}/functions/v1/paymob-webhook`,
      redirection_url: `${appUrl}/payment/complete?order_id=${order_id}`,
    };

    const paymobResponse = await fetch("https://accept.paymob.com/v1/intention/", {
      method: "POST",
      headers: {
        Authorization: `Token ${config.secret_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intentionPayload),
    });

    const paymobData = await paymobResponse.json();

    if (!paymobResponse.ok) {
      console.error("Paymob intention error:", paymobData);
      return new Response(JSON.stringify({ error: "Payment gateway error", details: paymobData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record the payment attempt in DB
    await serviceClient.rpc("record_storefront_payment", {
      p_order_id: order_id,
      p_paymob_intention_id: String(paymobData.id),
      p_paymob_transaction_id: null,
      p_amount_cents: amount_cents,
      p_currency: currency,
      p_payment_method: "card",
      p_status: "pending",
      p_paymob_response: paymobData,
    });

    // Build checkout URL
    const publicKey = config.public_key;
    const clientSecret = paymobData.client_secret;
    const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`;

    return new Response(
      JSON.stringify({
        client_secret: clientSecret,
        checkout_url: checkoutUrl,
        intention_id: paymobData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Paymob create intention error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
