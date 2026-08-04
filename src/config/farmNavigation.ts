import {
  LayoutDashboard,
  UsersRound,
  Egg,
  Bird,
  Wheat,
  Pill,
  Stethoscope,
  TrendingDown,
  ShoppingCart,
  Receipt,
  FileChartColumn,
  Bell,
  Logs,
  Building2,
  House,
  ClipboardList,
  Boxes,
  CircleUserRound,
} from "lucide-react";
import type { NavEntry, NavLink } from "./navTypes";
import type { UserRole } from "../types/auth";

/** Absolute path to the Farm Admin's Dashboard Overview route. */
export const FARM_DASHBOARD_PATH = "/farm";
/** Absolute path to the Farm Admin's account page — reuses the same ProfilePage as Super Admin's Profile. */
export const FARM_ACCOUNT_PATH = "/farm/account";
export const FARM_OPERATIONS_PATH = "/farm/operations";
export const FARM_PRODUCTION_HUB_PATH = "/farm/production-hub";
export const FARM_INVENTORY_HUB_PATH = "/farm/inventory-hub";
/** Absolute path to the Farm portal's Egg Production page — real (Supabase-backed), not a placeholder. */
export const FARM_EGG_PRODUCTION_PATH = "/farm/egg-production";
/** Absolute path to Staff Management — real (Supabase-backed), Farm Admin only, not a placeholder. */
export const FARM_STAFF_PATH = "/farm/staff";

// ── Shared link definitions — reused across roles so paths/icons stay in sync ──
const dashboardLink: NavLink = { type: "link", label: "Dashboard", path: FARM_DASHBOARD_PATH, icon: LayoutDashboard };
const staffManagementLink: NavLink = { type: "link", label: "Staff Management", path: FARM_STAFF_PATH, icon: UsersRound };
const eggProductionLink: NavLink = { type: "link", label: "Egg Production", path: FARM_EGG_PRODUCTION_PATH, icon: Egg };
const poultryInventoryLink: NavLink = { type: "link", label: "Poultry Inventory", path: "/farm/inventory", icon: Bird };
const feedLink: NavLink = { type: "link", label: "Feed & Vitamins", path: "/farm/feed", icon: Wheat };
const feedDistributionLink: NavLink = { type: "link", label: "Feed Distribution", path: "/farm/feed", icon: Wheat };
const vitaminsLink: NavLink = { type: "link", label: "Vitamins & Medicine", path: "/farm/vitamins", icon: Pill };
const healthLink: NavLink = { type: "link", label: "Health Records", path: "/farm/health", icon: Stethoscope };
const healthMonitoringLink: NavLink = { type: "link", label: "Health Monitoring", path: "/farm/health", icon: Stethoscope };
const mortalityLink: NavLink = { type: "link", label: "Mortality Records", path: "/farm/mortality", icon: TrendingDown };
const salesLink: NavLink = { type: "link", label: "Sales", path: "/farm/sales", icon: ShoppingCart };
const expensesLink: NavLink = { type: "link", label: "Expenses", path: "/farm/expenses", icon: Receipt };
const reportsLink: NavLink = { type: "link", label: "Reports", path: "/farm/reports", icon: FileChartColumn };
const notificationsLink: NavLink = { type: "link", label: "Notifications", path: "/farm/notifications", icon: Bell };
const auditLogsLink: NavLink = { type: "link", label: "Audit Logs", path: "/farm/audit-logs", icon: Logs };
const farmProfileLink: NavLink = { type: "link", label: "Farm Profile", path: "/farm/profile", icon: Building2 };

// ── Sidebar content per role ──
const farmAdminNavigation: NavLink[] = [
  dashboardLink,
  staffManagementLink,
  eggProductionLink,
  poultryInventoryLink,
  feedLink,
  healthLink,
  mortalityLink,
  salesLink,
  expensesLink,
  reportsLink,
  notificationsLink,
  auditLogsLink,
  farmProfileLink,
];

// Manager: everything Farm Admin sees except Staff Management — a shift-supervisor
// tier that runs operations/sales/reports but doesn't manage other staff accounts.
const managerNavigation: NavLink[] = farmAdminNavigation.filter((link) => link !== staffManagementLink);

// Staff: the spec's narrower set, with Feed & Vitamins/Health Records relabeled and
// (for feed/medicine) split into two distinct destinations.
const staffNavigation: NavLink[] = [
  dashboardLink,
  eggProductionLink,
  poultryInventoryLink,
  feedDistributionLink,
  vitaminsLink,
  healthMonitoringLink,
  mortalityLink,
  notificationsLink,
];

/** The Farm portal's sidebar/desktop nav, tailored per role. */
export function getFarmNavigation(role: UserRole): NavEntry[] {
  if (role === "Staff") return staffNavigation;
  if (role === "Manager") return managerNavigation;
  return farmAdminNavigation;
}

/** Every path any Farm role's nav can point to — used to mount placeholder routes regardless of who's logged in. */
export function getAllFarmNavLinks(): NavLink[] {
  const seen = new Map<string, NavLink>();
  for (const link of [...farmAdminNavigation, ...staffNavigation]) {
    seen.set(link.path, link);
  }
  return [...seen.values()];
}

// ── Mobile bottom nav (5 tabs max) — everything else lives behind a hub tab ──
const homeTab: NavLink = { type: "link", label: "Home", path: FARM_DASHBOARD_PATH, icon: House };
const operationsTab: NavLink = { type: "link", label: "Operations", path: FARM_OPERATIONS_PATH, icon: ClipboardList };
const productionHubTab: NavLink = { type: "link", label: "Production", path: FARM_PRODUCTION_HUB_PATH, icon: Egg };
const inventoryHubTab: NavLink = { type: "link", label: "Inventory", path: FARM_INVENTORY_HUB_PATH, icon: Boxes };
const profileTab: NavLink = { type: "link", label: "Profile", path: FARM_ACCOUNT_PATH, icon: CircleUserRound };

export function getFarmBottomNav(role: UserRole): NavLink[] {
  if (role === "Staff") {
    return [homeTab, productionHubTab, inventoryHubTab, notificationsLink, profileTab];
  }
  return [homeTab, operationsTab, reportsLink, notificationsLink, profileTab];
}

// Dashboard/Reports/Notifications/Profile already have their own bottom tab —
// Operations collects everything else so nothing in the sidebar becomes
// unreachable on mobile just because it didn't fit in 5 tabs.
const OPERATIONS_HUB_EXCLUDED_PATHS = new Set([FARM_DASHBOARD_PATH, reportsLink.path, notificationsLink.path]);

export function getOperationsHubItems(role: UserRole): NavLink[] {
  const source = role === "Manager" ? managerNavigation : farmAdminNavigation;
  return source.filter((link) => !OPERATIONS_HUB_EXCLUDED_PATHS.has(link.path));
}

export function getProductionHubItems(): NavLink[] {
  return [eggProductionLink, healthMonitoringLink, mortalityLink];
}

export function getInventoryHubItems(): NavLink[] {
  return [poultryInventoryLink, feedDistributionLink, vitaminsLink];
}
