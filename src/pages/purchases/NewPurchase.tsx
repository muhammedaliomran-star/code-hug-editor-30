import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDB, db, uid, fmt, findStockByBarcode, type PurchasePaymentType } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { usePrivacy } from "@/lib/privacy";
import { useNavigate, Link } from "@/lib/router-compat";
import { 
  ShoppingCart, Save, X, Plus, Trash2, Banknote, Wallet, 
  Search, Info, Eye, EyeOff, ScanLine, ScanSearch, ArrowRight, CheckCircle2, Paperclip, Upload, ChevronDown
} from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { InvoiceAiDialog } from "@/components/InvoiceAiDialog";
import type { InvoiceAiResult } from "@/lib/invoice-ai";
import { DatePickerField } from "@/components/DatePickerField";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export interface PurchaseLineItem {
  id: string;
  name: string;
  unitCost: string;
  quantity: string;
  barcode?: string;
  unit?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export function NewPurchasePage() {
  const data = useDB();
  const navigate = useNavigate();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [purchaseNumber, setPurchaseNumber] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [shippingAmount, setShippingAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [attachmentsOpen, setAttachmentsOpen] = useState(true);
  const [financialOpen, setFinancialOpen] = useState(true);
  const [items, setItems] = useState<PurchaseLineItem[]>([
    { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }
  ]);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [invoiceAiOpen, setInvoiceAiOpen] = useState(false);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(() =>
    items.reduce((sum, it) => sum + (Number(it.unitCost) || 0) * (Number(it.quantity) || 0), 0),
    [items]
  );
  const discount = Math.max(0, Number(discountAmount) || 0);
  const tax = Math.max(0, Number(taxAmount) || 0);
  const shipping = Math.max(0, Number(shippingAmount) || 0);
  const total = Math.max(0, subtotal - discount + tax + shipping);
  const paid = paymentType === "cash" ? total : Math.max(0, Number(paidAmount) || 0);
  const remaining = Math.max(0, total - paid);

  const totalUnits = useMemo(() =>
    items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    [items]
  );

  const incompleteItems = useMemo(() => items.filter(it =>
    !it.name.trim() || Number(it.unitCost) <= 0 || Number(it.quantity) <= 0
  ), [items]);
  const canSubmit = Boolean(supplierId && invoiceNumber.trim() && items.length > 0 && incompleteItems.length === 0 && total > 0 &&
    discount <= subtotal && paid <= total && (paymentType === "cash" || !remaining || dueDate) && !busy);

  useEffect(() => {
    db.getNextPurchaseNumber().then(setPurchaseNumber).catch(() => setPurchaseNumber(null));
  }, []);

  useEffect(() => {
    if (paymentType === "cash") setPaidAmount(total ? String(total) : "");
  }, [paymentType, total]);

  const addItem = () => {
    setItems(prev => [
      ...prev, 
      { id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      setItems([{ id: crypto.randomUUID(), name: "", unitCost: "", quantity: "1" }]);
      return;
    }
    setItems(items.filter(it => it.id !== id));
  };

  const updateItem = (id: string, patch: Partial<PurchaseLineItem>) => {
    setItems(items.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const applyAiInvoice = (result: InvoiceAiResult, matchedSupplierId: string | null, files: File[]) => {
    if (matchedSupplierId) setSupplierId(matchedSupplierId);
    if (result.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(result.invoiceDate)) setDate(result.invoiceDate);
    if (result.invoiceNumber) setInvoiceNumber(result.invoiceNumber);
    setInvoiceFiles(files);
    setItems(result.items.map((item) => ({ id: crypto.randomUUID(), name: item.name, unitCost: String(item.unitCost || ""), quantity: String(item.quantity || 1), barcode: item.barcode || undefined })));
    toast.success(`تمت إضافة ${result.items.length} صنف من قراءة الفاتورة. راجع البيانات قبل الحفظ.`);
  };

  const addAttachments = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter(file => file.type.startsWith("image/") || file.type === "application/pdf");
    setInvoiceFiles(prev => {
      const keys = new Set(prev.map(file => `${file.name}:${file.size}:${file.lastModified}`));
      return [...prev, ...incoming.filter(file => !keys.has(`${file.name}:${file.size}:${file.lastModified}`))];
    });
  };

  const handleBarcodeDetected = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    
    setItems(prev => {
      // Check if an existing row already matches this stock item or barcode
      const existingIdx = prev.findIndex(r => 
        (found && r.name.trim().toLowerCase() === found.name.trim().toLowerCase()) || 
        r.barcode === code
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        const currentQty = Number(next[existingIdx].quantity) || 0;
        next[existingIdx] = { 
          ...next[existingIdx], 
          quantity: String(currentQty + 1) 
        };
        return next;
      }

      const newRow: PurchaseLineItem = found
        ? {
            id: crypto.randomUUID(),
            name: found.name,
            unitCost: String(found.lastUnitCost || ""),
            quantity: "1",
            barcode: code
          }
        : {
            id: crypto.randomUUID(),
            name: "",
            unitCost: "",
            quantity: "1",
            barcode: code
          };

      // Replace the first empty row if there's one
      const emptyIdx = prev.findIndex(r => !r.name.trim() && !r.unitCost && !r.barcode);
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...newRow, id: prev[emptyIdx].id };
        return next;
      }

      return [...prev, newRow];
    });

    if (found) {
      toast.success(`تم التعرف على الصنف: ${found.name}`);
    } else {
      toast.info(`باركود جديد: ${code} — يرجى كتابة اسم الصنف وسعر الشراء`);
    }
  };

  // Suggestions from stock catalog and purchase history
  const suggestions = useMemo(() => {
    const map = new Map<string, { cost: number; barcode?: string | null }>();
    data.stockItems.forEach(s => {
      map.set(s.name, { cost: s.lastUnitCost, barcode: s.barcode });
    });
    data.purchaseItems.forEach(pi => {
      if (!map.has(pi.name)) {
        map.set(pi.name, { cost: pi.unitCost });
      }
    });
    return Array.from(map.entries()).map(([name, val]) => ({ 
      name, 
      cost: val.cost, 
      barcode: val.barcode 
    }));
  }, [data.stockItems, data.purchaseItems]);

  const submit = async () => {
    if (!supplierId) {
      toast.error("يرجى اختيار المورد أولاً");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("رقم فاتورة المورد إجباري");
      return;
    }
    if (discount > subtotal) {
      toast.error("الخصم لا يمكن أن يتجاوز إجمالي الأصناف");
      return;
    }
    if (paid > total) {
      toast.error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة");
      return;
    }
    if (paymentType === "credit" && remaining > 0 && !dueDate) {
      toast.error("حدد تاريخ استحقاق الفاتورة الآجلة");
      return;
    }
    const validItems = items.filter(it => it.name.trim() && Number(it.unitCost) > 0 && Number(it.quantity) > 0);

    if (incompleteItems.length > 0) {
      toast.error("راجع الأصناف الناقصة: اكتب الاسم والكمية وسعر التكلفة لكل صنف أو احذفه");
      return;
    }

    if (validItems.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل بسعر تكلفة وكمية صحيحة أكبر من الصفر");
      return;
    }

    setBusy(true);
    try {
      let attachmentPath: string | null = null;
      if (invoiceFiles.length) {
        try {
          const ownerId = await uid();
          const paths: string[] = [];
          for (const file of invoiceFiles) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`;
            const uploaded = await supabase.storage.from("purchase-invoices").upload(path, file, { upsert: false, contentType: file.type || undefined });
            if (uploaded.error) throw uploaded.error;
            paths.push(path);
          }
          attachmentPath = paths.join("|");
        } catch (attachmentError) {
          toast.warning("تمت قراءة الفاتورة، لكن تعذر حفظ المرفق. يمكنك حفظ الفاتورة والمتابعة.");
        }
      }
      // 1. Add purchase atomically via PostgreSQL RPC (which updates stock quantities and last cost safely once)
      await db.addPurchase({
        supplierId,
        total,
        subtotal,
        discountAmount: discount,
        taxAmount: tax,
        shippingAmount: shipping,
        paidAmount: paid,
        dueDate: dueDate || null,
        supplierInvoiceNumber: invoiceNumber.trim(),
        paymentType,
        purchaseDate: date,
        notes: notes.trim() || null,
        attachmentPath,
        items: validItems.map(it => ({
          name: it.name.trim(),
          unitCost: Number(it.unitCost),
          quantity: Number(it.quantity),
          unit: it.unit || "قطعة",
          batchNumber: it.batchNumber?.trim() || null,
          expiryDate: it.expiryDate || null,
        }))
      });

      // 2. If a barcode is provided, update the catalog without duplicating quantity
      for (const item of validItems) {
        const trimmedName = item.name.trim();
        const barcodeVal = item.barcode?.trim() || null;

        if (barcodeVal) {
          const matchedStock = data.stockItems.find(s => 
            s.name.trim().toLowerCase() === trimmedName.toLowerCase()
          );
          if (matchedStock) {
            const patch: any = {};
            if (barcodeVal) patch.barcode = barcodeVal;
            try {
              await db.updateStockItem(matchedStock.id, patch);
            } catch {
              // Non-critical background catalog update
            }
          }
        }
      }

      toast.success(paymentType === "cash" 
        ? "تم تسجيل الفاتورة وخصمها من الخزينة وتحديث المخزون بنجاح" 
        : "تم تسجيل الفاتورة وإضافتها لمديونية المورد وتحديث المخزون بنجاح");
      
      navigate("/purchases");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="mx-auto max-w-5xl">
          <PageHeader
            title="فاتورة شراء جديدة"
            subtitle="تسجيل مشتريات بضاعة وتحديث المخزون وأسعار التكلفة تلقائياً."
            icon={<ShoppingCart className="w-7 h-7 text-primary" />}
            action={
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggle} 
                  title="خصوصية الأرقام" 
                  className="rounded-full h-9 w-9 p-0"
                >
                  {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button variant="outline" size="sm" asChild className="rounded-full h-9">
                  <Link to="/purchases">
                    <X className="w-4 h-4 me-1.5" /> إلغاء
                  </Link>
                </Button>
                <Button 
                  size="sm" 
                  onClick={submit} 
                  disabled={!canSubmit}
                  className="rounded-full h-9 shadow-sm bg-primary text-primary-foreground font-bold"
                >
                  <Save className="w-4 h-4 me-1.5" /> حفظ الفاتورة
                </Button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-6">
            <div className="space-y-6">
              <Reveal>
                <div className="space-y-6 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
                  {/* Supplier & Date selection */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-right">
                    <div className="space-y-2">
                      <Label className="font-bold text-sm">المورد <span className="text-danger">*</span></Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue placeholder="اختر المورد..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {data.suppliers.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground text-center">
                              لا يوجد موردين مسجلين. <Link to="/suppliers" className="text-primary underline">إضافة مورد</Link>
                            </div>
                          ) : (
                            data.suppliers.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-sm">تاريخ الفاتورة</Label>
                      <DatePickerField value={date} onChange={setDate} className="h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-sm">رقم فاتورة المورد <span className="text-danger">*</span></Label>
                      <Input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="مثال: 20603"
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-sm">كود فاتورة الشراء</Label>
                      <div className="relative">
                        <Input value={purchaseNumber ? String(purchaseNumber) : "تلقائي عند الحفظ"} readOnly disabled className="h-12 rounded-xl pe-20 font-mono font-bold opacity-100" />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-bold text-info">تلقائي</span>
                      </div>
                    </div>
                  </div>

                  {/* Purchased Items section */}
                  <div className="space-y-3 text-right pt-2 border-t border-border/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline" 
                          onClick={addItem} 
                          className="rounded-full border-border bg-foreground/[0.04] text-foreground font-semibold hover:bg-foreground/[0.08]"
                        >
                          <Plus className="w-4 h-4 me-1.5" /> إضافة صنف
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setInvoiceAiOpen(true)}
                          className="rounded-full border-primary/30 bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                        >
                          <ScanSearch className="w-4 h-4 me-1.5" /> قراءة الفاتورة بالذكاء الاصطناعي
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setScanOpen(true)} 
                          className="rounded-full border-primary/30 bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                        >
                          <ScanLine className="w-4 h-4 me-1.5" /> قارئ الباركود
                        </Button>
                      </div>
                      <Label className="text-base font-bold text-foreground">
                        الأصناف المشتراة ({items.length})
                      </Label>
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {items.map((it, idx) => (
                          <motion.div
                            key={it.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="rounded-2xl border border-border/60 bg-foreground/[0.02] p-4 space-y-3 relative group"
                          >
                            <div className="flex items-center justify-between border-b border-border/30 pb-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeItem(it.id)}
                                disabled={items.length === 1 && !it.name && !it.unitCost}
                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                              <div className="flex items-center gap-2">
                                {it.barcode && (
                                  <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <ScanLine className="w-3 h-3" /> {it.barcode}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-muted-foreground">صنف #{idx + 1}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {/* Product Name */}
                              <div className="space-y-1 text-right sm:col-span-2 lg:col-span-1">
                                <Label className="text-xs text-muted-foreground font-semibold">اسم المنتج <span className="text-danger">*</span></Label>
                                <Input 
                                  list="stock-suggestions"
                                  value={it.name} 
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const match = suggestions.find(s => s.name.toLowerCase() === v.trim().toLowerCase());
                                    updateItem(it.id, match 
                                      ? { 
                                          name: v, 
                                          unitCost: String(match.cost || ""), 
                                          barcode: match.barcode || it.barcode
                                        } 
                                      : { name: v }
                                    );
                                  }}
                                  placeholder="ابحث أو اكتب اسم الصنف..."
                                  className="rounded-xl font-medium"
                                />
                              </div>

                              {/* Unit Cost */}
                              <div className="space-y-1 text-right">
                                <Label className="text-xs text-muted-foreground font-semibold">سعر التكلفة (ج.م) <span className="text-danger">*</span></Label>
                                <Input 
                                  type="number" 
                                  step="any"
                                  value={it.unitCost} 
                                  onChange={(e) => updateItem(it.id, { unitCost: e.target.value })} 
                                  placeholder="0.00"
                                  className={cn("rounded-xl font-mono text-right font-bold", blurCls)}
                                />
                              </div>

                              {/* Quantity */}
                              <div className="space-y-1 text-right">
                                <Label className="text-xs text-muted-foreground font-semibold">الكمية <span className="text-danger">*</span></Label>
                                <Input 
                                  type="number" 
                                  min="1"
                                  value={it.quantity} 
                                  onChange={(e) => updateItem(it.id, { quantity: e.target.value })} 
                                  placeholder="1"
                                  className="rounded-xl font-mono text-right font-bold"
                                />
                              </div>

                              <div className="space-y-1 text-right">
                                <Label className="text-xs text-muted-foreground font-semibold">الوحدة</Label>
                                <Input value={it.unit || "قطعة"} onChange={(e) => updateItem(it.id, { unit: e.target.value })} placeholder="قطعة" className="rounded-xl" />
                              </div>

                            </div>

                            <details className="rounded-xl border border-border/30 bg-background/30 px-3 py-2 text-right">
                              <summary className="cursor-pointer list-none text-xs font-bold text-muted-foreground">تفاصيل إضافية للصنف <ChevronDown className="ms-1 inline h-3.5 w-3.5" /></summary>
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">رقم التشغيلة / الدفعة</Label>
                                  <Input value={it.batchNumber || ""} onChange={(e) => updateItem(it.id, { batchNumber: e.target.value })} placeholder="اختياري" className="rounded-xl" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">تاريخ الانتهاء</Label>
                                  <DatePickerField value={it.expiryDate} onChange={(value) => updateItem(it.id, { expiryDate: value })} className="h-10" placeholder="اختياري" />
                                </div>
                              </div>
                            </details>

                            {/* Subtotal of line item */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/20 text-xs">
                              <span className={cn("font-extrabold text-foreground tabular-nums", blurCls)}>
                                الإجمالي: {fmt((Number(it.unitCost) || 0) * (Number(it.quantity) || 0))} ج.م
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <datalist id="stock-suggestions">
                      {suggestions.map(s => <option key={s.name} value={s.name} />)}
                    </datalist>
                  </div>

                  {/* Additional financial data */}
                  <div className="space-y-4 text-right pt-2 border-t border-border/40">
                    <button type="button" onClick={() => setFinancialOpen(v => !v)} className="flex w-full items-center justify-between text-sm font-bold">
                      <ChevronDown className={cn("h-4 w-4 transition-transform", !financialOpen && "-rotate-90")} />
                      <span>التكاليف والإجمالي النهائي</span>
                    </button>
                    {financialOpen && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          ["الخصم", discountAmount, setDiscountAmount],
                          ["الضريبة", taxAmount, setTaxAmount],
                          ["الشحن والمصاريف", shippingAmount, setShippingAmount],
                        ].map(([label, value, setter]) => (
                          <div key={String(label)} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{label} (ج.م)</Label>
                            <Input type="number" min="0" step="any" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className="rounded-xl font-mono" placeholder="0.00" />
                          </div>
                        ))}
                        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                          <div className="text-xs text-muted-foreground">الإجمالي النهائي</div>
                          <div className={cn("mt-1 text-lg font-black text-primary", blurCls)}>{fmt(total)} ج.م</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment terms */}
                  <div className="space-y-4 text-right pt-2 border-t border-border/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-bold">المبلغ المدفوع (ج.م)</Label>
                        <Input type="number" min="0" step="any" disabled={paymentType === "cash"} value={paymentType === "cash" ? String(total) : paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-11 rounded-xl font-mono" placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-bold">تاريخ الاستحقاق {paymentType === "credit" && remaining > 0 && <span className="text-danger">*</span>}</Label>
                        <DatePickerField value={dueDate} onChange={setDueDate} disabled={paymentType === "cash" || remaining === 0} className="h-11" placeholder={paymentType === "cash" ? "غير مطلوب للنقدي" : "اختر تاريخ الاستحقاق"} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-warning/10 px-3 py-2 text-sm">
                      <span className={cn("font-black text-warning", blurCls)}>{fmt(remaining)} ج.م</span><span className="text-muted-foreground">المتبقي على المورد</span>
                    </div>
                  </div>

                  {/* Paper invoice attachments */}
                  <div className="space-y-3 text-right pt-2 border-t border-border/40">
                    <button type="button" onClick={() => setAttachmentsOpen(v => !v)} className="flex w-full items-center justify-between text-sm font-bold">
                      <ChevronDown className={cn("h-4 w-4 transition-transform", !attachmentsOpen && "-rotate-90")} />
                      <span className="inline-flex items-center gap-2"><Paperclip className="h-4 w-4 text-info" /> صورة / ملف الفاتورة الورقية</span>
                    </button>
                    {attachmentsOpen && <>
                      <input ref={attachmentInputRef} type="file" accept="image/*,.pdf" capture="environment" multiple className="hidden" onChange={(e) => addAttachments(e.target.files)} />
                      <button type="button" onClick={() => attachmentInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-info/50 bg-info/5 px-4 py-4 text-sm font-bold text-info hover:bg-info/10">
                        <Upload className="h-4 w-4" /> رفع صورة أو PDF / التصوير بالكاميرا
                      </button>
                      {invoiceFiles.length > 0 && <div className="space-y-2">
                        {invoiceFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs">
                          <button type="button" onClick={() => setInvoiceFiles(prev => prev.filter((_, i) => i !== index))} className="text-danger hover:underline">إزالة</button>
                          <span className="truncate">{file.name}</span>
                        </div>)}
                      </div>}
                    </>}
                  </div>

                  {/* Notes / Reference */}
                  <div className="space-y-2 text-right pt-2 border-t border-border/40">
                    <Label className="font-bold text-sm">ملاحظات الفاتورة / رقم الإذن الورقي</Label>
                    <Textarea
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="رقم الفاتورة الورقية عند المورد، بيانات الشحن، إلخ..."
                      rows={2}
                      className="rounded-xl resize-none"
                    />
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Sidebar Summary */}
            <aside className="space-y-4">
              <Reveal delay={100}>
                <div className="space-y-5 lg:sticky lg:top-24 rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
                  <div className="text-right">
                    <Label className="text-muted-foreground text-xs uppercase tracking-widest font-bold">
                      إجمالي الفاتورة
                    </Label>
                    <div className={cn("text-3xl font-black mt-2 text-primary tabular-nums", blurCls)}>
                      {fmt(total)} <span className="text-sm font-bold text-muted-foreground">ج.م</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">
                      إجمالي {items.length} صنف / {totalUnits} قطعة
                    </div>
                    {incompleteItems.length > 0 && (
                      <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                        يوجد {incompleteItems.length} صنف يحتاج بيانات قبل الحفظ
                      </div>
                    )}
                  </div>

                  {/* Payment Type Toggle */}
                  <div className="space-y-3 pt-4 border-t border-border/40 text-right">
                    <Label className="text-xs font-bold text-foreground">طريقة الدفع للمورد</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType("cash")}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold text-right",
                          paymentType === "cash" 
                            ? "border-success bg-success/10 text-success" 
                            : "border-border/60 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.05]"
                        )}
                      >
                        <Banknote className="w-4 h-4 shrink-0" />
                        <div>
                          <div>نقدي (خزينة)</div>
                          <div className="text-[11px] font-normal opacity-80">يُخصم من رصيد الدرج كاش</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType("credit")}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold text-right",
                          paymentType === "credit" 
                            ? "border-warning bg-warning/10 text-warning" 
                            : "border-border/60 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.05]"
                        )}
                      >
                        <Wallet className="w-4 h-4 shrink-0" />
                        <div>
                          <div>آجل (مديونية)</div>
                          <div className="text-[11px] font-normal opacity-80">يُضاف لحساب المورد المعلق</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="py-1 flex gap-2.5 text-right">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      يتم تحديث رصيد المخزون فورياً وتعديل آخر تكلفة شراء بعد حفظ الفاتورة.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/30 bg-foreground/[0.03] px-3 py-2 text-sm">
                    <span className={cn("font-extrabold tabular-nums", paymentType === "credit" ? "text-warning" : "text-success", blurCls)}>
                      {fmt(total)} ج.م
                    </span>
                    <span className="text-muted-foreground">{paymentType === "credit" ? "المتبقي على المورد" : "المدفوع نقدًا"}</span>
                  </div>

                  <Button 
                    onClick={submit} 
                    disabled={!canSubmit}
                    className="w-full h-12 rounded-xl text-base font-bold shadow bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="w-5 h-5 me-2" /> حفظ الفاتورة والمخزون
                  </Button>
                </div>
              </Reveal>
            </aside>
          </div>

          <div className="sticky bottom-3 z-20 mt-4 lg:hidden">
            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="h-12 w-full rounded-2xl text-base font-bold shadow-lg bg-primary text-primary-foreground"
            >
              <Save className="w-5 h-5 me-2" /> حفظ الفاتورة والمخزون
            </Button>
          </div>
        </div>

        {/* Barcode scanner dialog */}
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={handleBarcodeDetected}
          title="مسح باركود صنف للشراء"
        />
        <InvoiceAiDialog
          open={invoiceAiOpen}
          onOpenChange={setInvoiceAiOpen}
          suppliers={data.suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          onApply={applyAiInvoice}
        />
      </PageTransition>
    </AppShell>
  );
}

export default NewPurchasePage;
