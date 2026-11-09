import { PageTransition } from "@/components/PageTransition";
import { Reveal } from "@/components/Reveal";
import { BezelCard } from "@/components/BezelCard";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useDB, db, fmt } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { PageLoadingSkeleton } from "@/components/LoadingScreen";
import { Plus, History, TrendingUp, X, Check, Trash2, Receipt, Package, Undo2, Search, Eye, EyeOff } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { ActionButton } from "@/components/ActionButton";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <ReturnsPage />
      </PageTransition>
    </AppShell>
  );
}

function ReturnsPage() {
  const data = useDB();
  const { privacy, toggle } = usePrivacy();
  const blurCls = privacy ? "privacy-blur" : "privacy-clear";
  
  const [returnType, setReturnType] = useState<"sale" | "supplier">("sale");
  const [sourceId, setSourceId] = useState("");
  const [reason, setReason] = useState("");
  const [newItemId, setNewItemId] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [items, setItems] = useState<Array<{ id: string; name: string; unitPrice: number; quantity: number; maxQuantity: number }>>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (data.loading) return <PageLoadingSkeleton type="table" />;

  const selectedSource = returnType === "sale"
    ? data.invoices.find((invoice) => invoice.id === sourceId)
    : data.purchases.find((purchase) => purchase.id === sourceId);
  const sourceItems = returnType === "sale"
    ? data.invoiceItems.filter((item) => item.invoiceId === sourceId)
    : data.purchaseItems.filter((item) => item.purchaseId === sourceId);

  const availableItems = useMemo(() => sourceItems.map((sourceItem: any) => {
    const alreadyReturned = data.returnItems
      .filter((item: any) => item.name === sourceItem.name)
      .filter((item: any) => data.returns.some((record: any) => record.id === item.returnId && record.type === returnType && (returnType === "sale" ? record.invoiceId === sourceId : record.purchaseId === sourceId)))
      .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const originalQuantity = Number(sourceItem.quantity || 0);
    return {
      id: sourceItem.id,
      name: sourceItem.name,
      unitPrice: Number(returnType === "sale" ? sourceItem.price : sourceItem.unitCost || 0),
      maxQuantity: Math.max(0, originalQuantity - alreadyReturned),
    };
  }).filter((item) => item.maxQuantity > 0), [data.invoiceItems, data.purchaseItems, data.returnItems, data.returns, returnType, sourceId, sourceItems]);

  const total = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const handleAddReturn = async () => {
    if (!sourceId || !reason.trim() || items.length === 0) {
      toast.error("اختر المستند وأضف السبب والصنف المرتجع أولاً");
      return;
    }
    await db.addReturn({
      invoiceId: returnType === "sale" ? sourceId : null,
      purchaseId: returnType === "supplier" ? sourceId : null,
      type: returnType,
      totalAmount: total,
      reason,
      notes: null,
      items
    });
    setSourceId("");
    setReason("");
    setItems([]);
    setNewItemId("");
    setNewQuantity(1);
    setIsDialogOpen(false);
    toast.success("تم تسجيل المرتجع بنجاح");
  };

  const addItem = () => {
    const sourceItem = availableItems.find((item) => item.id === newItemId);
    if (!sourceItem || newQuantity < 1) return;
    const existing = items.find((item) => item.id === sourceItem.id);
    const nextQuantity = (existing?.quantity || 0) + newQuantity;
    if (nextQuantity > sourceItem.maxQuantity) {
      toast.error(`الكمية المتاحة للمرتجع: ${sourceItem.maxQuantity}`);
      return;
    }
    setItems(existing
      ? items.map((item) => item.id === sourceItem.id ? { ...item, quantity: nextQuantity } : item)
      : [...items, { ...sourceItem, quantity: newQuantity }]);
    setNewItemId("");
    setNewQuantity(1);
  };

  const filteredReturns = data.returns.filter(r => {
    const term = searchQuery.toLowerCase();
    return (
      r.invoiceId?.toLowerCase().includes(term) ||
      r.purchaseId?.toLowerCase().includes(term) ||
      r.reason?.toLowerCase().includes(term) ||
      (r.type === 'sale' ? 'مرتجع بيع' : 'مرتجع مورد').includes(term)
    );
  });

  return (
    <>
      <PageHeader
        title="المرتجعات"
        subtitle="إدارة مرتجعات المبيعات والمشتريات والربط مع المخازن."
        icon={<Undo2 className="w-8 h-8" />}
        action={
          <div className="flex items-center gap-2">
            <ActionButton
              tone={privacy ? "primary" : "surface"}
              onClick={toggle}
              title={privacy ? "إظهار الأرقام" : "إخفاء الأرقام"}
              icon={privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <ActionButton icon={<Plus className="h-4 w-4" />}>
                  تسجيل مرتجع جديد
                </ActionButton>
              </DialogTrigger>
            <DialogContent className="flex h-[min(760px,calc(100dvh-1rem))] w-[min(94vw,760px)] max-w-none flex-col overflow-hidden border-none bg-card/95 p-0">
              <DialogHeader className="shrink-0 border-b border-[var(--hairline)] bg-card/95 p-5 sm:p-6">
                <DialogTitle className="text-right text-xl font-black">تسجيل مرتجع جديد</DialogTitle>
                <p className="mt-1 text-right text-xs font-bold text-muted-foreground">اربط المرتجع بالمستند الأصلي لتحديث المخزون تلقائياً.</p>
              </DialogHeader>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 p-4 text-right sm:p-6" dir="rtl">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/20 p-1.5 ring-1 ring-inset ring-[var(--hairline)]">
                    <Button type="button" variant={returnType === "sale" ? "default" : "ghost"} className="h-11 rounded-xl font-black" onClick={() => { setReturnType("sale"); setSourceId(""); setItems([]); }}>
                      مرتجع بيع
                    </Button>
                    <Button type="button" variant={returnType === "supplier" ? "default" : "ghost"} className={cn("h-11 rounded-xl font-black", returnType === "supplier" && "bg-warning text-warning-foreground hover:bg-warning/90")} onClick={() => { setReturnType("supplier"); setSourceId(""); setItems([]); }}>
                      مرتجع مورد
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-2xl bg-muted/15 p-4 ring-1 ring-inset ring-[var(--hairline)]">
                    <Label className="text-xs font-black text-muted-foreground">{returnType === "sale" ? "الفاتورة الأصلية" : "المشتريات الأصلية"}</Label>
                    <Select value={sourceId} onValueChange={(value) => { setSourceId(value); setItems([]); }}>
                      <SelectTrigger className="h-12 bg-background/50 text-right font-bold"><SelectValue placeholder={returnType === "sale" ? "اختر فاتورة" : "اختر عملية شراء"} /></SelectTrigger>
                      <SelectContent>
                        {(returnType === "sale" ? data.invoices : data.purchases).map((source: any) => (
                          <SelectItem key={source.id} value={source.id}>
                            {returnType === "sale" ? `فاتورة ${source.invoiceNumber || source.id.slice(0, 8)}` : `شراء ${source.id.slice(0, 8)}`} — {fmt(Number(source.total || 0))} ج.م
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSource && <p className="text-xs font-bold text-muted-foreground">المستند المختار جاهز لاختيار الأصناف المتاحة للمرتجع.</p>}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-[var(--hairline)] bg-muted/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs font-black text-muted-foreground">إضافة أصناف المرتجع</Label>
                      <Badge variant="outline" className={cn("rounded-full", returnType === "sale" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger")}>{returnType === "sale" ? "تُضاف للمخزون" : "تُخصم من المخزون"}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto]">
                      <Select value={newItemId} onValueChange={setNewItemId} disabled={!sourceId || availableItems.length === 0}>
                        <SelectTrigger className="h-11 text-right font-bold"><SelectValue placeholder={sourceId ? "اختر الصنف" : "اختر المستند أولاً"} /></SelectTrigger>
                        <SelectContent>{availableItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} — متاح {item.maxQuantity}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" min={1} value={newQuantity} onChange={(event) => setNewQuantity(Math.max(1, Number(event.target.value) || 1))} className="h-11 text-right font-black" aria-label="الكمية" />
                      <Button type="button" onClick={addItem} disabled={!newItemId} className="h-11 gap-2 rounded-xl font-black"><Plus className="h-4 w-4" />إضافة</Button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {items.length > 0 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 rounded-2xl bg-muted/15 p-4 ring-1 ring-inset ring-[var(--hairline)]">
                      {items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[var(--hairline)]/60 py-2 last:border-0">
                        <button type="button" onClick={() => setItems(items.filter((current) => current.id !== item.id))} className="rounded-xl p-2 text-danger hover:bg-danger/10" aria-label={`حذف ${item.name}`}><X className="h-4 w-4" /></button>
                        <div className="min-w-0 flex-1"><div className="truncate font-black">{item.name}</div><div className="text-xs font-bold text-muted-foreground">{item.quantity} × {fmt(item.unitPrice)} ج.م</div></div>
                        <div className={cn("shrink-0 font-black text-primary", blurCls)}>{fmt(item.unitPrice * item.quantity)} ج.م</div>
                      </div>)}
                    </motion.div>}
                  </AnimatePresence>

                  <div className="space-y-2 rounded-2xl bg-muted/15 p-4 ring-1 ring-inset ring-[var(--hairline)]">
                    <Label className="text-xs font-black text-muted-foreground">السبب / ملاحظات <span className="text-danger">*</span></Label>
                    <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثال: تلف في المنتج أو خطأ في المقاس..." className="h-12 text-right font-bold" />
                  </div>
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t border-[var(--hairline)] bg-card/95 p-4 sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-black text-muted-foreground">الإجمالي النهائي</span><span className={cn("text-xl font-black text-primary", blurCls)}>{fmt(total)} ج.م</span></div>
                <Button type="button" className={cn("w-full gap-2 rounded-2xl py-6 text-lg font-black", returnType === "sale" ? "bg-danger text-danger-foreground hover:bg-danger/90" : "bg-warning text-warning-foreground hover:bg-warning/90")} disabled={!sourceId || !reason.trim() || items.length === 0} onClick={handleAddReturn}>
                  <Check className="h-5 w-5" /> تأكيد وتسجيل المرتجع
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4 mb-14">
        <MetricCard
        className="h-full"
          icon={Undo2}
          label="إجمالي المرتجعات"
          value={data.returns.reduce((acc, r) => acc + r.totalAmount, 0)}
          format={(n) => `${fmt(n)} ج.م`}
          tone="neutral"
          masked={privacy}
          sub="مبيعات + موردين"
        />
        <MetricCard
        className="h-full"
          icon={TrendingUp}
          label="مرتجعات مبيعات"
          value={data.returns.filter(r => r.type === "sale").reduce((acc, r) => acc + r.totalAmount, 0)}
          format={(n) => `${fmt(n)} ج.م`}
          tone="neutral"
          masked={privacy}
          sub="مرتجعات من العملاء"
        />
        <MetricCard
        className="h-full"
          icon={Package}
          label="مرتجعات موردين"
          value={data.returns.filter(r => r.type === "supplier").reduce((acc, r) => acc + r.totalAmount, 0)}
          format={(n) => `${fmt(n)} ج.م`}
          tone="neutral"
          masked={privacy}
          sub="مرتجعات للموردين"
        />
        <MetricCard
        className="h-full"
          icon={History}
          label="عدد العمليات"
          value={data.returns.length}
          format={(n) => String(Math.round(n))}
          tone="neutral"
          masked={privacy}
          sub="إجمالي عمليات الإرجاع"
        />
      </div>

      {/* Full Width History Table/List */}
      <div className="space-y-4">
        <div className="sticky-search-bar mb-4">
          <div className="bg-card/50 rounded-2xl border border-foreground/10 bg-card/70 p-5 flex flex-col lg:flex-row gap-5 items-center justify-between">
            <div className="flex items-center gap-4 order-2 lg:order-1 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث في المرتجعات (رقم الفاتورة، السبب...)" 
                  className="pr-10 h-11 glass border-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Badge variant="secondary" className="px-4 py-2 rounded-xl font-black text-xs tracking-[0.12em] uppercase bg-muted/50 hidden md:flex shrink-0">
                {filteredReturns.length} عملية مؤرشفة
              </Badge>
            </div>
            <h3 className="text-sm font-black flex items-center gap-3 text-right order-1 lg:order-2 w-full lg:w-auto justify-end uppercase tracking-tighter">
              سجل المرتجعات الشامل
              <div className="p-2 rounded-xl bg-foreground/[0.06] ring-1 ring-foreground/10">
                <History className="w-5 h-5 text-foreground" />
              </div>
            </h3>
          </div>
        </div>

        <Reveal delay={100}>
          <div className="flex flex-col gap-3">
            {filteredReturns.length === 0 ? (
              <div className="rounded-2xl border border-foreground/10 bg-card/70">
                <div className=" px-6 py-10">
                  <EmptyState
                    icon={History}
                    title="لا توجد سجلات مطابقة"
                    hint="لم نتمكن من العثور على أي عمليات مرتجعة مسجلة تطابق معايير البحث الحالية."
                  />
                </div>
              </div>
            ) : (
              filteredReturns.map((r: any, idx) => (
                <div
                  key={r.id}
                  className="group rounded-2xl border border-foreground/10 bg-card/70  animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)] both"
                  style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}
                >
                  <div className=" grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6">
                    {/* الهوية */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
                        r.type === "sale" ? "bg-danger/12 text-danger ring-danger/25" : "bg-warning/12 text-warning ring-warning/25"
                      )}>
                        {r.type === "sale" ? <TrendingUp className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{r.type === "sale" ? "مرتجع مبيعات" : "مرتجع موردين"}</span>
                          {r.invoiceId && (
                            <Badge variant="secondary" className="text-xs font-mono bg-muted/50 ring-1 ring-inset ring-[var(--hairline)]">{r.invoiceId}</Badge>
                          )}
                        </div>
                        <div className="text-numeric mt-0.5 text-xs text-muted-foreground" dir="ltr">
                          {format(new Date(r.createdAt), "yyyy/MM/dd - hh:mm a")}
                        </div>
                      </div>
                    </div>

                    {/* القيمة والتفاصيل */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <div className="text-xs text-muted-foreground mb-0.5">قيمة المرتجع</div>
                          <div className={cn("text-numeric text-xl font-extrabold", r.type === "sale" ? "text-danger" : "text-warning", blurCls)}>
                            {fmt(r.totalAmount)} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                          </div>
                        </div>
                        {r.items && r.items.length > 0 && (
                          <div className="flex flex-col">
                            <div className="text-xs text-muted-foreground mb-0.5">الأصناف</div>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              {r.items.slice(0, 3).map((item: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs py-0 px-2 bg-muted/20 border-none font-bold">
                                  {item.name} ({item.quantity})
                                </Badge>
                              ))}
                              {r.items.length > 3 && (
                                <Badge variant="outline" className="text-xs py-0 px-2 bg-muted/20 border-none font-bold">
                                  +{r.items.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {r.reason && <div className="mt-2 max-w-[300px] truncate text-xs text-muted-foreground">{r.reason}</div>}
                    </div>

                    {/* الإجراءات */}
                    <div className="flex items-center justify-end gap-1.5 md:opacity-70 md:transition-opacity md:group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="action-btn rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10"
                        onClick={() => db.removeReturn(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Reveal>

      </div>
    </>
  );
}


