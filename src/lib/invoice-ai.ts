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

export async function parsePurchaseInvoice(files: File[]): Promise<InvoiceAiResult> {
  if (!files.length) throw new Error("اختر صورة أو ملف PDF أولاً");
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  const { data, error } = await supabase.functions.invoke("parse-purchase-invoice", { body: form });
  if (error) throw new Error(error.message || "تعذر قراءة الفاتورة");
  if (!data?.result) throw new Error("لم تُرجع خدمة الذكاء الاصطناعي بيانات صالحة");
  return data.result as InvoiceAiResult;
}
