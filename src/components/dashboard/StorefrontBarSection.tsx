import { Link } from "@/lib/router-compat";
import { Store, ShoppingBag, ChevronLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./context";

export function StorefrontBarSection() {
  const {
    storefrontLoading,
    storefrontError,
    storefront,
    storefrontStats,
    setStorefrontLoadAttempt,
    privacy,
    money,
  } = useDashboard();

  return (
    <section className="mb-6">
      {storefrontLoading ? (
        <div className="flex min-h-24 items-center justify-center rounded-3xl border border-border/80 bg-muted/30 text-xs font-bold text-muted-foreground">
          جارٍ تحميل بيانات المتجر…
        </div>
      ) : storefrontError ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-3xl border border-danger/25 bg-danger/[0.06] p-4 sm:flex-row">
          <div className="flex items-center gap-3 text-right">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-bold text-danger">{storefrontError}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">تحقق من الاتصال ثم حاول مرة أخرى.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStorefrontLoadAttempt((attempt) => attempt + 1)}
            className="shrink-0 rounded-xl bg-danger/10 px-4 py-2 text-xs font-bold text-danger ring-1 ring-danger/20 transition hover:bg-danger/15"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : storefront ? (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 border border-primary/20 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-right">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/15 text-primary">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>متجر: {storefront.name}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      نشط أونلاين
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {storefront.slug ? ${storefront.slug}.segilly.com : "المتجر الإلكتروني"}
                  </div>
                </div>
              </div>

              <div className="h-7 w-px bg-border hidden md:block" />

              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-center">
                  <div className="text-[10px] text-muted-foreground">طلبات اليوم</div>
                  <div className="text-xs font-bold text-foreground">
                    {storefrontStats.todayOrdersCount} طلب
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-center">
                  <div className="text-[10px] text-muted-foreground">طلبات معلقة</div>
                  <div className={cn("text-xs font-bold", storefrontStats.pendingOrders > 0 ? "text-amber-600" : "text-foreground")}>
                    {storefrontStats.pendingOrders} طلب
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-center">
                  <div className="text-[10px] text-muted-foreground">إيراد المتجر</div>
                  <div className={cn("text-xs font-bold text-emerald-600", privacy && "privacy-blur")}>
                    {money(storefrontStats.storeRevenue)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Link
                to="/storefront"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
              >
                <span>إدارة المتجر والطلبات</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl bg-muted/40 border border-dashed border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-right">
            <div className="p-2.5 rounded-2xl bg-muted text-muted-foreground">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">هل ترغب في فتح متجرك الإلكتروني للبيع أونلاين؟</div>
              <div className="text-[11px] text-muted-foreground">
                يمكنك إنشاء متجرك ومشاركة الرابط مع زبائنك لاستقبال طلبات البيع مباشرة ومزامنتها لحظياً مع الخزينة والمخزن.
              </div>
            </div>
          </div>
          <Link
            to="/storefront"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-foreground/[0.08] text-foreground text-xs font-bold hover:bg-foreground/[0.15] transition-all"
          >
            <span>تفعيل المتجر الآن</span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
