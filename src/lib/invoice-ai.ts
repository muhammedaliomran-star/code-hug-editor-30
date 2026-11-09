import { supabase } from "@/integrations/supabase/client";

export type InvoiceAiItem = {
  name: string;
  quantity: number;
  unitCost: number;
  barcode: string | null;
  confidence: number;
};

export type InvoiceAiResult = {
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  total: number | null;
  confidence: number;
  items: InvoiceAiItem[];
  missingFields: string[];
};

async function optimizeInvoiceFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000 || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export async function parsePurchaseInvoice(files: File[]): Promise<InvoiceAiResult> {
  if (!files.length) throw new Error("اختر صورة أو ملف PDF أولاً");
  const optimizedFiles = await Promise.all(files.map(optimizeInvoiceFile));
  const form = new FormData();
  optimizedFiles.forEach((file) => form.append("files", file, file.name));
  const { data, error } = await supabase.functions.invoke("parse-purchase-invoice", { body: form });
  if (error) {
    let message = error.message || "تعذر قراءة الفاتورة";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const body = await context.json().catch(() => null) as { error?: string } | null;
      if (body?.error) message = body.error;
    }
    throw new Error(message);
  }
  if (!data?.result) throw new Error("لم تُرجع خدمة الذكاء الاصطناعي بيانات صالحة");
  return data.result as InvoiceAiResult;
}

export async function checkInvoiceAiConnection(): Promise<{ configured: boolean }> {
  const { data, error } = await supabase.functions.invoke("parse-purchase-invoice", { body: { check: true } });
  if (error) throw new Error(error.message || "تعذر اختبار الاتصال");
  return { configured: data?.configured === true };
}
