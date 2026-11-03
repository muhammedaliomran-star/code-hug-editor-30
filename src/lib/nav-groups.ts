import {
  LayoutGrid,
  CalendarDays,
  ShoppingCart,
  FileText,
  Banknote,
  Undo2,
  Percent,
  Users,
  Bell,
  Truck,
  Package,
  Warehouse,
  GitBranch,
  Wallet,
  Receipt,
  ClipboardCheck,
  BarChart3,
  UserCheck,
  ShieldCheck,
  Settings,
  Home,
} from "lucide-react";
import type { ModulePermissions } from "@/lib/licensing";
import type { StaffPermissions, StaffRole } from "@/lib/staff";

export type NavItem = {
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

export type NavGroup = {
  key: string;
  label: string;
  icon: typeof LayoutGrid;
  items: NavItem[];
};

/**
 * The app navigation, grouped into 6 top-level sections.
 *
 * Routes are unchanged — this only changes how the sidebar is presented, so
 * bookmarks, deep links and the generated route tree keep working exactly as
 * before. Each item still declares its own license/staff requirement; a group
 * whose items are all hidden collapses away entirely.
 */
export const navGroups: NavGroup[] = [
  {
    key: "home",
    label: "الرئيسية",
    icon: Home,
    items: [
      { to: "/", label: "لوحة التحكم", icon: LayoutGrid },
      { to: "/daily", label: "اليومية", icon: CalendarDays },
    ],
  },
  {
    key: "sales",
    label: "البيع والتحصيل",
    icon: ShoppingCart,
    items: [
      { to: "/pos", label: "الكاشير (POS)", icon: ShoppingCart, licenseKey: "allowPos" },
      { to: "/invoices", label: "الفواتير", icon: FileText, licenseKey: "allowInstallments" },
      { to: "/payments", label: "الدفعات", icon: Banknote },
      { to: "/returns", label: "المرتجعات", icon: Undo2 },
      { to: "/discounts", label: "العروض والكوبونات", icon: Percent },
    ],
  },
  {
    key: "customers",
    label: "العملاء والشحن",
    icon: Users,
    items: [
      { to: "/customers", label: "العملاء", icon: Users },
      { to: "/alerts", label: "المنبه", icon: Bell, alertKey: true as const },
      { to: "/shipping", label: "الشحن", icon: Truck },
    ],
  },
  {
    key: "stock",
    label: "المخزون والمشتريات",
    icon: Package,
    items: [
      { to: "/inventory", label: "المنتجات", icon: Package, licenseKey: "allowWarehouse" },
      { to: "/warehouse", label: "المخزن", icon: Warehouse, licenseKey: "allowWarehouse" },
      { to: "/purchases", label: "المشتريات", icon: Truck },
      { to: "/suppliers", label: "الموردين", icon: Users },
      { to: "/branches", label: "الفروع", icon: GitBranch, licenseKey: "allowMultiBranch" },
    ],
  },
  {
    key: "money",
    label: "الخزينة والمالية",
    icon: Wallet,
    items: [
      { to: "/cashbox", label: "الصندوق", icon: Wallet },
      { to: "/expenses", label: "المصروفات", icon: Receipt },
      { to: "/reconciliation", label: "المطابقة", icon: ClipboardCheck },
    ],
  },
  {
    key: "admin",
    label: "الإدارة والتقارير",
    icon: Settings,
    items: [
      { to: "/reports", label: "التقارير", icon: BarChart3, staffPerm: "canAccessReports" },
      { to: "/staff", label: "فريق العمل والورديات", icon: UserCheck, roles: ["admin", "manager"] },
      { to: "/audit", label: "سجل الرقابة والتدقيق", icon: ShieldCheck, roles: ["admin"] },
      { to: "/settings", label: "الإعدادات", icon: Settings, staffPerm: "canAccessSettings" },
    ],
  },
];

/** Routes pinned to the mobile bottom bar — everything else lives in "المزيد". */
export const MOBILE_TAB_ROUTES = ["/", "/pos", "/invoices", "/customers", "/shipping"];

export function isNavVisible(
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

/** Active check that treats "/" as exact but lets nested routes match their parent. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
