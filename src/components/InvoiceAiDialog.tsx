import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parsePurchaseInvoice, type InvoiceAiResult } from "@/lib/invoice-ai";
import { CheckCircle2, FileText, ImagePlus, Loader2, ScanSearch, Upload, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

type SupplierOption = { id: string; name: string };

export function InvoiceAiDialog({
  open, onOpenChange, suppliers, onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  onApply: (result: InvoiceAiResult, supplierId: string | null, files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<InvoiceAiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [supplierName, setSupplierName] = useState("");

  const supplierMatch = useMemo(() => {
    if (!supplierName.trim()) return null;
    const normalized = supplierName.trim().toLowerCase();
    return suppliers.find((supplier) => supplier.name.trim().toLowerCase() === normalized)
      ?? suppliers.find((supplier) => supplier.name.toLowerCase().includes(normalized) || normalized.includes(supplier.name.toLowerCase()))
      ?? null;
  }, [supplierName, suppliers]);
  const extractedItemsTotal = useMemo(() => result?.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) ?? 0, [result]);
  const totalMismatch = result?.total != null && Math.abs(extractedItemsTotal - result.total) > 0.01;

  const reset = () => { setFiles([]); setResult(null); setError(""); setSupplierName(""); setBusy(false); };
  const close = (value: boolean) => { if (!value) reset(); onOpenChange(value); };

  const analyze = async () => {
    setBusy(true); setError("");
    try { const parsed = await parsePurchaseInvoice(files); setResult(parsed); setSupplierName(parsed.supplierName ?? ""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر قراءة الفاتورة"); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent dir="rtl" className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-7">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-right"><ScanSearch className="h-5 w-5 text-primary" /> قراءة الفاتورة بالذكاء الاصطناعي</DialogTitle><DialogDescription className="text-right">ارفع الفاتورة، راجع البيانات المستخرجة، ثم أضفها إلى نموذج الشراء.</DialogDescription></DialogHeader>
      {!result ? <div className="space-y-4">
        <label className="group flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/35 bg-primary/[0.04] p-6 text-center transition-[background-color,border-color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary hover:bg-primary/[0.08] active:scale-[0.99]">
          <input type="file" className="sr-only" accept="image/*,.pdf,application/pdf" multiple capture="environment" onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setError(""); }} />
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary"><Upload className="h-6 w-6" /></span>
          <span className="font-bold">اضغط لرفع صورة أو PDF</span><span className="text-xs text-muted-foreground">يمكن اختيار أكثر من صفحة أو استخدام كاميرا الموبايل</span>
        </label>
        {files.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{files.map((file) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-xl border border-border/40 bg-foreground/[0.04] p-3 text-sm"><FileText className="h-4 w-4 text-info" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-[10px] text-muted-foreground">{Math.round(file.size / 1024)} KB</span></div>)}</div>}
        {error && <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"><AlertTriangle className="ml-2 inline h-4 w-4" />{error}</div>}
        <DialogFooter><Button onClick={analyze} disabled={!files.length || busy} className="w-full gap-2">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />جاري قراءة الفاتورة...</> : <><ScanSearch className="h-4 w-4" />تحليل الفاتورة</>}</Button></DialogFooter>
      </div> : <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Confidence label="دقة القراءة" value={result.confidence} /><Confidence label="عدد المنتجات" value={result.items.length} neutral /><Confidence label="الإجمالي" value={result.total ?? 0} neutral /><Confidence label="الملفات" value={files.length} neutral /></div>
        <div className="grid gap-3 rounded-2xl border border-border/40 bg-foreground/[0.025] p-4 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-bold">المورد المستخرج</label><Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} /></div><div className="flex items-end gap-2">{supplierMatch ? <Badge className="mb-2 gap-1 border-success/30 bg-success/10 text-success"><CheckCircle2 className="h-3.5 w-3.5" />مطابقة: {supplierMatch.name}</Badge> : <Badge className="mb-2 gap-1 border-warning/30 bg-warning/10 text-warning"><AlertTriangle className="h-3.5 w-3.5" />راجع اسم المورد يدويًا</Badge>}</div><div><label className="mb-1 block text-xs font-bold">رقم الفاتورة</label><Input value={result.invoiceNumber ?? ""} onChange={(e) => setResult((current) => current && ({ ...current, invoiceNumber: e.target.value || null }))} /></div><div><label className="mb-1 block text-xs font-bold">تاريخ الفاتورة</label><Input type="date" value={result.invoiceDate ?? ""} onChange={(e) => setResult((current) => current && ({ ...current, invoiceDate: e.target.value || null }))} /></div><div><label className="mb-1 block text-xs font-bold">إجمالي الفاتورة</label><Input type="number" value={result.total ?? ""} onChange={(e) => setResult((current) => current && ({ ...current, total: e.target.value === "" ? null : Number(e.target.value) }))} /></div></div>
        <div className="overflow-hidden rounded-2xl border border-border/40"><div className="flex items-center justify-between bg-foreground/[0.04] p-3"><span className="font-bold">المنتجات المستخرجة ({result.items.length})</span><Badge variant="outline" className="border-warning/30 text-warning">مراجعة مطلوبة قبل الحفظ</Badge></div><div className="max-h-72 overflow-y-auto">{result.items.map((item, index) => <div key={`${item.name}-${index}`} className="grid gap-2 border-t border-border/30 p-3 sm:grid-cols-[1fr_100px_120px_100px]"><Input value={item.name} onChange={(e) => setResult((current) => current && ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, name: e.target.value, confidence: 1 } : row) }))} className={cn(!item.name.trim() ? "border-danger ring-danger/20" : item.confidence >= 0.85 ? "border-success/40" : "border-warning/50")} placeholder="اسم المنتج" /><Input type="number" value={item.quantity} onChange={(e) => setResult((current) => current && ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, quantity: Number(e.target.value), confidence: 1 } : row) }))} className={item.quantity <= 0 ? "border-danger" : undefined} /><Input type="number" value={item.unitCost} onChange={(e) => setResult((current) => current && ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, unitCost: Number(e.target.value), confidence: 1 } : row) }))} className={item.unitCost <= 0 ? "border-danger" : undefined} /><span className={cn("flex items-center justify-center text-xs font-bold", item.confidence >= 0.85 ? "text-success" : "text-warning")}>{Math.round(item.confidence * 100)}%</span></div>)}</div></div>
        {(result.missingFields.length > 0 || result.items.some((item) => !item.name || item.quantity <= 0 || item.unitCost <= 0)) && <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"><AlertTriangle className="ml-2 inline h-4 w-4" />توجد بيانات ناقصة. أكمل الحقول الحمراء قبل الإضافة.</div>}
        {totalMismatch && <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><AlertTriangle className="ml-2 inline h-4 w-4" />يوجد اختلاف بين مجموع المنتجات ({extractedItemsTotal.toFixed(2)}) وإجمالي الفاتورة ({result.total?.toFixed(2)}). راجع الأسعار والكمية.</div>}
        <DialogFooter><Button variant="outline" onClick={() => setResult(null)} className="gap-2"><ImagePlus className="h-4 w-4" />إعادة الرفع</Button><Button disabled={!result.items.length || totalMismatch || result.items.some((item) => !item.name.trim() || item.quantity <= 0 || item.unitCost <= 0)} onClick={() => { const normalized = result.supplierName ? result.supplierName : supplierName; onApply({ ...result, supplierName: normalized }, supplierMatch?.id ?? null, files); close(false); }} className="flex-1 gap-2"><CheckCircle2 className="h-4 w-4" />إضافة البيانات للنموذج</Button></DialogFooter>
      </div>}
    </DialogContent>
  </Dialog>;
}

function Confidence({ label, value, neutral = false }: { label: string; value: number; neutral?: boolean }) {
  const numeric = neutral ? value : Math.round(value * 100);
  return <div className="rounded-2xl border border-border/40 bg-foreground/[0.04] p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className={cn("mt-1 text-lg font-extrabold", neutral ? "text-info" : value >= 0.85 ? "text-success" : "text-warning")}>{numeric}{neutral ? "" : "%"}</div></div>;
}
