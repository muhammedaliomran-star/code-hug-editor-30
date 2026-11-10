import { parsePurchaseInvoiceWithLovable, checkInvoiceAiWithLovable } from "@/lib/invoice-ai.functions";

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
  const filesWithData = await Promise.all(optimizedFiles.map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return { name: file.name, type: file.type || "application/octet-stream", dataUrl: `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}` };
  }));
  return parsePurchaseInvoiceWithLovable({ data: { files: filesWithData } }) as Promise<InvoiceAiResult>;
}

export async function checkInvoiceAiConnection(): Promise<{ configured: boolean; reachable: boolean }> {
  return checkInvoiceAiWithLovable();
}
