import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, type Customer, type CustomerStatus, type CustomerType } from "@/lib/store";
import { isoToDDMMYYYY, ddmmyyyyToIso } from "@/lib/date-utils";
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
import {
  User,
  Info,
  Star,
  Sparkles,
  CreditCard,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EG_PHONE_RE = /^01[0125]\d{8}$/;

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

export function CustomerDialog({ customer, trigger }: { customer?: Customer; trigger: React.ReactNode }) {
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
  const [creditLimit, setCreditLimit] = useState<string>(String(customer?.creditLimit ?? 0));
  const [openingBalance, setOpeningBalance] = useState<string>(
    String(customer?.openingBalance ?? 0),
  );
  const [dueDay, setDueDay] = useState<number>(customer?.dueDay ?? 1);
  const [joiningDateInput, setJoiningDateInput] = useState<string>(
    isoToDDMMYYYY(customer?.joiningDate ?? today),
  );
  const [pressed, setPressed] = useState(false);

  const phoneValid = EG_PHONE_RE.test(phone);
  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
    : "";

  const submit = () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    if (!phoneValid)
      return toast.error("رقم الهاتف يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقم");
    const iso = ddmmyyyyToIso(joiningDateInput);
    if (!iso) return toast.error("تاريخ الانضمام غير صحيح. الصيغة: يوم/شهر/سنة");
    const payload = {
      name,
      phone,
      rating: rating as any,
      status,
      customerType,
      notes,
      frozen,
      address: address || null,
      joiningDate: iso,
      creditLimit: Number(creditLimit) || 0,
      dueDay,
      openingBalance: Number(openingBalance) || 0,
    };
    if (customer) {
      db.updateCustomer(customer.id, payload);
      toast.success("تم التحديث");
    } else {
      db.addCustomer(payload);
      toast.success("تم إضافة العميل");
    }
    setOpen(false);
  };

  const tip = RATING_TIPS[rating];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">
            {customer ? "تعديل العميل" : "عميل جديد"}
          </DialogTitle>
          <DialogDescription className="text-right">
            أدخل تفاصيل العميل والتقييم الائتماني.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-foreground/[0.04] p-1.5">
              {[
                { key: "installment" as const, label: "أقساط", hint: "بيع آجل بدفعات شهرية" },
                { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل عند الشراء" },
              ].map((opt) => {
                const active = customerType === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setCustomerType(opt.key);
                      if (opt.key === "cash") {
                        setCreditLimit("0");
                        setDueDay(1);
                      }
                    }}
                    aria-pressed={active}
                    className={cn(
                      "rounded-[1.1rem] px-4 py-3 text-center transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
                      active
                        ? "bg-foreground text-background ring-1 ring-border"
                        : "text-muted-foreground hover:bg-foreground/[0.04]",
                    )}
                  >
                    <span className="block text-sm font-extrabold">{opt.label}</span>
                    <span className="mt-0.5 block text-[11px] opacity-70">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Joining date */}
          <div>
            <Label>تاريخ الانضمام</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={joiningDateInput}
              onChange={(e) => {
                let v = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
                const digits = v.replace(/\//g, "");
                if (digits.length >= 5)
                  v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                else if (digits.length >= 3) v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                else v = digits;
                setJoiningDateInput(v);
              }}
              placeholder="يوم/شهر/سنة"
              dir="ltr"
              maxLength={10}
            />
          </div>

          {/* Installment settings / Cash info */}
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
              placeholder="0"
              dir="ltr"
            />
          </div>

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

                {/* Notes */}
                <div>
                  <Label>ملاحظات (اختياري)</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي ملاحظات إضافية..."
                    maxLength={300}
                  />
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
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            className={cn("w-full transition-transform duration-100", pressed && "scale-95")}
          >
            {customer ? "حفظ" : "إضافة العميل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
