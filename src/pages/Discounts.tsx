import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";
import { usePrivacy } from "@/lib/privacy";
import { useDB, fmt, useShopSettings } from "@/lib/store";
import {
  useDiscounts,
  type PromoCoupon,
  type QuantityTierOffer,
  type BundleComboOffer,
  type DiscountType,
  type CouponCustomerEligibility,
  getCouponStatus,
  generatePromoWhatsAppText,
} from "@/lib/discounts";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import { MetricCard } from "@/components/MetricCard";
import { StatTabs } from "@/components/StatTabs";
import { FilterChips } from "@/components/FilterChips";
import { CouponCard } from "@/components/discounts/CouponCard";
import { DiscountCouponDialog } from "@/components/discounts/DiscountCouponDialog";
import { DiscountQtyOfferDialog } from "@/components/discounts/DiscountQtyOfferDialog";
import { DiscountBundleOfferDialog } from "@/components/discounts/DiscountBundleOfferDialog";
import { DiscountWhatsAppShareDialog } from "@/components/discounts/DiscountWhatsAppShareDialog";
import { QtyOfferCard } from "@/components/discounts/QtyOfferCard";
import { BundleOfferCard } from "@/components/discounts/BundleOfferCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tag,
  Percent,
  Plus,
  Search,
  Check,
  Calculator,
  Layers,
  TrendingDown,
  Gift,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Coins,
  PackagePlus,
  Award,
} from "lucide-react";

type ActiveTab = "coupons" | "tiers" | "loyalty" | "guard";

export default function Discounts() {
  const { privacy } = usePrivacy();
  const { invoices, customers } = useDB();
  const { settings: shop } = useShopSettings();
  const {
    coupons,
    qtyOffers,
    bundles,
    loyaltyConfig,
    marginGuard,
    metrics,
    customerLoyaltyStats,
    addCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    addQtyOffer,
    updateQtyOffer,
    deleteQtyOffer,
    addBundle,
    updateBundle,
    deleteBundle,
    updateLoyaltyConfig,
    updateMarginGuard,
    generateCustomerLoyaltyVoucher,
    checkMarginSafety,
  } = useDiscounts();

  const [activeTab, setActiveTab] = useState<ActiveTab>("coupons");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "expired" | "inactive">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // WhatsApp Campaign Modal
  const [whatsappModalCoupon, setWhatsappModalCoupon] = useState<PromoCoupon | null>(null);

  // Coupon Dialog State
  const [isOpenCouponModal, setIsOpenCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<PromoCoupon | null>(null);
  const [deleteTargetCouponId, setDeleteTargetCouponId] = useState<string | null>(null);

  // Coupon Form State
  const [formCode, setFormCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<DiscountType>("percentage");
  const [formValue, setFormValue] = useState("10");
  const [formMinOrder, setFormMinOrder] = useState("0");
  const [formMaxUsage, setFormMaxUsage] = useState("");
  const [formHasMaxUsage, setFormHasMaxUsage] = useState(false);
  const [formStartsAt, setFormStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formCustomerEligibility, setFormCustomerEligibility] = useState<CouponCustomerEligibility>("all");
  const [formNotes, setFormNotes] = useState("");

  // Quantity Tier Offer Form State
  const [isOpenQtyModal, setIsOpenQtyModal] = useState(false);
  const [editingQtyOffer, setEditingQtyOffer] = useState<QuantityTierOffer | null>(null);
  const [deleteTargetQtyId, setDeleteTargetQtyId] = useState<string | null>(null);
  const [qtyTitle, setQtyTitle] = useState("");
  const [qtyMinCount, setQtyMinCount] = useState("3");
  const [qtyPct, setQtyPct] = useState("10");
  const [qtyNotes, setQtyNotes] = useState("");

  // Bundle Offer Form State
  const [isOpenBundleModal, setIsOpenBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleComboOffer | null>(null);
  const [deleteTargetBundleId, setDeleteTargetBundleId] = useState<string | null>(null);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleKeywords, setBundleKeywords] = useState("");
  const [bundleDiscount, setBundleDiscount] = useState("50");
  const [bundleNotes, setBundleNotes] = useState("");

  // Simulator State
  const [simPrice, setSimPrice] = useState("1000");
  const [simCost, setSimCost] = useState("700");
  const [simDiscType, setSimDiscType] = useState<DiscountType>("percentage");
  const [simDiscVal, setSimDiscVal] = useState("10");

  const blurCls = privacy ? "privacy-blur" : "privacy-clear";

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      const st = getCouponStatus(c).status;
      if (filterTab === "all") return true;
      if (filterTab === "active") return st === "active";
      if (filterTab === "expired") return st === "expired" || st === "exhausted";
      if (filterTab === "inactive") return st === "inactive";
      return true;
    });
  }, [coupons, search, filterTab]);

  // Simulator calculations
  const simResults = useMemo(() => {
    const p = Math.max(0, Number(simPrice || 0));
    const c = Math.max(0, Number(simCost || 0));
    const v = Math.max(0, Number(simDiscVal || 0));

    let discAmt = 0;
    if (simDiscType === "percentage") {
      discAmt = (p * Math.min(100, v)) / 100;
    } else {
      discAmt = Math.min(p, v);
    }

    const finalPrice = Math.max(0, p - discAmt);
    const profitBefore = p - c;
    const profitAfter = finalPrice - c;
    const marginPct = finalPrice > 0 ? (profitAfter / finalPrice) * 100 : 0;
    const safety = checkMarginSafety(p, c, discAmt);

    return {
      discAmt,
      finalPrice,
      profitBefore,
      profitAfter,
      marginPct,
      safety,
    };
  }, [simPrice, simCost, simDiscType, simDiscVal, checkMarginSafety]);

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`تم نسخ الكود: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenNewCoupon = () => {
    setEditingCoupon(null);
    setFormCode("");
    setFormTitle("");
    setFormType("percentage");
    setFormValue("10");
    setFormMinOrder("0");
    setFormMaxUsage("");
    setFormHasMaxUsage(false);
    setFormStartsAt(new Date().toISOString().slice(0, 10));
    setFormEndsAt("");
    setFormCustomerEligibility("all");
    setFormNotes("");
    setIsOpenCouponModal(true);
  };

  const handleEditCoupon = (c: PromoCoupon) => {
    setEditingCoupon(c);
    setFormCode(c.code);
    setFormTitle(c.title);
    setFormType(c.discountType);
    setFormValue(String(c.discountValue));
    setFormMinOrder(String(c.minOrderValue));
    setFormMaxUsage(c.maxUsage !== null ? String(c.maxUsage) : "");
    setFormHasMaxUsage(c.maxUsage !== null);
    setFormStartsAt(c.startsAt ? c.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormEndsAt(c.endsAt ? c.endsAt.slice(0, 10) : "");
    setFormCustomerEligibility(c.customerEligibility || "all");
    setFormNotes(c.notes || "");
    setIsOpenCouponModal(true);
  };

  const handleSaveCoupon = () => {
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) return toast.error("يرجى إدخال كود الخصم (مثلاً SALE10)");
    if (!formTitle.trim()) return toast.error("يرجى إدخال عنوان أو وصف الكوبون");

    const val = Number(formValue);
    if (isNaN(val) || val <= 0) return toast.error("يرجى إدخال قيمة خصم صالحة");
    if (formType === "percentage" && val > 100) return toast.error("نسبة الخصم لا يمكن أن تتجاوز 100%");

    // Check duplicate code
    const duplicate = coupons.find(
      (c) => c.code.toUpperCase() === cleanCode && (!editingCoupon || c.id !== editingCoupon.id)
    );
    if (duplicate) return toast.error("كود الخصم هذا مستخدم بالفعل، يرجى اختيار كود آخر");

    const maxUsageNum = formHasMaxUsage && formMaxUsage ? Math.max(1, parseInt(formMaxUsage, 10)) : null;

    if (editingCoupon) {
      updateCoupon(editingCoupon.id, {
        code: cleanCode,
        title: formTitle.trim(),
        discountType: formType,
        discountValue: val,
        minOrderValue: Math.max(0, Number(formMinOrder || 0)),
        maxUsage: maxUsageNum,
        startsAt: new Date(formStartsAt).toISOString(),
        endsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
        customerEligibility: formCustomerEligibility,
        notes: formNotes.trim() || undefined,
      });
      toast.success("تم تحديث الكوبون بنجاح");
    } else {
      addCoupon({
        code: cleanCode,
        title: formTitle.trim(),
        discountType: formType,
        discountValue: val,
        minOrderValue: Math.max(0, Number(formMinOrder || 0)),
        maxUsage: maxUsageNum,
        startsAt: new Date(formStartsAt).toISOString(),
        endsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
        active: true,
        customerEligibility: formCustomerEligibility,
        notes: formNotes.trim() || undefined,
      });
      toast.success("تم إنشاء كود الخصم بنجاح ✓");
    }

    setIsOpenCouponModal(false);
  };

  // Quantity Offer Handlers
  const handleOpenNewQtyOffer = () => {
    setEditingQtyOffer(null);
    setQtyTitle("");
    setQtyMinCount("3");
    setQtyPct("10");
    setQtyNotes("");
    setIsOpenQtyModal(true);
  };

  const handleEditQtyOffer = (o: QuantityTierOffer) => {
    setEditingQtyOffer(o);
    setQtyTitle(o.title);
    setQtyMinCount(String(o.minQuantity));
    setQtyPct(String(o.discountPercentage));
    setQtyNotes(o.notes || "");
    setIsOpenQtyModal(true);
  };

  const handleSaveQtyOffer = () => {
    if (!qtyTitle.trim()) return toast.error("يرجى كتابة عنوان العرض");
    const count = Number(qtyMinCount);
    const pct = Number(qtyPct);
    if (isNaN(count) || count <= 1) return toast.error("أقل كمية يجب أن تكون قطعتين أو أكثر");
    if (isNaN(pct) || pct <= 0 || pct > 100) return toast.error("نسبة الخصم يجب أن تكون بين 1% و 100%");

    if (editingQtyOffer) {
      updateQtyOffer(editingQtyOffer.id, {
        title: qtyTitle.trim(),
        minQuantity: count,
        discountPercentage: pct,
        notes: qtyNotes.trim() || undefined,
      });
      toast.success("تم تعديل عرض الكميات بنجاح");
    } else {
      addQtyOffer({
        title: qtyTitle.trim(),
        minQuantity: count,
        discountPercentage: pct,
        active: true,
        notes: qtyNotes.trim() || undefined,
      });
      toast.success("تمت إضافة عرض الكميات بنجاح ✓");
    }
    setIsOpenQtyModal(false);
  };

  // Bundle Offer Handlers
  const handleOpenNewBundle = () => {
    setEditingBundle(null);
    setBundleTitle("");
    setBundleKeywords("");
    setBundleDiscount("50");
    setBundleNotes("");
    setIsOpenBundleModal(true);
  };

  const handleEditBundle = (b: BundleComboOffer) => {
    setEditingBundle(b);
    setBundleTitle(b.title);
    setBundleKeywords(b.itemKeywords.join("، "));
    setBundleDiscount(String(b.discountAmount));
    setBundleNotes(b.notes || "");
    setIsOpenBundleModal(true);
  };

  const handleSaveBundle = () => {
    if (!bundleTitle.trim()) return toast.error("يرجى كتابة اسم الباقة");
    const kwList = bundleKeywords
      .split(/[,،]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (kwList.length < 2) return toast.error("يرجى كتابة كلمتين رئيسيتين أو صنفين على الأقل مفصولين بفاصلة");
    const disc = Number(bundleDiscount);
    if (isNaN(disc) || disc <= 0) return toast.error("يرجى تحديد مبلغ الخصم للباقة");

    if (editingBundle) {
      updateBundle(editingBundle.id, {
        title: bundleTitle.trim(),
        itemKeywords: kwList,
        discountAmount: disc,
        notes: bundleNotes.trim() || undefined,
      });
      toast.success("تم تحديث باقة العرض بنجاح");
    } else {
      addBundle({
        title: bundleTitle.trim(),
        itemKeywords: kwList,
        discountAmount: disc,
        active: true,
        notes: bundleNotes.trim() || undefined,
      });
      toast.success("تمت إضافة باقة العرض بنجاح ✓");
    }
    setIsOpenBundleModal(false);
  };

  // WhatsApp Share Trigger
  const handleExecuteWhatsAppSend = (coupon: PromoCoupon) => {
    executeWhatsAppSend(coupon);
    setWhatsappModalCoupon(null);
  };
  const handleOpenWhatsAppShare = (c: PromoCoupon) => {
    setWhatsappModalCoupon(c);
  };

  const executeWhatsAppSend = (coupon: PromoCoupon, phone = "") => {
    const text = generatePromoWhatsAppText(coupon, shop.shopName || "سِجلّي");
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6 pb-12">
          {/* Header */}
          <PageHeader
            title="الخصومات والعروض الترويجية"
            subtitle="إدارة الكوبونات، عروض الكميات والباقات، نقاط الولاء، وحماية هامش الربحية"
            eyebrow="مُحرك المبيعات"
            action={
              <div className="flex items-center gap-2">
                {activeTab === "coupons" && (
                  <ActionButton
                    onClick={handleOpenNewCoupon}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    كوبون جديد
                  </ActionButton>
                )}
                {activeTab === "tiers" && (
                  <div className="flex items-center gap-1.5">
                    <ActionButton
                      tone="surface"
                      onClick={handleOpenNewQtyOffer}
                      icon={<Plus className="h-3.5 w-3.5" />}
                    >
                      عرض كميات
                    </ActionButton>
                    <ActionButton
                      onClick={handleOpenNewBundle}
                      icon={<Plus className="h-3.5 w-3.5" />}
                    >
                      باقة مجمعة
                    </ActionButton>
                  </div>
                )}
              </div>
            }
          />

          {/* Top KPI Cards */}
          <Reveal>
            <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard
                className="h-full"
                icon={TrendingDown}
                label="إجمالي الخصومات الممنوحة"
                value={metrics.totalDiscountsGiven}
                format={(n) => `${fmt(n)} ج.م`}
                tone="danger"
                masked={privacy}
                sub={`${metrics.invoicesWithDiscountCount} فاتورة تضمنت خصماً`}
              />

              <MetricCard
                className="h-full"
                icon={Tag}
                label="الكوبونات والعروض النشطة"
                value={metrics.activeCouponsCount}
                format={(n) => `${Math.round(n)} / ${metrics.totalCouponsCount}`}
                tone="positive"
                sub={`${qtyOffers.filter((o) => o.active).length} عروض كميات + ${bundles.filter((b) => b.active).length} باقات`}
              />

              <MetricCard
                className="h-full"
                icon={Gift}
                label="مرات استخدام الكوبونات"
                value={metrics.totalCouponRedemptions}
                format={(n) => `${Math.round(n)} مرة`}
                tone="neutral"
                sub="إجمالي عمليات الاستفادة"
              />

              <MetricCard
                className="h-full"
                icon={Percent}
                label="معدل الخصم من المبيعات"
                value={metrics.discountRate}
                format={(n) => `${n.toFixed(1)}%`}
                tone="neutral"
                masked={privacy}
                sub={`متوسط ${fmt(metrics.avgDiscountPerInvoice)} ج.م / فاتورة`}
              />
            </div>
          </Reveal>

          {/* Navigation Tabs */}
          <StatTabs
            value={activeTab}
            onChange={(v) => setActiveTab(v as ActiveTab)}
            options={[
              { value: "coupons", label: "أكواد وقسائم الخصم", count: coupons.length, icon: <Tag className="w-3.5 h-3.5" /> },
              { value: "tiers", label: "عروض الكميات والباقات", count: qtyOffers.length + bundles.length, icon: <PackagePlus className="w-3.5 h-3.5" /> },
              { value: "loyalty", label: "نقاط الولاء والمكافآت", icon: <Coins className="w-3.5 h-3.5" /> },
              { value: "guard", label: "حماية الأرباح والمحاكي", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            ]}
          />

          {/* TAB 1: COUPONS & WHATSAPP PROMO CAMPAIGNS */}
          {activeTab === "coupons" && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-2xl border border-border/40">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث بكود الخصم، اسم العرض، أو الملاحظات..."
                    className="pr-10 h-10 rounded-xl border-border/40 bg-background/50 text-xs"
                  />
                </div>

                <FilterChips
                  value={filterTab}
                  onChange={(v) => setFilterTab(v as typeof filterTab)}
                  options={[
                    { value: "all", label: "الكل" },
                    { value: "active", label: "النشطة" },
                    { value: "expired", label: "المنتهية/المستنفدة" },
                    { value: "inactive", label: "المعطلة" },
                  ]}
                />
              </div>

              {/* Coupons Grid */}
              {filteredCoupons.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
                  <Tag className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-sm text-foreground">لا توجد كوبونات تطابق بحثك</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    يمكنك إنشاء كوبون خصم جديد بنسبة مئوية أو مبلغ ثابت ومشاركته مع عملائك.
                  </p>
                  <Button onClick={handleOpenNewCoupon} size="sm" className="mt-4 gap-1.5 rounded-xl text-xs font-bold">
                    <Plus className="w-4 h-4" />
                    إنشاء أول كوبون
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCoupons.map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      copiedCode={copiedCode}
                      onCopy={copyCouponCode}
                      onWhatsAppShare={handleOpenWhatsAppShare}
                      onToggleStatus={toggleCouponStatus}
                      onEdit={handleEditCoupon}
                      onDelete={setDeleteTargetCouponId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUANTITY TIERS & BUNDLE DEALS */}
          {activeTab === "tiers" && (
            <div className="space-y-6">
              {/* Section 1: Quantity Tier Offers */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      عروض خصم الكميات التلقائي (Quantity Tiers)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      يتم تطبيق الخصم تلقائياً عند زيادة كمية الصنف في الفاتورة عن الحد المحدد.
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenNewQtyOffer}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة عرض كمية
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {qtyOffers.map((offer) => (
                    <QtyOfferCard
                      key={offer.id}
                      offer={offer}
                      onEdit={handleEditQtyOffer}
                      onDelete={setDeleteTargetQtyId}
                    />
                  ))}
                </div>
              </div>

              {/* Section 2: Bundle Deals */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <PackagePlus className="w-4 h-4 text-primary" />
                      عروض باقات الأصناف المجمعة (Bundle Combos)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      خصم تلقائي عند شراء أصناف معينة معاً في نفس الفاتورة (مثال: شراء هاتف + جراب).
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenNewBundle}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة باقة مجمعة
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {bundles.map((bundle) => (
                    <BundleOfferCard
                      key={bundle.id}
                      bundle={bundle}
                      onEdit={handleEditBundle}
                      onDelete={setDeleteTargetBundleId}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOYALTY POINTS & REWARDS */}
          {activeTab === "loyalty" && (
            <div className="space-y-6">
              {/* Program Configuration Card */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Coins className="w-4 h-4 text-warning" />
                      إعدادات برنامج نقاط الولاء والمكافآت (Cashback & Loyalty)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      احتساب نقاط ولاء تلقائياً مع كل عملية شراء مسددة للعميل وتحويلها لكوبونات خصم حصرية.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold">تفعيل البرنامج:</Label>
                    <Switch
                      checked={loyaltyConfig.enabled}
                      onCheckedChange={(c) => updateLoyaltyConfig({ enabled: c })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 py-1">
                    <Label className="text-xs text-muted-foreground">معدل احتساب النقاط</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={loyaltyConfig.pointsPer100Egp}
                        onChange={(e) => updateLoyaltyConfig({ pointsPer100Egp: Math.max(1, Number(e.target.value)) })}
                        className="h-10 font-mono text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                        نقطة / 100 ج.م
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 py-1">
                    <Label className="text-xs text-muted-foreground">قيمة النقطة الواحدة عند الاستبدال</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={loyaltyConfig.pointValueEgp}
                        onChange={(e) => updateLoyaltyConfig({ pointValueEgp: Math.max(0.1, Number(e.target.value)) })}
                        className="h-10 font-mono text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                        ج.م لكل نقطة
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 py-1">
                    <Label className="text-xs text-muted-foreground">الحد الأدنى للنقاط للاستبدال</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="5"
                        value={loyaltyConfig.minPointsToRedeem}
                        onChange={(e) => updateLoyaltyConfig({ minPointsToRedeem: Math.max(5, Number(e.target.value)) })}
                        className="h-10 font-mono text-center"
                      />
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                        نقطة كحد أدنى
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customers Loyalty Leaderboard Table */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-warning" />
                      أرصدة نقاط الولاء للعملاء
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      يمكنك استبدال نقاط العميل وتوليد كود خصم مخصص له بضغطة زر.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="pb-2 font-bold">العميل</th>
                        <th className="pb-2 font-bold">إجمالي المشتريات</th>
                        <th className="pb-2 font-bold">النقاط المكتسبة</th>
                        <th className="pb-2 font-bold">النقاط المتاحة</th>
                        <th className="pb-2 font-bold">القيمة المالية للاستبدال</th>
                        <th className="pb-2 font-bold text-left">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {customerLoyaltyStats.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            لا توجد بيانات عملاء أو مشتريات حتى الآن
                          </td>
                        </tr>
                      ) : (
                        customerLoyaltyStats.slice(0, 15).map((stat) => (
                          <tr key={stat.customer.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 font-bold text-foreground">
                              {stat.customer.name}
                              <span className="block text-[11px] font-normal text-muted-foreground">{stat.customer.phone}</span>
                            </td>
                            <td className={cn("py-3 font-mono font-medium", blurCls)}>
                              {fmt(stat.totalSpent)} ج.م
                            </td>
                            <td className="py-3 font-mono font-bold text-muted-foreground">
                              {stat.earnedPoints} نقطة
                            </td>
                            <td className="py-3 font-mono font-bold text-warning">
                              {stat.availablePoints} نقطة
                            </td>
                            <td className={cn("py-3 font-mono font-bold text-success", blurCls)}>
                              {fmt(stat.redeemableValueEgp)} ج.م
                            </td>
                            <td className="py-3 text-left">
                              <Button
                                size="sm"
                                disabled={!stat.canRedeem}
                                onClick={() => {
                                  const cpn = generateCustomerLoyaltyVoucher(stat.customer, stat.availablePoints);
                                  toast.success(`تم توليد كوبون مكافأة ولاء (${cpn.code}) بقيمة ${cpn.discountValue} ج.م!`);
                                }}
                                className="h-10 px-3 rounded-lg text-[11px] font-bold gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90 disabled:opacity-40"
                              >
                                <Gift className="w-3 h-3" />
                                تحويل لكوبون
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MARGIN GUARD & PROFIT SIMULATOR */}
          {activeTab === "guard" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Margin Guard Settings Card */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      حماية حد الربحية التلقائي (Minimum Margin Lock)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      تنبيه وتحذير البائع في شاشة الفاتورة إذا كان الخصم سيهبط بصافي الربح عن الحد الأدنى.
                    </p>
                  </div>
                  <Switch
                    checked={marginGuard.enabled}
                    onCheckedChange={(c) => updateMarginGuard({ enabled: c })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="py-1 space-y-2">
                    <Label className="text-xs font-bold text-foreground">
                      الحد الأدنى لنسبة هامش الربح المحمي (%)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={marginGuard.minMarginPct}
                        onChange={(e) =>
                          updateMarginGuard({ minMarginPct: Math.max(1, Math.min(90, Number(e.target.value))) })
                        }
                        className="h-10 font-mono text-base font-bold text-center w-28"
                      />
                      <span className="text-xs text-muted-foreground">
                        لن يُسمح بأي خصم يجعل هامش ربح الفاتورة أقل من {marginGuard.minMarginPct}%
                      </span>
                    </div>
                  </div>

                  <div className="py-1 text-xs leading-relaxed text-muted-foreground">
                    <div className="font-bold text-foreground mb-1 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" /> كيف تعمل هذه الميزة؟
                    </div>
                    عند كتابة كود خصم أو خصم يدوي أثناء إنشاء الفاتورة، يقوم النظام بحساب مجموع تكلفة الأصناف ومقارنتها بالسعر بعد الخصم. إذا نزل هامش الربح عن {marginGuard.minMarginPct}%، يتم إظهار تنبيه فوري يوضح أقصى خصم آمن مسموح به لمنع تآكل الأرباح.
                  </div>
                </div>
              </div>

              {/* Live Interactive Simulator */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
                <div className="border-b border-border/30 pb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    محاكي الأرباح وتأثير الخصم (Live Simulator)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختبر أي خصم وتأكد من تأثيره المالي ومطابقته لحد الأمان.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">سعر البيع (ج.م)</Label>
                    <Input
                      type="number"
                      value={simPrice}
                      onChange={(e) => setSimPrice(e.target.value)}
                      className="h-10 font-mono text-center text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">التكلفة (ج.م)</Label>
                    <Input
                      type="number"
                      value={simCost}
                      onChange={(e) => setSimCost(e.target.value)}
                      className="h-10 font-mono text-center text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">نوع الخصم</Label>
                    <Select value={simDiscType} onValueChange={(v: any) => setSimDiscType(v)}>
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                        <SelectItem value="fixed">مبلغ ثابت (ج.م)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">قيمة الخصم</Label>
                    <Input
                      type="number"
                      value={simDiscVal}
                      onChange={(e) => setSimDiscVal(e.target.value)}
                      className="h-10 font-mono text-center text-xs"
                    />
                  </div>
                </div>

                {/* Results Panel */}
                <div className="py-1 space-y-2 text-xs divide-y divide-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">مبلغ الخصم:</span>
                    <span className="font-mono font-bold text-warning">− {fmt(simResults.discAmt)} ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">السعر النهائي بعد الخصم:</span>
                    <span className="font-mono font-bold text-foreground">{fmt(simResults.finalPrice)} ج.م</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/20 pt-2">
                    <span className="text-muted-foreground">صافي الربح بعد الخصم:</span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        simResults.profitAfter > 0 ? "text-success" : "text-danger"
                      )}
                    >
                      {fmt(simResults.profitAfter)} ج.م ({simResults.marginPct.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Margin safety status banner */}
                  <div
                    className={cn(
                      "mt-2 p-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5",
                      simResults.safety.isSafe
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-danger/10 text-danger border border-danger/20"
                    )}
                  >
                    {simResults.safety.isSafe ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        خصم آمن ومطابق لنسبة الربح المحمية ({marginGuard.minMarginPct}%)
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {simResults.safety.warning}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DIALOG 1: CREATE / EDIT COUPON */}
        <DiscountCouponDialog
          open={isOpenCouponModal}
          onOpenChange={setIsOpenCouponModal}
          editing={!!editingCoupon}
          formCode={formCode}
          onFormCodeChange={setFormCode}
          formTitle={formTitle}
          onFormTitleChange={setFormTitle}
          formType={formType}
          onFormTypeChange={setFormType}
          formValue={formValue}
          onFormValueChange={setFormValue}
          formMinOrder={formMinOrder}
          onFormMinOrderChange={setFormMinOrder}
          formCustomerEligibility={formCustomerEligibility}
          onFormCustomerEligibilityChange={setFormCustomerEligibility}
          formHasMaxUsage={formHasMaxUsage}
          onFormHasMaxUsageChange={setFormHasMaxUsage}
          formMaxUsage={formMaxUsage}
          onFormMaxUsageChange={setFormMaxUsage}
          formStartsAt={formStartsAt}
          onFormStartsAtChange={setFormStartsAt}
          formEndsAt={formEndsAt}
          onFormEndsAtChange={setFormEndsAt}
          formNotes={formNotes}
          onFormNotesChange={setFormNotes}
          onSave={handleSaveCoupon}
        />

        {/* DIALOG 2: QUANTITY TIER OFFER */}
        <DiscountQtyOfferDialog
          open={isOpenQtyModal}
          onOpenChange={setIsOpenQtyModal}
          editing={!!editingQtyOffer}
          title={qtyTitle}
          onTitleChange={setQtyTitle}
          minCount={qtyMinCount}
          onMinCountChange={setQtyMinCount}
          pct={qtyPct}
          onPctChange={setQtyPct}
          notes={qtyNotes}
          onNotesChange={setQtyNotes}
          onSave={handleSaveQtyOffer}
        />

        {/* DIALOG 3: BUNDLE OFFER */}
        <DiscountBundleOfferDialog
          open={isOpenBundleModal}
          onOpenChange={setIsOpenBundleModal}
          editing={!!editingBundle}
          title={bundleTitle}
          onTitleChange={setBundleTitle}
          keywords={bundleKeywords}
          onKeywordsChange={setBundleKeywords}
          discount={bundleDiscount}
          onDiscountChange={setBundleDiscount}
          notes={bundleNotes}
          onNotesChange={setBundleNotes}
          onSave={handleSaveBundle}
        />

        {/* DIALOG 4: WHATSAPP PROMO CAMPAIGN MODAL */}
        <DiscountWhatsAppShareDialog
          open={!!whatsappModalCoupon}
          onClose={() => setWhatsappModalCoupon(null)}
          coupon={whatsappModalCoupon}
          shopName={shop.shopName || "سِجلّي"}
          onExecuteSend={handleExecuteWhatsAppSend}
        />

        {/* DELETE CONFIRMATIONS */}
        <AlertDialog open={!!deleteTargetCouponId} onOpenChange={(open) => !open && setDeleteTargetCouponId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد من حذف كود الخصم؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف هذا الكوبون نهائياً ولن يتمكن العملاء من استخدامه في الفواتير القادمة.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetCouponId) {
                    deleteCoupon(deleteTargetCouponId);
                    toast.success("تم حذف الكوبون");
                    setDeleteTargetCouponId(null);
                  }
                }}
                className="bg-danger text-danger-foreground hover:bg-danger/90"
              >
                تأكيد الحذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTargetQtyId} onOpenChange={(open) => !open && setDeleteTargetQtyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف عرض الكميات؟</AlertDialogTitle>
              <AlertDialogDescription>
                لن يتم تطبيق خصم هذه الكمية تلقائياً على الفواتير بعد الحذف.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetQtyId) {
                    deleteQtyOffer(deleteTargetQtyId);
                    toast.success("تم حذف عرض الكميات");
                    setDeleteTargetQtyId(null);
                  }
                }}
                className="bg-danger text-danger-foreground"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTargetBundleId} onOpenChange={(open) => !open && setDeleteTargetBundleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف باقة العرض المجمعة؟</AlertDialogTitle>
              <AlertDialogDescription>
                لن يتم احتساب خصم الباقة تلقائياً عند شراء الأصناف معاً.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetBundleId) {
                    deleteBundle(deleteTargetBundleId);
                    toast.success("تم حذف الباقة");
                    setDeleteTargetBundleId(null);
                  }
                }}
                className="bg-danger text-danger-foreground"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageTransition>
    </AppShell>
  );
}
