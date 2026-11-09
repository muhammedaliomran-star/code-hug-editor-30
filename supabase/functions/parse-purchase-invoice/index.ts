const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    invoiceDate: { type: ["string", "null"] },
    total: { type: ["number", "null"] },
    confidence: { type: "number" },
    missingFields: { type: "array", items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unitCost: { type: "number" },
          barcode: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
        required: ["name", "quantity", "unitCost", "barcode", "confidence"],
      },
    },
  },
  required: ["supplierName", "invoiceNumber", "invoiceDate", "total", "confidence", "missingFields", "items"],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function toDataUrl(bytes: Uint8Array, contentType: string) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${contentType};base64,${btoa(binary)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    if (body?.check === true) return json({ configured: Boolean(apiKey) });
  }
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured in Supabase" }, 503);

  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length) return json({ error: "No invoice files provided" }, 400);
    if (files.length > 12) return json({ error: "Maximum 12 invoice pages" }, 400);

    const content: Array<Record<string, unknown>> = [{
      type: "input_text",
      text: `اقرأ فواتير الشراء العربية أو الإنجليزية واستخرج بياناتها بدقة. أعد JSON مطابقًا للمخطط فقط.
قواعد مهمة:
- لا تخمن أي رقم؛ إذا لم يكن واضحًا استخدم null أو 0 وثقة منخفضة.
- unitCost هو سعر تكلفة الوحدة وليس إجمالي السطر.
- quantity عدد الوحدات.
- احسب confidence لكل منتج بين 0 و1، وconfidence عام بين 0 و1.
- invoiceDate بصيغة YYYY-MM-DD إن أمكن.
- اجمع كل المنتجات من كل الصفحات، ولا تسقط أي منتج.`
    }];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > 12 * 1024 * 1024) return json({ error: "Each file must be smaller than 12 MB" }, 413);
      const dataUrl = toDataUrl(bytes, file.type || "application/octet-stream");
      content.push(file.type === "application/pdf"
        ? { type: "input_file", filename: file.name, file_data: dataUrl }
        : { type: "input_image", image_url: dataUrl, detail: Deno.env.get("OPENAI_INVOICE_IMAGE_DETAIL") || "low" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_INVOICE_MODEL") || "gpt-4.1-mini",
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "purchase_invoice", strict: true, schema } },
        max_output_tokens: 7000,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return json({ error: payload?.error?.message || "OpenAI request failed" }, response.status);
    const raw = payload.output_text || payload.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    if (!raw) return json({ error: "OpenAI returned no structured result" }, 502);
    return json({ result: JSON.parse(raw) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invoice parsing failed" }, 500);
  }
});
