import { useEffect, useMemo, useRef, useState } from "react";
import { format, addMonths } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import type { ProductRow } from "@/types";

import {
  useDB,
  db,
  fmt,
  customerBalance,
  useShopSettings,
  uid,
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { linkInvoiceToBranch, resolveStampBranchId } from "@/lib/branch-system";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { findStockByBarcode } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { cn } from "@/lib/utils";
import {
  Plus,
  ScanLine,
  Receipt,
  ArrowRight,
  Eye,
  EyeOff,
  PauseCircle,
} from "lucide-react";
import { useParkedBills, playScanSound, playCashSound } from "@/lib/pos";
import { useSecurity, shouldRequireManagerPinForDiscount, shouldHideCostAndProfits } from "@/lib/security";
import { ManagerPinModal } from "@/components/ManagerPinModal";
import { InvoiceSummarySidebar } from "@/components/invoices/InvoiceSummarySidebar";
import { InvoiceMobileActionBar } from "@/components/invoices/InvoiceMobileActionBar";
import { InvoiceProductRow } from "@/components/invoices/InvoiceProductRow";
import { CashierShortcutsBar } from "@/components/invoices/CashierShortcutsBar";
import { InvoiceStepsBar } from "@/components/invoices/InvoiceStepsBar";
import { InvoiceCustomerStep } from "@/components/invoices/InvoiceCustomerStep";
import { InvoiceDiscountTaxCard } from "@/components/invoices/InvoiceDiscountTaxCard";
import { InvoiceShippingStep } from "@/components/invoices/InvoiceShippingStep";
import { CashPaymentPanel } from "@/components/invoices/CashPaymentPanel";
import { InstallmentsPaymentPanel } from "@/components/invoices/InstallmentsPaymentPanel";
import { InvoiceProfitCard } from "@/components/invoices/InvoiceProfitCard";
import { ParkedBillsModal } from "@/components/ParkedBillsModal";
import { calculateLineFinancials } from "@/lib/financial-engine";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <NewInvoicePage />
      </PageTransition>
    </AppShell>
  );
}

function NewInvoicePage() {
  const data = useDB();
  const { settings: shop } = useShopSettings();
  const { privacy, toggle } = usePrivacy();
  const { isCashierMode } = useSecurity();
  const { parkedBills, parkBill } = useParkedBills();
  const navigate = useNavigate();

  const hideProfits = shouldHideCostAndProfits(shop, isCashierMode) || privacy;
  const blurCls = hideProfits ? "privacy-blur" : "privacy-clear";

  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([
    { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" },
  ]);
  const [down, setDown] = useState("0");
  const [monthly, setMonthly] = useState("");
  const [count, setCount] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saleType, setSaleType] = useState<"cash" | "installments">("installments");
  const [cashPaid, setCashPaid] = useState("");
  const [step, setStep] = useState(1);
  const [discountPct, setDiscountPct] = useState("");
  const [discountAmt, setDiscountAmt] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const [status, setStatus] = useState<"paid" | "pending" | "cancelled">("pending");
  const [shippingCarrierId, setShippingCarrierId] = useState("");
  const [shippingZoneId, setShippingZoneId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Commercial POS Features
  const [quickBarcodeInput, setQuickBarcodeInput] = useState("");
  const [parkedModalOpen, setParkedModalOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingSubmitAction, setPendingSubmitAction] = useState<(() => void) | null>(null);

  // Split Payment (الدفع المجزأ)
  const [enableSplitPayment, setEnableSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState("");
  const [splitElectronic, setSplitElectronic] = useState("");
  const [splitMethod, setSplitMethod] = useState<"instapay" | "vodafone_cash" | "visa" | "bank_transfer">("instapay");
  const [splitRef, setSplitRef] = useState("");

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const defaultFirstDue = () => {
    const day = Math.min(28, Math.max(1, shop.defaultDueDay || 1));
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, day);
  };

  useEffect(() => {
    setCount((c) => c || String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate((d) => d ?? defaultFirstDue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.defaultInstallmentMonths, shop.defaultDueDay]);

  const invoiceCode = `#${String((data.invoices?.length ?? 0) + 1).padStart(4, "0")}`;

  const customer = data.customers.find((c) => c.id === customerId);
  const blocked = customer && (customer.frozen || customer.status === "defaulter");

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.quantity || 1), 0);
  const subtotal = products.reduce((s, p) => s + calculateLineFinancials({
    price: Number(p.price || 0),
    quantity: Number(p.quantity || 1),
    discountPct: Number(p.discount || 0),
    taxPct: Number(p.taxPct || 0),
  }).lineTotal, 0);
  const discountValue = Math.min(subtotal, Math.max(0, Number(discountAmt || 0)));
  const afterDiscount = Math.max(0, subtotal - discountValue);
  const taxValue = Math.max(0, (afterDiscount * Number(taxPct || 0)) / 100);
  const totalPrice = afterDiscount + taxValue;
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = afterDiscount - totalCost;
  const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const downNum = Number(down || 0);
  const countNum = Number(count || 0);
  const monthlyNum = Number(monthly || 0);
  const cashPaidNum = Number(cashPaid || 0);
  const change = Math.max(0, cashPaidNum - totalPrice);
  const cashShort = Math.max(0, totalPrice - cashPaidNum);
  const isCashMode = saleType === "cash" || (totalPrice > 0 && downNum >= totalPrice);
  const totalDue = downNum + monthlyNum * countNum;

  // Split payment totals
  const splitCashNum = Number(splitCash || 0);
  const splitElecNum = Number(splitElectronic || 0);
  const splitTotal = splitCashNum + splitElecNum;
  const splitDiff = Math.abs(splitTotal - totalPrice);

  const handleScan = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (!found) {
      toast.error(`لا يوجد منتج بالباركود: ${code}`, {
        description: "يمكنك إضافته كمنتج جديد للمخزن.",
        action: {
          label: "إضافة منتج جديد",
          onClick: async () => {
            try {
              await db.addStockItem({ name: `منتج ${code.slice(-4)}`, barcode: code });
              toast.success("تمت إضافة المنتج للمخزن — حدّث بياناته من صفحة المخزن");
            } catch (e: any) {
              toast.error(e?.message ?? "تعذر الإضافة");
            }
          },
        },
      });
      return;
    }

    playScanSound();
    setProducts((prev) => {
      const existingIdx = prev.findIndex((r) => r.stockId === found.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: String((Number(next[existingIdx].quantity) || 0) + 1),
        };
        return next;
      }
      const emptyIdx = prev.findIndex((r) => !r.name && !r.stockId);
      const newRow: ProductRow = {
        id: crypto.randomUUID(),
        stockId: found.id,
        name: found.name,
        cost: String(found.lastUnitCost || 0),
        price: String(found.salePrice || 0),
        quantity: "1",
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...newRow, id: prev[emptyIdx].id };
        return next;
      }
      return [...prev, newRow];
    });
    toast.success(`تمت إضافة: ${found.name} ✓`);
  };

  // Continuous Fast Barcode Keydown Handler
  const handleQuickBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickBarcodeInput.trim();
    if (!code) return;
    setQuickBarcodeInput("");
    handleScan(code);
  };

  const schedule = useMemo(() => {
    if (isCashMode || !date || countNum <= 0 || monthlyNum <= 0) return [];
    const rows: { n: number; due: Date; amount: number }[] = [];
    let left = remaining;
    for (let i = 0; i < Math.min(countNum, 60); i++) {
      const amount =
        i === countNum - 1 ? Math.max(0, left) : Math.min(monthlyNum, Math.max(0, left));
      left -= amount;
      rows.push({ n: i + 1, due: addMonths(date, i), amount });
    }
    return rows;
  }, [isCashMode, date, countNum, monthlyNum, remaining]);

  const hasValidProduct = products.some(
    (p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0,
  );
  const blockReason = !customerId
    ? "اختر العميل أولًا (أو اضغط F1 لاختيار عميل نقدي سريع)"
    : blocked
      ? "العميل محظور من فتح فواتير جديدة"
      : !hasValidProduct
        ? "أضف منتج واحد على الأقل بسعر صحيح"
        : !isCashMode && (!monthlyNum || !date)
          ? "أكمل بيانات الأقساط (القسط الشهري وتاريخ أول قسط)"
          : !isCashMode && customer?.customerType === "cash"
            ? "العميل فوري (نقدي) — لا يسمح بالتقسيط"
            : enableSplitPayment && splitDiff > 0.01
              ? `مجموع الدفع المجزأ (${fmt(splitTotal)}) لا يساوي إجمالي الفاتورة (${fmt(totalPrice)})`
              : null;

  useEffect(() => {
    const n = Number(count);
    if (n > 0 && remaining > 0) setMonthly(String(Math.ceil(remaining / n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, totalPrice, down]);

  const customerInfo = useMemo(() => {
    if (!customer) return null;
    const balance = customerBalance(data.invoices, customer.id, customer.openingBalance);
    const limit = customer.creditLimit || 0;
    const wouldExceed = limit > 0 && balance + remaining > limit;
    return { balance, limit, wouldExceed };
  }, [customer, data.invoices, remaining]);

  const handleCustomerChange = (v: string) => {
    setCustomerId(v);
    const c = data.customers.find((x) => x.id === v);
    if (c?.customerType === "cash") {
      setSaleType("cash");
      setDown("0");
      setMonthly("");
      setCount("");
    } else if (c) {
      setSaleType("installments");
      if (!date) setDate(addMonths(new Date(), 1));
    }
  };

  const handleSaleTypeChange = (key: "cash" | "installments") => {
    const locked = key === "installments" && customer?.customerType === "cash";
    if (locked) {
      toast.error(
        "هذا عميل فوري (نقدي) — غيّر نوع العميل لقسط أولًا لو عايز تقسيط",
      );
      return;
    }
    setSaleType(key);
    if (key === "installments" && !date) setDate(addMonths(new Date(), 1));
    if (key === "cash") setDown("0");
  };
  const addProduct = () =>
    setProducts((p) => [
      ...p,
      { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" },
    ]);
  const removeProduct = (id: string) =>
    setProducts((p) => (p.length > 1 ? p.filter((x) => x.id !== id) : p));
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const selectDefaultCashCustomer = () => {
    const cashCust =
      data.customers.find((c) => c.customerType === "cash" || c.name.includes("نقدي")) ||
      data.customers[0];
    if (cashCust) {
      setCustomerId(cashCust.id);
      setSaleType("cash");
      setDown("0");
      setMonthly("");
      setCount("");
      toast.success(`تم اختيار العميل: ${cashCust.name} (بيع فوري)`);
    } else {
      toast.error("لا يوجد عملاء مسجلين. أضف عميل أولاً.");
    }
  };

  const handleParkCurrentBill = () => {
    const validProducts = products.filter((p) => p.name.trim());
    if (validProducts.length === 0) {
      toast.error("لا توجد منتجات لتعليق الفاتورة");
      return;
    }
    parkBill({
      customerName: customer?.name || "عميل نقدي",
      customerId: customerId || undefined,
      totalAmount: totalPrice,
      products: validProducts,
      notes: notes || undefined,
      saleType,
    });
    toast.success("تم تعليق الفاتورة بنجاح (Parked Bill)");
    reset();
  };

  const handleResumeParkedBill = (bill: any) => {
    if (bill.customerId) setCustomerId(bill.customerId);
    if (bill.saleType) setSaleType(bill.saleType);
    if (bill.notes) setNotes(bill.notes);
    if (bill.products && bill.products.length > 0) {
      setProducts(bill.products);
    }
    setStep(2);
    toast.success(`تم استرجاع الفاتورة المعلقة للعميل: ${bill.customerName}`);
  };

  const reset = () => {
    setCustomerId("");
    setProducts([{ id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
    setDown("0");
    setMonthly("");
    setCount(String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate(defaultFirstDue());
    setNotes("");
    setSaleType("installments");
    setCashPaid("");
    setDiscountPct("");
    setDiscountAmt("");
    setTaxPct("");
    setStatus("pending");
    setShippingCarrierId("");
    setShippingZoneId("");
    setShippingAddress("");
    setTrackingNumber("");
    setEnableSplitPayment(false);
    setSplitCash("");
    setSplitElectronic("");
    setSplitRef("");
  };

  const executeSubmit = async (stay = false, printDirectThermal = false) => {
    if (!customerId) return toast.error("اختر عميل");
    if (blocked) return toast.error("هذا العميل محظور من فتح فواتير جديدة");
    const validProducts = products.filter(
      (p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0,
    );
    if (validProducts.length === 0) return toast.error("أضف منتج واحد على الأقل بسعر صحيح");
    for (const p of validProducts) {
      const serials = (p.serialNumbers || "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
      if (serials.length > Number(p.quantity || 0)) {
        return toast.error(`عدد أرقام السيريال للصنف «${p.name}» أكبر من الكمية`);
      }
      if (new Set(serials).size !== serials.length) {
        return toast.error(`يوجد رقم سيريال مكرر داخل الصنف «${p.name}»`);
      }
      if (!p.stockId) continue;
      const stock = data.stockItems.find((s) => s.id === p.stockId);
      const qty = Number(p.quantity || 0);
      if (!stock) return toast.error(`المنتج "${p.name}" غير موجود في المخزون`);
      if (stock.quantity <= 0) return toast.error(`المنتج "${stock.name}" نفد من المخزون`);
      if (stock.quantity < qty)
        return toast.error(`الكمية المتاحة من "${stock.name}" هي ${stock.quantity} فقط`);
    }
    const t = totalPrice;
    const d = Number(down);
    const isCash = saleType === "cash" || (t > 0 && d >= t);
    const m = isCash ? 0 : Number(monthly);
    if (!isCash && (!m || !date)) return toast.error("املأ بيانات الأقساط");
    if (!isCash && customer?.customerType === "cash") {
      return toast.error(
        "العميل مسجّل «فوري (نقدي)» — لازم تحصيل كامل المبلغ أو تغيّر نوعه لعميل قسط",
      );
    }
    if (customerInfo?.wouldExceed && !isCash) {
      return toast.error(
        `تجاوز سقف المديونية (${fmt(customerInfo.limit)} ج.م) — عدّل المقدم أو ارفع السقف`,
      );
    }

    const iso = isCash ? format(new Date(), "yyyy-MM-dd") : format(date as Date, "yyyy-MM-dd");
    const summary = validProducts
      .map((p) => `${p.name.trim()}${Number(p.quantity) > 1 ? ` ×${p.quantity}` : ""}`)
      .join("، ");
    const productNotes = `${summary}${notes ? ` — ${notes}` : ""}`;

    try {
      const userId = await uid();
      const invId = await db.addInvoice({
        customerId,
        total: t,
        downPayment: isCash ? t : d,
        monthlyInstallment: m,
        firstDueDate: iso,
        notes: productNotes,
        paid: isCash ? t : d,
        discountPct: Number(discountPct || 0),
        discountAmount: discountValue,
        taxPct: Number(taxPct || 0),
        taxAmount: taxValue,
        status: isCash ? "paid" : status,
        items: validProducts.map((p) => ({
          name: p.name.trim(),
          cost: Number(p.cost || 0),
          price: Number(p.price || 0),
          quantity: Math.max(1, Number(p.quantity || 1)),
          discountPct: Math.min(100, Math.max(0, Number(p.discount || 0))),
          taxPct: Math.max(0, Number(p.taxPct || 0)),
          serialNumbers: (p.serialNumbers || "").split(/[\\n,]+/).map((value) => value.trim()).filter(Boolean),
          stockId: p.stockId,
        })),
      });
      if (!invId) throw new Error("تعذر إنشاء الفاتورة");

      // ختم الفاتورة بالفرع النشط
      linkInvoiceToBranch(invId, resolveStampBranchId(data.branches));

      // Add Shipment if carrier selected
      if (shippingCarrierId && invId) {
        const { error: shipErr } = await supabase.from("shipments").insert({
          user_id: userId,
          invoice_id: invId,
          carrier_id: shippingCarrierId,
          zone_id: shippingZoneId || null,
          tracking_number: trackingNumber || null,
          status: "pending",
          recipient_name: customer?.name,
          recipient_phone: customer?.phone,
          delivery_address: shippingAddress || customer?.address,
        });
        if (shipErr) throw shipErr;
      }

      playCashSound();

      // Print direct thermal receipt if requested or configured
      if (printDirectThermal || shop.autoPrintOnSave) {
        const cur = shop.currency || "ج.م";
        const body = `
<div class="info">
  <div class="box"><b>العميل:</b> ${customer?.name || "عميل نقدي"}</div>
  <div class="box"><b>الهاتف:</b> ${customer?.phone || "—"}</div>
</div>
<div class="t-wrap"><table>
  <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>
    ${validProducts.map((p) => `<tr><td>${p.name}</td><td>${p.quantity}</td><td class="num">${p.price}</td><td class="num">${Number(p.price) * Number(p.quantity)} ${cur}</td></tr>`).join("")}
  </tbody>
</table></div>
<div class="total-bar"><span>الإجمالي الصافي:</span><span class="v">${fmt(t)} ${cur}</span></div>
${enableSplitPayment ? `<div style="font-size:11px;padding:4px 0;border-bottom:1px dashed #ccc;">كاش: ${fmt(splitCashNum)} ${cur} | إلكتروني (${splitMethod}): ${fmt(splitElecNum)} ${cur}</div>` : ""}
<div style="text-align:center;font-size:10px;margin-top:8px;color:#555;">شكراً لزيارتكم!</div>`;

        const html = pdfDocument({
          docTitle: `فاتورة ${invoiceCode}`,
          badge: isCash ? "فاتورة مبيعات نقدية" : "فاتورة مبيعات تقسيط",
          title: esc(shop.shopName || "فاتورة ضريبية مبسطة"),
          brandSub: shop.shopName ? esc(shop.shopName) : undefined,
          meta: [
            { label: "رقم الفاتورة", value: invoiceCode },
            { label: "التاريخ", value: format(new Date(), "yyyy/MM/dd HH:mm") },
            ...(shop.taxNumber ? [{ label: "الرقم الضريبي", value: esc(shop.taxNumber) }] : []),
          ],
          kpis: [{ label: "الإجمالي", value: `${fmt(t)} ${cur}`, tone: "brand" }],
          body,
          paper: shop.printPaper || "thermal",
          thermalWidth: shop.thermalPaperWidth || "80mm",
          kickCashDrawer: shop.openCashDrawerOnPrint ?? true,
          barcodeValue: invoiceCode.replace("#", ""),
        });
        openPdfDocument(html, {
          autoPrint: true,
          features: "width=420,height=760",
        });
      }

      toast.success(isCash ? "تم إنشاء فاتورة البيع النقدي ✓ وطباعة الإيصال" : "تم إنشاء الفاتورة بنجاح ✓");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إنشاء الفاتورة");
      return;
    }
    reset();
    if (!stay) navigate({ to: "/invoices" });
  };

  const submit = (stay = false, printDirectThermal = false) => {
    // Check Manager PIN for high discounts
    const pct = Number(discountPct || 0);
    if (shouldRequireManagerPinForDiscount(pct, shop, isCashierMode)) {
      setPendingSubmitAction(() => () => executeSubmit(stay, printDirectThermal));
      setPinModalOpen(true);
      return;
    }
    executeSubmit(stay, printDirectThermal);
  };

  // Keyboard Hotkeys: F1 (Cash Customer), F2 (Barcode Focus), F4 (Park Bill), F8 (Parked Bills), F9 (Fast Cash Pay & Print), Alt+N (Add Row), Ctrl+S (Save)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        selectDefaultCashCustomer();
      } else if (e.key === "F2") {
        e.preventDefault();
        setStep(2);
        barcodeInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleParkCurrentBill();
      } else if (e.key === "F8") {
        e.preventDefault();
        setParkedModalOpen(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        if (!blockReason) {
          submit(true, true);
        } else {
          toast.error(blockReason);
        }
      } else if (e.altKey && (e.key === "n" || e.key === "ن")) {
        e.preventDefault();
        setStep(2);
        addProduct();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "س")) {
        e.preventDefault();
        if (!blockReason) submit(false);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "h" || e.key === "ا")) {
        e.preventDefault();
        toggle();
        toast.info(privacy ? "تم إظهار بيانات الربح" : "تم إخفاء بيانات الربح (وضع الخصوصية)");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PageHeader
        eyebrow="نظام الكاشير ونقاط البيع (POS & Billing)"
        title="شاشة الكاشير وإصدار الفواتير"
        subtitle="مسح باركود متتالي سريع، تعليق فواتير، ودفع مجزأ نقدياً وإلكترونياً."
        icon={<Receipt className="h-7 w-7" />}
        action={
          <div className="flex items-center gap-2">
            {/* زر الفواتير المعلقة */}
            <Button
              variant="outline"
              onClick={() => setParkedModalOpen(true)}
              className="relative rounded-full gap-1.5 h-10 px-3.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              title="الفواتير المعلقة (F8)"
            >
              <PauseCircle className="h-4 w-4" />
              <span className="hidden sm:inline">المعلقة</span>
              {parkedBills.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                  {parkedBills.length}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className={cn(
                "h-10 w-10 rounded-full transition-colors",
                privacy
                  ? "bg-warning/10 text-warning hover:bg-warning/20"
                  : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
              )}
              title={privacy ? "إظهار الأرباح (Ctrl+H)" : "إخفاء الأرباح (Ctrl+H)"}
            >
              {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <span className="rounded-full border border-border/30 bg-foreground/[0.06] px-4 py-2 font-mono text-sm font-bold tracking-wider text-foreground">
              {invoiceCode}
            </span>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/invoices">
                <ArrowRight className="me-1.5 h-4 w-4" />
                رجوع للفواتير
              </Link>
            </Button>
          </div>
        }
      />

      {/* شريط الاختصارات السريعة للكاشير */}
      <CashierShortcutsBar onSelectDefaultCashCustomer={selectDefaultCashCustomer} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ===== العمود الرئيسي ===== */}
        <div className="order-2 space-y-4 text-right lg:order-1">
          {/* الخطوات */}
          <InvoiceStepsBar step={step} productCount={products.filter((p) => p.name.trim()).length} onStepChange={setStep} />

          <InvoiceCustomerStep
            customers={data.customers}
            customerId={customerId}
            onCustomerChange={handleCustomerChange}
            customer={customer}
            customerInfo={customerInfo}
            blocked={blocked}
            saleType={saleType}
            onSaleTypeChange={handleSaleTypeChange}
            onSelectDefaultCashCustomer={selectDefaultCashCustomer}
          />

          {step === 2 && (
            <div className="space-y-3">
              {/* ماسح الباركود السريع المتتالي */}
              <form
                onSubmit={handleQuickBarcodeSubmit}
                className="p-3.5 rounded-2xl bg-primary/[0.04] border border-primary/20 flex items-center gap-2"
              >
                <ScanLine className="w-5 h-5 text-primary shrink-0" />
                <Input
                  ref={barcodeInputRef}
                  value={quickBarcodeInput}
                  onChange={(e) => setQuickBarcodeInput(e.target.value)}
                  placeholder="امسح أو اكتب الباركود واضغط Enter للبيع المتتالي السريع (F2)..."
                  className="h-10 border-primary/20 bg-background text-sm font-mono"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-10 px-4 shrink-0 font-bold">
                  إضافة
                </Button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addProduct}
                    className="gap-1.5 rounded-full border border-border/30 px-4 text-muted-foreground hover:bg-foreground/[0.05]"
                  >
                    <Plus className="w-4 h-4" /> إضافة صنف آخر
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setScanOpen(true)}
                    className="gap-1.5 rounded-full border border-border/30 px-4 text-muted-foreground hover:bg-foreground/[0.05]"
                  >
                    <ScanLine className="w-4 h-4" /> كاميرا الباركود
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleParkCurrentBill}
                    className="gap-1.5 rounded-full border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    <PauseCircle className="w-4 h-4" /> تعليق الفاتورة (F4)
                  </Button>
                </div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  المنتجات ({products.length})
                </Label>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-[1.75rem] border border-border/30 p-5 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {products.map((p, idx) => (
                    <InvoiceProductRow
                      key={p.id}
                      product={p}
                      index={idx}
                      stockItems={data.stockItems}
                      canRemove={products.length > 1}
                      hideProfits={hideProfits}
                      costBlurClass={blurCls}
                      onUpdate={updateProduct}
                      onRemove={removeProduct}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* الخصم والضريبة */}
              <InvoiceDiscountTaxCard
                subtotal={subtotal}
                taxPct={taxPct}
                onTaxPctChange={setTaxPct}
                discountPct={discountPct}
                onDiscountPctChange={setDiscountPct}
                discountAmt={discountAmt}
                onDiscountAmtChange={setDiscountAmt}
                discountValue={discountValue}
                taxValue={taxValue}
                totalPrice={totalPrice}
              />
            </div>
          )}

          <InvoiceShippingStep
            carriers={data.carriers}
            zones={data.zones}
            shippingCarrierId={shippingCarrierId}
            onCarrierChange={setShippingCarrierId}
            shippingZoneId={shippingZoneId}
            onZoneChange={setShippingZoneId}
            shippingAddress={shippingAddress}
            onAddressChange={setShippingAddress}
            trackingNumber={trackingNumber}
            onTrackingChange={setTrackingNumber}
            customerAddress={customer?.address}
          />

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/30 p-5">
                <AnimatePresence mode="wait" initial={false}>
                  {isCashMode ? (
                    <motion.div
                      key="pay-cash"
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="space-y-4"
                    >
                      <CashPaymentPanel
                        totalPrice={totalPrice}
                        enableSplitPayment={enableSplitPayment}
                        onEnableSplitPaymentChange={setEnableSplitPayment}
                        splitCash={splitCash}
                        onSplitCashChange={setSplitCash}
                        splitElectronic={splitElectronic}
                        onSplitElectronicChange={setSplitElectronic}
                        splitMethod={splitMethod}
                        onSplitMethodChange={setSplitMethod}
                        splitRef={splitRef}
                        onSplitRefChange={setSplitRef}
                        splitTotal={splitTotal}
                        splitDiff={splitDiff}
                        cashPaid={cashPaid}
                        onCashPaidChange={setCashPaid}
                        cashPaidNum={cashPaidNum}
                        cashShort={cashShort}
                        change={change}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pay-inst"
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="space-y-4"
                    >
                      <InstallmentsPaymentPanel
                        totalPrice={totalPrice}
                        down={down}
                        onDownChange={setDown}
                        remaining={remaining}
                        count={count}
                        onCountChange={setCount}
                        monthly={monthly}
                        onMonthlyChange={setMonthly}
                        date={date}
                        onDateChange={setDate}
                        schedule={schedule}
                        totalDue={totalDue}
                        countNum={countNum}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ملاحظات */}
              <div className="rounded-[1.75rem] border border-border/30 p-5">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 block">
                  ملاحظات إضافية
                </Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات..."
                  maxLength={200}
                  className="bg-transparent border-white/10"
                />
              </div>

              {/* تتبع الربح (مخفي في وضع أمان الكاشير أو الخصوصية) */}
              <InvoiceProfitCard
                hideProfits={hideProfits}
                blurCls={blurCls}
                totalCost={totalCost}
                totalPrice={totalPrice}
                profit={profit}
                profitPct={profitPct}
              />
            </div>
          )}

          {/* تنقل الخطوات */}
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-6 font-bold"
              disabled={step === 4}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              الخطوة التالية
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              الخطوة السابقة
            </Button>
          </div>
        </div>

        {/* ===== العمود الجانبي ===== */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start lg:w-[380px] lg:shrink-0">
          <InvoiceSummarySidebar
            itemCount={products.filter((p) => p.name.trim()).length}
            subtotal={subtotal}
            discountValue={discountValue}
            taxPct={taxPct}
            taxValue={taxValue}
            totalPrice={totalPrice}
            downNum={downNum}
            remaining={remaining}
            isCashMode={isCashMode}
            blockReason={blockReason}
            parkedCount={parkedBills.length}
            onInstantPrint={() => submit(true, true)}
            onSave={() => submit(false, false)}
            onPark={handleParkCurrentBill}
            onOpenParked={() => setParkedModalOpen(true)}
          />
        </aside>
      </div>

      {/* شريط الإجراءات السفلي — للشاشات الصغيرة */}
      <InvoiceMobileActionBar
        step={step}
        blockReason={blockReason}
        totalPrice={totalPrice}
        onNext={() => (step < 4 ? setStep(step + 1) : submit(false))}
        onInstantPrint={() => submit(true, true)}
      />
      <div className="h-20 lg:hidden" />

      {/* باركود مودال */}
      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleScan}
        title="مسح باركود — إضافة منتج للفاتورة"
      />

      {/* الفواتير المعلقة */}
      <ParkedBillsModal
        open={parkedModalOpen}
        onOpenChange={setParkedModalOpen}
        onSelectBill={handleResumeParkedBill}
      />

      {/* موافقة المدير بالرقم السري للخصومات العالية */}
      <ManagerPinModal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        title="موافقة المدير على الخصم"
        description={`نسبة الخصم (${discountPct}%) تتجاوز الحد المسموح للكاشير (${shop.maxDiscountWithoutPin ?? 5}%). يرجى إدخال الرقم السري للمدير.`}
        onSuccess={() => {
          if (pendingSubmitAction) {
            pendingSubmitAction();
            setPendingSubmitAction(null);
          }
        }}
      />
    </>
  );
}
