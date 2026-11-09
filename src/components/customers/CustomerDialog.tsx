import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  db,
  type Customer,
  type CustomerStatus,
  type CustomerType,
  type CustomerSegment,
  type CustomerContactPreference,
  type CustomerPaymentPreference,
  useDB,
  useShopSettings,
} from "@/lib/store";
import { useStaffAndShifts } from "@/lib/staff";
import { ddmmyyyyToIso } from "@/lib/date-utils";
import { DatePickerField } from "@/components/DatePickerField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  User,
  Info,
  Star,
  Sparkles,
  CreditCard,
  Banknote,
  ChevronDown,
  Tags,
  MessageCircle,
  WalletCards,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { waLink } from "@/lib/whatsapp-templates";

const EG_PHONE_RE = /^01[0125]\d{8}$/;
const CUSTOMER_DRAFT_KEY = "segilly.customer.new.draft.v1";

const RATING_TIPS: Record<number, { text: string; cls: string }> = {
  5: {
    text: "★5: عميل موثوق — يمكن البيع بدون مقدم.",
    cls: "bg-success/15 text-success border-success/30",
  },
  4: { text: "★4: التزام جيد — شروط مرنة.", cls: "bg-success/10 text-success border-success/20" },
  3: {
    text: "★3: عادي — اتبع السياسة المعتادة.",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  2: { text: "★2: ضعيف — اطلب مقدم أعلى.", cls: "bg-warning/15 text-warning border-warning/30" },
  1: {
    text: "★1: خطر مرتفع — أوقف البيع الآجل.",
    cls: "bg-danger/15 text-danger border-danger/30",
  },
};

const STATUS_TABS: { value: CustomerStatus; label: string; dot: string; active: string }[] = [
  {
    value: "committed",
    label: "ملتزم",
    dot: "bg-success",
    active: "data-[state=active]:bg-success/15 data-[state=active]:text-success",
  },
  {
    value: "neutral",
    label: "عادي",
    dot: "bg-warning",
    active: "data-[state=active]:bg-warning/15 data-[state=active]:text-warning",
  },
  {
    value: "defaulter",
    label: "مماطل",
    dot: "bg-danger",
    active: "data-[state=active]:bg-danger/15 data-[state=active]:text-danger",
  },
];

export function CustomerDialog({
  customer,
  trigger,
  onCreated,
}: {
  customer?: Customer;
  trigger: React.ReactNode;
  onCreated?: (created: Customer) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [rating, setRating] = useState<number>(customer?.rating ?? 3);
  const [status, setStatus] = useState<CustomerStatus>(customer?.status ?? "neutral");
  const [customerType, setCustomerType] = useState<CustomerType>(
    customer?.customerType ?? "installment",
  );
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [frozen, setFrozen] = useState(customer?.frozen ?? false);
  const [address, setAddress] = useState(customer?.address ?? "");
  const [joiningDate, setJoiningDate] = useState(customer?.joiningDate ?? today);
  const [nationalId, setNationalId] = useState(customer?.nationalId ?? "");
  const [paperLedgerNumber, setPaperLedgerNumber] = useState(customer?.paperLedgerNumber ?? "");
  const [segment, setSegment] = useState<CustomerSegment>(customer?.segment ?? "regular");
  const [assignedStaffId, setAssignedStaffId] = useState(customer?.assignedStaffId ?? "none");
  const [preferredContact, setPreferredContact] = useState<CustomerContactPreference>(customer?.preferredContact ?? "whatsapp");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<CustomerPaymentPreference>(customer?.preferredPaymentMethod ?? "cash");
  const [debtAlertThreshold, setDebtAlertThreshold] = useState(String(customer?.debtAlertThreshold ?? 0));
  const [dueNotifications, setDueNotifications] = useState(customer?.dueNotifications ?? true);
  const [tagsText, setTagsText] = useState((customer?.tags ?? []).join(", "));
  const [sendWelcomeWhatsapp, setSendWelcomeWhatsapp] = useState(false);
  const [creditSectionOpen, setCreditSectionOpen] = useState(customer?.customerType !== "cash");
  const [creditLimit, setCreditLimit] = useState<string>(String(customer?.creditLimit ?? 0));
  const [openingBalance, setOpeningBalance] = useState<string>(
    String(customer?.openingBalance ?? 0),
  );
  const [dueDay, setDueDay] = useState<number>(customer?.dueDay ?? 1);
  const [pressed, setPressed] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(Boolean(customer));
  const [saving, setSaving] = useState(false);
  const { staffList } = useStaffAndShifts();
  const { customers } = useDB();
  const { settings: shop } = useShopSettings();
  const nextCustomerCode = customer?.customerCode ?? customers.reduce((max, item) => Math.max(max, item.customerCode ?? 0), 0) + 1;

  const phoneValid = EG_PHONE_RE.test(phone);
  const hasDraft = Boolean(
    name.trim() || phone.trim() || address.trim() || nationalId.trim() || notes.trim() || Number(creditLimit) > 0 || Number(openingBalance) > 0,
  );

  useEffect(() => {
    if (customer) return;
    try {
      const raw = sessionStorage.getItem(CUSTOMER_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        setName(draft.name ?? "");
        setPhone(draft.phone ?? "");
        setRating(draft.rating ?? 3);
        setStatus(draft.status ?? "neutral");
        setCustomerType(draft.customerType ?? "installment");
        setNotes(draft.notes ?? "");
        setFrozen(Boolean(draft.frozen));
        setAddress(draft.address ?? "");
        setJoiningDate(draft.joiningDate ?? ddmmyyyyToIso(draft.joiningDateInput) ?? today);
        setNationalId(draft.nationalId ?? "");
        setPaperLedgerNumber(draft.paperLedgerNumber ?? "");
        setSegment(draft.segment ?? "regular");
        setAssignedStaffId(draft.assignedStaffId ?? "none");
        setPreferredContact(draft.preferredContact ?? "whatsapp");
        setPreferredPaymentMethod(draft.preferredPaymentMethod ?? "cash");
        setDebtAlertThreshold(String(draft.debtAlertThreshold ?? 0));
        setDueNotifications(draft.dueNotifications ?? true);
        setTagsText(draft.tagsText ?? "");
        setCreditLimit(String(draft.creditLimit ?? 0));
        setOpeningBalance(String(draft.openingBalance ?? 0));
        setDueDay(draft.dueDay ?? 1);
      }
    } catch {
      sessionStorage.removeItem(CUSTOMER_DRAFT_KEY);
    } finally {
      setDraftHydrated(true);
    }
  }, [customer, today]);

  useEffect(() => {
    if (customer || !draftHydrated) return;
    if (!hasDraft) {
      sessionStorage.removeItem(CUSTOMER_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(CUSTOMER_DRAFT_KEY, JSON.stringify({
      name, phone, rating, status, customerType, notes, frozen, address, joiningDate, nationalId, paperLedgerNumber,
      segment, assignedStaffId, preferredContact, preferredPaymentMethod, debtAlertThreshold,
      dueNotifications, tagsText, creditLimit, openingBalance, dueDay,
    }));
  }, [customer, draftHydrated, hasDraft, name, phone, rating, status, customerType, notes, frozen, address, joiningDate, nationalId, paperLedgerNumber, segment, assignedStaffId, preferredContact, preferredPaymentMethod, debtAlertThreshold, dueNotifications, tagsText, creditLimit, openingBalance, dueDay]);
  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
    : "";

  const submit = async () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    if (!phoneValid)
      return toast.error("رقم الهاتف يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقم");
    if (!joiningDate) return toast.error("اختر تاريخ الانضمام");
    if (nationalId && nationalId.length !== 14) return toast.error("الرقم القومي يجب أن يتكون من 14 رقمًا");
    const numericCreditLimit = Number(creditLimit);
    const numericOpeningBalance = Number(openingBalance);
    const numericDebtAlertThreshold = Number(debtAlertThreshold);
    if (!Number.isFinite(numericCreditLimit) || numericCreditLimit < 0) return toast.error("سقف المديونية غير صحيح");
    if (!Number.isFinite(numericOpeningBalance) || numericOpeningBalance < 0) return toast.error("الرصيد الافتتاحي غير صحيح");
    if (!Number.isFinite(numericDebtAlertThreshold) || numericDebtAlertThreshold < 0) return toast.error("حد تنبيه المديونية غير صحيح");
    if (customerType === "installment" && numericCreditLimit > 0 && numericOpeningBalance > numericCreditLimit) return toast.error("الرصيد الافتتاحي أكبر من سقف المديونية");
    if (customerType === "installment" && numericCreditLimit > 0 && numericDebtAlertThreshold > numericCreditLimit) return toast.error("حد التنبيه أكبر من سقف المديونية");
    const payload = {
      name,
      phone,
      rating: rating as any,
      status,
      customerType,
      notes,
      frozen,
      address: address || null,
      joiningDate,
      nationalId: nationalId.trim() || undefined,
      paperLedgerNumber: customerType === "installment" ? paperLedgerNumber.trim() || undefined : undefined,
      segment,
      assignedStaffId: assignedStaffId === "none" ? null : assignedStaffId,
      preferredContact,
      preferredPaymentMethod,
      debtAlertThreshold: numericDebtAlertThreshold,
      dueNotifications,
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
      creditLimit: numericCreditLimit,
      dueDay,
      openingBalance: numericOpeningBalance,
    };
    setSaving(true);
    try {
      if (customer) {
        await db.updateCustomer(customer.id, payload);
        toast.success("تم التحديث");
      } else {
        const created = await db.addCustomer(payload);
        if (created) {
          await onCreated?.(created);
          if (sendWelcomeWhatsapp && phone) {
            const message = `مرحباً ${name.trim()} 👋\nتم تسجيل حسابك لدى ${shop.shopName || "متجرنا"}.\nيسعدنا خدمتك دائماً.`;
            window.open(waLink(phone, message), "_blank", "noopener,noreferrer");
          }
        }
        toast.success("تم إضافة العميل");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "CUSTOMER_PROFILE_MIGRATION_REQUIRED") {
        toast.error("قاعدة البيانات تحتاج تحديثًا قبل حفظ بيانات العميل", {
          description: "طبّق migration الخاصة بالعملاء على Supabase ثم أعد المحاولة.",
        });
      } else {
        toast.error("تعذر حفظ بيانات العميل. حاول مرة أخرى.");
      }
      return;
    } finally {
      setSaving(false);
    }
    if (!customer) sessionStorage.removeItem(CUSTOMER_DRAFT_KEY);
    setOpen(false);
  };

  const tip = RATING_TIPS[rating];

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && !customer && hasDraft && !window.confirm("لديك بيانات غير محفوظة. هل تريد الخروج؟")) return;
      setOpen(next);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[min(760px,calc(100dvh-1rem))] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden rounded-[2rem] border-none bg-card/95 p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="shrink-0 border-b border-[var(--hairline)] bg-card/95 px-5 py-5 sm:px-8 sm:py-6">
          <DialogTitle className="text-right">
            {customer ? "تعديل العميل" : "عميل جديد"}
          </DialogTitle>
          <DialogDescription className="text-right">
            أدخل تفاصيل العميل والتقييم الائتماني.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="space-y-5 p-5 text-xs sm:p-8">
          {/* Sequential customer code */}
          <div>
            <Label>كود العميل</Label>
            <Input
              value={nextCustomerCode}
              readOnly
              disabled
              dir="ltr"
              className="font-black tracking-widest text-primary opacity-100 disabled:cursor-default disabled:opacity-100"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">يتحدد تلقائيًا ولا يمكن تعديله.</p>
          </div>

          {/* Name + avatar */}
          <div>
            <Label>الاسم</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 hairline">
                <AvatarFallback className="bg-foreground/[0.06] text-muted-foreground font-bold ring-1 ring-border">
                  {initials || <User className="w-5 h-5" />}
                </AvatarFallback>
              </Avatar>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم العميل"
                maxLength={100}
                className="flex-1"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label>رقم الهاتف</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="01XXXXXXXXX"
              maxLength={11}
              dir="ltr"
              className={cn(phone && !phoneValid && "border-danger focus-visible:ring-danger")}
              inputMode="numeric"
            />
            {phone && !phoneValid && (
              <p className="text-xs text-danger mt-1">
                يجب أن يبدأ بـ 010 / 011 / 012 / 015 ويكون 11 رقم.
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <Label>عنوان العميل</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="الشارع، المدينة..."
              maxLength={300}
            />
          </div>

          {/* Customer type */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              نوع العميل
            </Label>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-foreground/[0.04] p-1.5">
              {[
                {
                  key: "installment" as const,
                  label: "أقساط",
                  hint: "بيع آجل بدفعات شهرية",
                  active: "bg-primary/15 text-primary ring-primary/30",
                  icon: CreditCard,
                },
                {
                  key: "cash" as const,
                  label: "فوري (نقدي)",
                  hint: "سداد كامل عند الشراء",
                  active: "bg-success/15 text-success ring-success/30",
                  icon: Banknote,
                },
              ].map((opt) => {
                const active = customerType === opt.key;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setCustomerType(opt.key);
                      setCreditSectionOpen(opt.key === "installment");
                      if (opt.key === "cash") {
                        setCreditLimit("");
                        setDueDay(1);
                      }
                    }}
                    aria-pressed={active}
                    className={cn(
                      "rounded-[1.1rem] px-4 py-3 text-center transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
                      active
                        ? cn(opt.active, "ring-1")
                        : "text-muted-foreground hover:bg-foreground/[0.04]",
                    )}
                  >
                    <span className="flex items-center justify-center gap-2 text-sm font-extrabold">
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] opacity-70">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Joining date */}
          <div>
            <Label>تاريخ الانضمام</Label>
            <DatePickerField
              value={joiningDate}
              onChange={setJoiningDate}
              placeholder="اختار تاريخ الانضمام"
              aria-label="تاريخ الانضمام"
              disabledDates={{ after: new Date() }}
            />
          </div>

          <Collapsible defaultOpen={false} className="rounded-2xl bg-foreground/[0.025] p-3 ring-1 ring-inset ring-border/40">
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-right">
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[state=open]:rotate-180" />
              <span className="flex items-center gap-2 font-bold">
                <Tags className="h-4 w-4 text-primary" />
                بيانات إضافية
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div>
                <Label>الرقم القومي (اختياري)</Label>
                <Input
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="14 رقمًا عند الحاجة"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={14}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>تصنيف العميل</Label>
                  <Select value={segment} onValueChange={(value) => setSegment(value as CustomerSegment)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">عادي</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="wholesale">جملة</SelectItem>
                      <SelectItem value="retail">تجزئة</SelectItem>
                      <SelectItem value="new">عميل جديد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>مندوب المبيعات</Label>
                  <Select value={assignedStaffId} onValueChange={setAssignedStaffId}>
                    <SelectTrigger><SelectValue placeholder="بدون مندوب" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مندوب</SelectItem>
                      {staffList.filter((staff) => staff.active).map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>وسيلة التواصل المفضلة</Label>
                  <Select value={preferredContact} onValueChange={(value) => setPreferredContact(value as CustomerContactPreference)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">واتساب</SelectItem>
                      <SelectItem value="phone">مكالمة هاتفية</SelectItem>
                      <SelectItem value="sms">رسالة SMS</SelectItem>
                      <SelectItem value="none">بدون تفضيل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>وسيلة الدفع المفضلة</Label>
                  <Select value={preferredPaymentMethod} onValueChange={(value) => setPreferredPaymentMethod(value as CustomerPaymentPreference)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقدي</SelectItem>
                      <SelectItem value="card">بطاقة</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>وسوم العميل</Label>
                <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="VIP، جملة، مهم" maxLength={200} />
                <p className="mt-1 text-[11px] text-muted-foreground">افصل بين الوسوم بفاصلة.</p>
              </div>

              <div>
                <Label>ملاحظات (اختياري)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." maxLength={300} />
              </div>

              {!customer && (
                <div className="flex items-center justify-between rounded-xl bg-success/[0.06] p-3">
                  <Switch checked={sendWelcomeWhatsapp} onCheckedChange={setSendWelcomeWhatsapp} disabled={!phoneValid} />
                  <div className="flex items-center gap-2 text-right">
                    <MessageCircle className="h-4 w-4 text-success" />
                    <div>
                      <div className="text-sm font-bold">إرسال رسالة ترحيب عبر واتساب</div>
                      <div className="text-[11px] text-muted-foreground">يتطلب رقم هاتف صحيحًا</div>
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Installment settings / Cash info */}
          {customerType === "installment" && (
          <Collapsible open={creditSectionOpen} onOpenChange={setCreditSectionOpen} className="rounded-2xl bg-foreground/[0.025] p-3 ring-1 ring-inset ring-border/40">
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-right">
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[state=open]:rotate-180" />
              <span className="flex items-center gap-2 font-bold">
                <WalletCards className="h-4 w-4 text-primary" />
                إعدادات ائتمانية
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
            <AnimatePresence mode="wait" initial={false}>
            {customerType === "installment" ? (
              <motion.div
                key="type-installment"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-3 border-t border-border/30 pt-4"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" /> إعدادات التقسيط
                </div>
                <div>
                  <Label>رقم العميل في الدفتر الورقي</Label>
                  <Input
                    value={paperLedgerNumber}
                    onChange={(e) => setPaperLedgerNumber(e.target.value.slice(0, 50))}
                    placeholder="يمكن تكراره لأكثر من عميل"
                    maxLength={50}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">رقم مرجعي يدوي، ولا يشترط أن يكون فريدًا.</p>
                </div>
                <div>
                  <Label>يوم القسط من الشهر</Label>
                  <Select value={String(dueDay)} onValueChange={(v) => setDueDay(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          يوم {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>سقف المديونية (ج.م)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0 = بدون حد"
                    dir="ltr"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="type-cash"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="flex items-start gap-2 border-t border-border/30 pt-4 text-[12px] leading-relaxed text-muted-foreground"
              >
                <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  عميل فوري: يدفع كامل المبلغ عند الشراء، فلا حاجة ليوم قسط أو سقف مديونية.
                </span>
              </motion.div>
            )}
            </AnimatePresence>

          {/* Opening balance */}
          <div>
            <Label className="flex items-center gap-1.5 justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="معلومات">
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    لتسجيل مديونية قديمة من الدفاتر الورقية بدون إنشاء فاتورة وهمية. يضاف فوراً إلى
                    إجمالي ديون العميل.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span>رصيد افتتاحي / مديونية سابقة (ج.م)</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="أدخل الرصيد"
              dir="ltr"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>حد تنبيه المديونية (ج.م)</Label>
              <Input
                type="number"
                min={0}
                value={debtAlertThreshold}
                onChange={(e) => setDebtAlertThreshold(e.target.value)}
                placeholder="0 = بدون تنبيه"
                dir="ltr"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-foreground/[0.04] px-3 py-2.5">
              <Switch checked={dueNotifications} onCheckedChange={setDueNotifications} />
              <div className="flex items-center gap-2 text-right">
                <BellRing className="h-4 w-4 text-warning" />
                <span className="text-sm font-bold">تنبيهات الاستحقاق</span>
              </div>
            </div>
          </div>
            </CollapsibleContent>
          </Collapsible>
          )}

          {/* Rating section (installment only) */}
          <AnimatePresence mode="wait" initial={false}>
            {customerType === "installment" && (
              <motion.div
                key="rating-section"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4 overflow-hidden origin-top"
              >
                {/* Status tabs */}
                <div>
                  <Label>حالة الالتزام</Label>
                  <Tabs
                    value={status}
                    onValueChange={(v) => {
                      const newStatus = v as CustomerStatus;
                      setStatus(newStatus);
                      if (newStatus === "committed") setRating(5);
                      else if (newStatus === "neutral") setRating(3);
                      else if (newStatus === "defaulter") setRating(1);
                    }}
                  >
                    <TabsList className="grid grid-cols-3 w-full">
                      {STATUS_TABS.map((t) => (
                        <TabsTrigger
                          key={t.value}
                          value={t.value}
                          className={cn("gap-1.5", t.active)}
                        >
                          <span className={cn("w-2 h-2 rounded-full", t.dot)} />
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* Star rating */}
                <div>
                  <Label>التقييم</Label>
                  <div className="flex items-center gap-1" dir="ltr">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className="p-1 hover:scale-110 transition-transform"
                        aria-label={`${n} stars`}
                      >
                        <Star
                          className={cn(
                            "w-6 h-6 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            n <= rating ? "fill-warning text-warning" : "text-muted-foreground/40",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <div
                    className={cn("mt-2 flex items-start gap-2 text-xs text-muted-foreground ps-1")}
                  >
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-right flex-1">{tip.text}</span>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Freeze */}
          <div className="border-t border-border/30 pt-4">
            <div className="flex items-center justify-between">
              <Switch checked={frozen} onCheckedChange={setFrozen} />
              <div className="text-right flex items-center gap-1.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="معلومات">
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      سيمنع هذا إنشاء أي فواتير جديدة لهذا العميل.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-sm font-medium">تجميد الحساب</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-right">
              سيمنع هذا إنشاء أي فواتير جديدة لهذا العميل.
            </p>
          </div>

          <div className="rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-inset ring-primary/20">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">ملخص العميل</div>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4">
              <span className="truncate">{name.trim() || "بدون اسم"}</span>
              <span className="text-muted-foreground">{customerType === "installment" ? "أقساط" : "فوري"}</span>
              <span className="text-muted-foreground">{customerType === "installment" ? `حد ${creditLimit || 0} ج.م` : "سداد كامل"}</span>
              <span className={cn(status === "defaulter" ? "text-danger" : status === "committed" ? "text-success" : "text-warning")}>{STATUS_TABS.find((item) => item.value === status)?.label}</span>
            </div>
          </div>
        </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-[var(--hairline)] bg-card/95 p-4 sm:p-6">
          <Button
            type="button"
            disabled={saving}
            onClick={submit}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            className={cn("w-full transition-transform duration-100", pressed && "scale-95")}
          >
            {saving ? "جارٍ الحفظ..." : customer ? "حفظ" : "إضافة العميل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
