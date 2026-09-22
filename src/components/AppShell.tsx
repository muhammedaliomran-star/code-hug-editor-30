import logoMark from "@/assets/logo-mark.png";
import { Link, useNavigate, useLocation } from "@/lib/router-compat";
import type { ReactNode } from "react";
import { LogOut, Undo2, Wallet, GitBranch, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Users, FileText, Bell, Receipt, Truck, Package, BarChart3, Settings, CalendarDays, Warehouse, Store, ClipboardCheck, Crown, Percent, ShieldCheck, UserCheck, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDB, lowStockCount, useShopSettings, isDueSoonOrOverdue } from "@/lib/store";
import { UserChip } from "@/components/UserChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { applyTheme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useCurrentLicense, type ModulePermissions } from "@/lib/licensing";
import { useStaffAndShifts, type StaffPermissions, type StaffRole } from "@/lib/staff";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  alertKey?: true;
  /** License module flag required to show this item */
  licenseKey?: "allowPos" | "allowInstallments" | "allowWarehouse" | "allowMultiBranch";
  /** Staff permission flag required to show this item */
  staffPerm?: "canAccessReports" | "canAccessSettings";
  /** Staff roles allowed to see this item (omitted = all roles) */
  roles?: StaffRole[];
};

// Phase 2: each item declares its license/staff requirement.
// Items without requirements are visible to everyone.
const nav: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutGrid },
  { to: "/pos", label: "الكاشير (POS)", icon: ShoppingCart, licenseKey: "allowPos" },
  { to: "/daily", label: "اليومية", icon: CalendarDays },
  { to: "/customers", label: "العملاء", icon: Users },
  { to: "/invoices", label: "الفواتير", icon: FileText, licenseKey: "allowInstallments" },
  { to: "/discounts", label: "العروض والكوبونات", icon: Percent },
  { to: "/shipping", label: "الشحن", icon: Truck },
  { to: "/purchases", label: "المشتريات", icon: Truck },
  { to: "/suppliers", label: "الموردين", icon: Users },

  { to: "/inventory", label: "المنتجات", icon: Package, licenseKey: "allowWarehouse" },
  { to: "/warehouse", label: "المخزن", icon: Warehouse, licenseKey: "allowWarehouse" },
  { to: "/branches", label: "الفروع", icon: GitBranch, licenseKey: "allowMultiBranch" },
  { to: "/staff", label: "فريق العمل والورديات", icon: UserCheck, roles: ["admin", "manager"] },
  { to: "/returns", label: "المرتجعات", icon: Undo2 },
  { to: "/cashbox", label: "الصندوق", icon: Wallet },
  { to: "/payments", label: "الدفعات", icon: Banknote },
  { to: "/expenses", label: "المصروفات", icon: Receipt },
  { to: "/alerts", label: "المنبه", icon: Bell, alertKey: true as const },
  { to: "/reports", label: "التقارير", icon: BarChart3, staffPerm: "canAccessReports" },
  { to: "/reconciliation", label: "المطابقة", icon: ClipboardCheck },
  { to: "/audit", label: "سجل الرقابة والتدقيق", icon: ShieldCheck, roles: ["admin"] },
  { to: "/settings", label: "الإعدادات", icon: Settings, staffPerm: "canAccessSettings" },
];

function isNavVisible(
  n: NavItem,
  modules: ModulePermissions,
  permissions: StaffPermissions,
  role: StaffRole,
): boolean {
  if (n.licenseKey && modules[n.licenseKey] === false) return false;
  if (n.staffPerm && permissions[n.staffPerm] !== true) return false;
  if (n.roles && !n.roles.includes(role)) return false;
  return true;
}

// Phase 1 (mobile): 5 core tabs on the bottom bar — the rest live in the "More" sheet.
const MOBILE_TABS = ["/", "/pos", "/invoices", "/customers", "/shipping"];

function MobileBottomBar({ items, pathname, overdueCount }: { items: NavItem[]; pathname: string; overdueCount: number }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = items.filter((n) => MOBILE_TABS.includes(n.to));
  const rest = items.filter((n) => !MOBILE_TABS.includes(n.to));
  const moreActive = rest.some((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)));
  return (
    <>
      <div className="glass no-scrollbar fixed inset-x-3 bottom-3 z-40 flex overflow-x-auto rounded-[1.5rem] pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((n) => {
          const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          const Icon = n.icon;
          const showBadge = n.alertKey && overdueCount > 0;
          return (
            <Link key={n.to} to={n.to} className={cn("press flex min-w-[60px] flex-1 flex-col items-center gap-1.5 rounded-[1.25rem] py-3 text-[10px]", active ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground")}>
              <span className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-danger-foreground">
                    {overdueCount}
                  </span>
                )}
              </span>
              {n.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn("press flex min-w-[60px] flex-1 flex-col items-center gap-1.5 rounded-[1.25rem] py-3 text-[10px]", moreActive ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground")}
        >
          <span className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {overdueCount > 0 && (
              <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-danger-foreground">
                {overdueCount}
              </span>
            )}
          </span>
          المزيد
        </button>
      </div>
      <MobileMoreSheet items={rest} open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} overdueCount={overdueCount} />
    </>
  );
}

function MobileMoreSheet({
  items,
  open,
  onOpenChange,
  pathname,
  overdueCount,
}: {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  overdueCount: number;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const filtered = useMemo(
    () => (q ? items.filter((n) => n.label.includes(q)) : items),
    [items, q],
  );
  // Phase 3: group rare/admin sections under headers (only when not searching).
  const sections = useMemo(() => {
    if (q) return [];
    const by = (routes: string[]) => items.filter((n) => routes.includes(n.to));
    return [
      { key: "ops", title: "العمليات اليومية", rows: by(["/daily", "/discounts", "/purchases", "/suppliers", "/returns", "/cashbox", "/payments", "/expenses", "/alerts"]) },
      { key: "stock", title: "المخزون والفروع", rows: by(["/inventory", "/warehouse", "/branches"]) },
      { key: "admin", title: "الإدارة", rows: by(["/staff", "/reports", "/reconciliation", "/audit", "/settings"]) },
    ].filter((s) => s.rows.length > 0);
  }, [items, q]);
  const renderRow = (n: NavItem) => {
    const active = pathname.startsWith(n.to);
    const Icon = n.icon;
    const showBadge = n.alertKey && overdueCount > 0;
    return (
      <Link
        key={n.to}
        to={n.to}
        onClick={() => onOpenChange(false)}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm",
          active ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-sidebar-accent/70",
        )}
      >
        <span className="flex items-center gap-2">
          {n.label}
          {showBadge && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold leading-none text-danger-foreground">
              {overdueCount}
            </span>
          )}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </Link>
    );
  };
  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(""); }}>
      <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-[1.5rem] px-4 pb-8 pt-4">
        <SheetHeader className="mb-3 text-right">
          <SheetTitle>كل الأقسام</SheetTitle>
        </SheetHeader>
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دوّر على قسم…"
            className="pr-9"
          />
        </div>
        {q ? (
          <div className="flex flex-col gap-1">
            {filtered.map(renderRow)}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">مفيش قسم بالاسم ده.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sections.map((s) => (
              <div key={s.key}>
                <p className="mb-1 px-4 text-[11px] font-bold text-muted-foreground">{s.title}</p>
                <div className="flex flex-col gap-1">
                  {s.rows.map(renderRow)}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function dueOrOverdueCount(
  invoices: Array<{ firstDueDate: string; paid: number; total: number }>,
  daysBefore: number,
) {
  return invoices.filter((inv) => isDueSoonOrOverdue(inv, daysBefore)).length;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { invoices, stockItems } = useDB();
  const { settings } = useShopSettings();
  useEffect(() => { applyTheme(settings.theme); }, [settings.theme]);
  const overdueCount = settings.alertsEnabled
    ? dueOrOverdueCount(invoices, settings.reminderDaysBefore) +
      lowStockCount(stockItems, settings.lowStockThreshold)
    : 0;
  // Phase 2: hide nav items the current license / staff role may not access.
  const { license } = useCurrentLicense();
  const { currentStaff } = useStaffAndShifts();
  const visibleNav = useMemo(
    () => nav.filter((n) => isNavVisible(n, license.modules, currentStaff.permissions, currentStaff.role)),
    [license, currentStaff],
  );
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/landing");
  };
  return (
    <div dir="rtl" className="relative min-h-screen text-foreground flex overflow-hidden selection:bg-primary selection:text-black">
      {/* Ambient background layer */}
      <div className="fixed inset-0 z-[-1] ambient-mesh opacity-80" />
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 flex-col gap-8 p-4 md:flex">
        <div className="glass flex h-full min-h-0 flex-col gap-6 overflow-hidden rounded-[1.75rem] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <img src={logoMark} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          </span>
          <div>
            <div className="text-display text-2xl font-bold leading-none text-foreground">سِجلّي</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/85">Segilly</div>
          </div>
        </div>

        {/* محدد الفرع العام */}
        <div className="px-1">
          <BranchSwitcher className="w-full justify-between" />
        </div>

        {/* Pinned Executive Launcher: Owner Companion App */}
        <Link
          to="/owner"
          className={cn(
            "group relative flex items-center justify-between gap-3 rounded-2xl p-3 border transition-all duration-300",
            location.pathname.startsWith("/owner")
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm"
              : "bg-card/70 border-border/80 text-foreground hover:bg-card hover:border-amber-500/30"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
              location.pathname.startsWith("/owner")
                ? "bg-amber-500 text-black font-bold shadow-sm"
                : "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20"
            )}>
              <Crown className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-right">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">تطبيق المالك</span>
                <span className="inline-block rounded-md bg-amber-500/20 px-1 py-0.2 text-[9px] font-extrabold text-amber-400">Boss</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">لوحة الإدارة والقرارات</p>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="جاهز للعمل" />
        </Link>

        <nav className="stagger no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
          {visibleNav.map((n) => {
            const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            const showBadge = n.alertKey && overdueCount > 0;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "group relative flex items-center justify-between gap-2 rounded-full px-4 py-2.5 text-sm transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  active
                    ? "bg-primary font-semibold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-[-3px] hover:shadow-[inset_0_0_0_1px_var(--hairline)]"
                )}
              >
                <span className="flex items-center gap-2">
                  {n.label}
                  {showBadge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-danger-foreground text-[10px] font-bold leading-none animate-pulse">
                      {overdueCount}
                    </span>
                  )}
                </span>
                <span className="relative">
                  <Icon className="w-4 h-4" />
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-0 flex shrink-0 flex-col gap-2 border-t border-[var(--hairline)] pt-3">
          <UserChip />
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-xs text-muted-foreground">وضع الليل / النهار</span>
            <ThemeToggle className="h-9 w-9" />
          </div>
          <button onClick={signOut} className="press flex items-center justify-between gap-2 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-destructive/10 hover:text-destructive">
            <span>تسجيل الخروج</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        </div>
      </aside>

      {/* Mobile bottom nav: 5 core tabs + More sheet */}
      <MobileBottomBar items={visibleNav} pathname={location.pathname} overdueCount={overdueCount} />

      {/* علامة القمر — ظاهرة دايماً على الموبايل */}
      <div className="fixed left-3 top-3 z-40 md:hidden">
        <ThemeToggle className="h-10 w-10 backdrop-blur-xl" />
      </div>

      <main className="min-w-0 flex-1 px-4 pb-32 pt-10 text-right md:px-12 md:pb-16 md:pt-16">
        {children}
      </main>
    </div>
  );
}
