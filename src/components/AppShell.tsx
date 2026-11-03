import logoMark from "@/assets/logo-mark.png";
import { Link, useNavigate, useLocation } from "@/lib/router-compat";
import type { ReactNode } from "react";
import { LogOut, MoreHorizontal, Search, ChevronDown, Crown, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useDB, lowStockCount, useShopSettings, isDueSoonOrOverdue } from "@/lib/store";
import { UserChip } from "@/components/UserChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { applyTheme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCurrentLicense } from "@/lib/licensing";
import { useStaffAndShifts } from "@/lib/staff";
import { useDeploymentHealth } from "@/lib/health";
import {
  navGroups,
  isNavVisible,
  isItemActive,
  MOBILE_TAB_ROUTES,
  type NavGroup,
  type NavItem,
} from "@/lib/nav-groups";

// Phase 1 (mobile): 5 core tabs on the bottom bar — everything else lives in "المزيد".
function MobileBottomBar({
  items,
  groups,
  pathname,
  overdueCount,
}: {
  items: NavItem[];
  groups: NavGroup[];
  pathname: string;
  overdueCount: number;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = items.filter((n) => MOBILE_TAB_ROUTES.includes(n.to));
  const moreActive = items.some(
    (n) => !MOBILE_TAB_ROUTES.includes(n.to) && isItemActive(n, pathname),
  );
  return (
    <>
      <div className="glass no-scrollbar fixed inset-x-3 bottom-3 z-40 flex overflow-x-auto rounded-[1.5rem] pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((n) => {
          const active = isItemActive(n, pathname);
          const Icon = n.icon;
          const showBadge = n.alertKey && overdueCount > 0;
          return (
            <Link key={n.to} to={n.to} className={cn("press flex min-w-[60px] flex-1 flex-col items-center gap-1.5 rounded-[1.25rem] py-3 text-xs font-medium", active ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground")}>
              <span className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-danger-foreground">
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
          className={cn("press flex min-w-[60px] flex-1 flex-col items-center gap-1.5 rounded-[1.25rem] py-3 text-xs font-medium", moreActive ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground")}
        >
          <span className="relative">
            <MoreHorizontal className="h-5 w-5" />
              {overdueCount > 0 && (
                <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-danger-foreground">
                {overdueCount}
              </span>
            )}
          </span>
          المزيد
        </button>
      </div>
      <MobileMoreSheet groups={groups} open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} overdueCount={overdueCount} />
    </>
  );
}

function MobileMoreSheet({
  groups,
  open,
  onOpenChange,
  pathname,
  overdueCount,
}: {
  groups: NavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  overdueCount: number;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const filtered = useMemo(
    () => (q ? groups.flatMap((g) => g.items).filter((n) => n.label.includes(q)) : []),
    [groups, q],
  );
  const renderRow = (n: NavItem) => {
    const active = isItemActive(n, pathname);
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
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-danger-foreground">
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
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-1 px-4 text-xs font-bold text-muted-foreground">{g.label}</p>
                <div className="flex flex-col gap-1">
                  {g.items.map(renderRow)}
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

  // Groups are filtered item-by-item; a group whose items are all hidden disappears.
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((n) =>
            isNavVisible(n, license.modules, currentStaff.permissions, currentStaff.role),
          ),
        }))
        .filter((g) => g.items.length > 0),
    [license, currentStaff],
  );
  const visibleNav = useMemo(() => visibleGroups.flatMap((g) => g.items), [visibleGroups]);

  // Single-open accordion: whichever group owns the current route opens automatically.
  const activeGroupKey = useMemo(
    () => visibleGroups.find((g) => g.items.some((n) => isItemActive(n, location.pathname)))?.key ?? null,
    [visibleGroups, location.pathname],
  );
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupKey);
  useEffect(() => {
    if (activeGroupKey) setOpenGroup(activeGroupKey);
  }, [activeGroupKey]);

  // The mobile sheet mirrors the same groups, minus the routes pinned to the bottom bar.
  const mobileSheetGroups = useMemo(
    () =>
      visibleGroups
        .map((g) => ({ ...g, items: g.items.filter((n) => !MOBILE_TAB_ROUTES.includes(n.to)) }))
        .filter((g) => g.items.length > 0),
    [visibleGroups],
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/landing");
  };
  // Server-integration health: when the worker has no Supabase env, every
  // server function fails — show a guided banner instead of cryptic errors.
  const { linked: serverLinked, refresh: refreshHealth } = useDeploymentHealth();
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
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85">Segilly</div>
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
            "group relative flex items-center justify-between gap-3 rounded-2xl p-3 border transition-[background-color,border-color,box-shadow] duration-300",
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
                <span className="inline-block rounded-md bg-amber-500/20 px-1 py-0.2 text-[11px] font-extrabold text-amber-400">Boss</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">لوحة الإدارة والقرارات</p>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="جاهز للعمل" />
        </Link>

        <nav className="stagger no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
          {visibleGroups.map((g) => {
            const GroupIcon = g.icon;
            const isOpen = openGroup === g.key;
            const isGroupActive = activeGroupKey === g.key;
            const groupBadge = g.items.some((n) => n.alertKey) ? overdueCount : 0;
            return (
              <Collapsible
                key={g.key}
                open={isOpen}
                onOpenChange={(next) => setOpenGroup(next ? g.key : null)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    aria-controls={`nav-group-${g.key}`}
                    className={cn(
                      "group relative flex w-full items-center justify-between gap-2 rounded-full px-4 py-2.5 text-sm transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                      isGroupActive
                        ? "bg-sidebar-accent/70 font-semibold text-sidebar-foreground"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-[-3px] hover:shadow-[inset_0_0_0_1px_var(--hairline)]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <GroupIcon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isGroupActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{g.label}</span>
                      {groupBadge > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-danger-foreground">
                          {groupBadge}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent
                  id={`nav-group-${g.key}`}
                  className="overflow-hidden data-[state=open]:animate-accordion-down"
                >
                  <div className="mt-1 flex flex-col gap-1 border-s border-[var(--hairline)] ps-2">
                    {g.items.map((n) => {
                      const active = isItemActive(n, location.pathname);
                      const Icon = n.icon;
                      const showBadge = n.alertKey && overdueCount > 0;
                      return (
                        <Link
                          key={n.to}
                          to={n.to}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center justify-between gap-2 rounded-full px-3 py-2 text-[13px] transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            active
                              ? "bg-primary font-semibold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]"
                              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-[-2px] hover:shadow-[inset_0_0_0_1px_var(--hairline)]",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{n.label}</span>
                            {showBadge && (
                              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-danger-foreground">
                                {overdueCount}
                              </span>
                            )}
                          </span>
                          <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
      <MobileBottomBar items={visibleNav} groups={mobileSheetGroups} pathname={location.pathname} overdueCount={overdueCount} />

      {/* علامة القمر — ظاهرة دايماً على الموبايل */}
      <div className="fixed left-3 top-3 z-40 md:hidden">
        <ThemeToggle className="h-10 w-10 backdrop-blur-xl" />
      </div>

      <main className="min-w-0 flex-1 px-4 pb-32 pt-10 text-right md:px-12 md:pb-16 md:pt-16">
        {serverLinked === false && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-right" role="alert">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">ربط Supabase غير مكتمل على الخادم</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                عمليات الخادم (النسخ الاحتياطي، المسح، الدعوات) متوقفة حالياً. تحقق من ربط Supabase
                في لوحة تحكم الاستضافة ثم أعد النشر، أو اضغط إعادة الفحص.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-500/30"
              >
                <RefreshCw className="h-3.5 w-3.5" /> إعادة الفحص
              </button>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
