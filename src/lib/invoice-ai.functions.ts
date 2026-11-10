import { createServerFn } from "@tanstack/react-start";
import { generateResponse, listModels } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const invoiceSchema = z.object({
  supplierName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  total: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unitCost: z.number(),
    barcode: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  })),
});

const invoiceSchemaJson = {
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
} as const;

const invoiceFileSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  dataUrl: z.string().startsWith("data:").max(20_000_000),
});

const parseInputSchema = z.object({
  files: z.array(invoiceFileSchema).min(1).max(12),
});

const prompt = `اقرأ فواتير الشراء العربية أو الإنجليزية واستخرج بياناتها بدقة. أعد JSON مطابقًا للمخطط فقط.
قواعد مهمة:
- لا تخمن أي رقم؛ إذا لم يكن واضحًا استخدم null أو 0 وثقة منخفضة.
- unitCost هو سعر تكلفة الوحدة وليس إجمالي السطر.
- quantity عدد الوحدات.
- احسب confidence لكل منتج بين 0 و1، وconfidence عام بين 0 و1.
- invoiceDate بصيغة YYYY-MM-DD إن أمكن.
- اجمع كل المنتجات من كل الصفحات، ولا تسقط أي منتج.`;

function extractText(response: unknown): string {
  const output = (response as { output?: unknown[]; output_text?: string }).output;
  if (typeof (response as { output_text?: unknown }).output_text === "string") {
    return (response as { output_text: string }).output_text;
  }
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const text = (part as { type?: string; text?: unknown }).text;
      return (part as { type?: string }).type === "output_text" && typeof text === "string" ? [text] : [];
    });
  }).join("");
}

export const parsePurchaseInvoiceWithLovable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseInputSchema.parse(input))
  .handler(async ({ data }) => {
    const content = [
      { type: "input_text" as const, text: prompt },
      ...data.files.map((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? { type: "input_file" as const, filename: file.name, file_data: file.dataUrl }
        : { type: "input_image" as const, image_url: file.dataUrl, detail: "low" as const }),
    ];

    const response = await generateResponse({
      model: "openai/gpt-5.4-mini",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "purchase_invoice",
          strict: true,
          schema: invoiceSchemaJson,
        },
      },
      max_output_tokens: 7000,
    });

    const raw = extractText(response);
    if (!raw) throw new Error("لم تُرجع خدمة Lovable AI نتيجة صالحة");
    return invoiceSchema.parse(JSON.parse(raw));
  });

export const checkInvoiceAiWithLovable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const catalog = await listModels();
    const model = catalog.data.find((entry) => entry.id === "openai/gpt-5.4-mini");
    return {
      configured: catalog.workspace_models === "included",
      reachable: Boolean(model?.supported_surfaces.includes("responses")),
    };
  });
