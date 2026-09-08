import {
  LayoutDashboard,
  UsersRound,
  Egg,
  Bird,
  Stethoscope,
  Wallet,
  FileChartColumn,
  Bell,
  Logs,
  Building2,
  House,
  ClipboardList,
  Boxes,
  CircleUserRound,
  UserRound,
  ShieldCheck,
  Palette,
  Lock,
  LifeBuoy,
  Info,
  Smartphone,
} from "lucide-react";
import type { NavEntry, NavLink } from "@poultryhub/shared/config/navTypes";
import type { UserRole } from "@poultryhub/shared/types/auth";

/** Absolute path to the Farm Admin's Dashboard Overview route. */
export const FARM_DASHBOARD_PATH = "/farm";
/** Absolute path to the Farm Admin's account page — reuses the same ProfilePage as Super Admin's Profile. */
export const FARM_ACCOUNT_PATH = "/farm/account";
/** Absolute path to the Farm Admin's Edit Profile screen — mobile gets a dedicated page here instead of Super Admin's modal. */
export const FARM_EDIT_PROFILE_PATH = "/farm/account/edit";
/** Absolute path to the Security screen (2FA, Active Devices, Login History) — mobile's Account menu. */
export const FARM_ACCOUNT_SECURITY_PATH = "/farm/account/security";
/** Absolute path to the Notifications preferences screen — mobile's Account menu. */
export const FARM_ACCOUNT_NOTIFICATIONS_PATH = "/farm/account/notifications";
/** Absolute path to the Appearance (theme) screen — mobile's Account menu. */
export const FARM_ACCOUNT_APPEARANCE_PATH = "/farm/account/appearance";
/** Absolute path to the App Permissions screen (Notifications/Location/Camera status) — mobile's Account menu. */
export const FARM_ACCOUNT_PERMISSIONS_PATH = "/farm/account/permissions";
/** Absolute path to the Data Privacy screen — mobile's Account menu. */
export const FARM_ACCOUNT_PRIVACY_PATH = "/farm/account/privacy";
/** Absolute path to the Help & Support screen (User Guide, Report a Problem) — mobile's Account menu. */
export const FARM_ACCOUNT_HELP_PATH = "/farm/account/help";
/** Absolute path to the About screen — mobile's Account menu. */
export const FARM_ACCOUNT_ABOUT_PATH = "/farm/account/about";
export const FARM_OPERATIONS_PATH = "/farm/operations";
export const FARM_PRODUCTION_HUB_PATH = "/farm/production-hub";
export const FARM_INVENTORY_HUB_PATH = "/farm/inventory-hub";
/** Absolute path to the Farm portal's Egg Production page — real (Supabase-backed), not a placeholder. */
export const FARM_EGG_PRODUCTION_PATH = "/farm/egg-production";
/** Absolute path to Staff Management — real (Supabase-backed), Farm Admin only, not a placeholder. */
export const FARM_STAFF_PATH = "/farm/staff";
/** Absolute path to the Farm portal's Poultry Inventory page — real (Supabase-backed), not a placeholder. */
export const FARM_POULTRY_INVENTORY_PATH = "/farm/inventory";
/** Absolute path to the Farm portal's Notifications page — real (Supabase-backed), not a placeholder. */
export const FARM_NOTIFICATIONS_PATH = "/farm/notifications";
/** Absolute path to the Farm portal's Feed & Vitamins page — real (Supabase-backed), not a placeholder. Farm Admin gets a single combined "Feed & Vitamins" nav entry here; Staff get this same path for feed distribution and a separate one (FARM_VITAMINS_PATH) for vitamin administration. */
export const FARM_FEED_PATH = "/farm/feed";
/** Absolute path to the Farm portal's Vitamins page — real (Supabase-backed), not a placeholder. */
export const FARM_VITAMINS_PATH = "/farm/vitamins";
/** Absolute path to the Farm portal's Health Records page — real (Supabase-backed), not a placeholder. */
export const FARM_HEALTH_PATH = "/farm/health";
/** Absolute path to the Farm portal's Mortality Records page — real (Supabase-backed), not a placeholder. */
export const FARM_MORTALITY_PATH = "/farm/mortality";
/** Absolute path to the Farm portal's Audit Logs page — real (Supabase-backed), not a placeholder. Shared by Farm Admin/Manager ("Audit Logs") and Staff ("My Activity"). */
export const FARM_AUDIT_LOGS_PATH = "/farm/audit-logs";
/** Absolute path to the Farm portal's Sales & Expenses page — real (Supabase-backed), not a placeholder. Farm Admin/Manager only — Staff has no access, same as `feeds`/`vitamins` batch management. */
export const FARM_SALES_EXPENSES_PATH = "/farm/sales";
/** Absolute path to the Farm portal's read-only "My Farm" detail page — real (Supabase-backed), not a placeholder. Farm Admin/Manager only, linked from the Profile page's "My Farm" card. */
export const FARM_PROFILE_PATH = "/farm/profile";

// ── Shared link definitions — reused across roles so paths/icons stay in sync ──
const dashboardLink: NavLink = { type: "link", label: "Dashboard", path: FARM_DASHBOARD_PATH, icon: LayoutDashboard };
const staffManagementLink: NavLink = { type: "link", label: "Staff Management", path: FARM_STAFF_PATH, icon: UsersRound };
const eggProductionLink: NavLink = { type: "link", label: "Egg Production", path: FARM_EGG_PRODUCTION_PATH, icon: Egg };
// One nav entry for the unified Poultry Inventory module (Poultry Stock / Feeds & Vitamins / Mortality tabs) —
// FARM_FEED_PATH/FARM_VITAMINS_PATH/FARM_MORTALITY_PATH still exist as routes (old links/notifications keep
// working, landing on the right tab) but no longer have their own nav entries.
const poultryInventoryLink: NavLink = { type: "link", label: "Poultry Inventory", path: FARM_POULTRY_INVENTORY_PATH, icon: Bird };
const healthLink: NavLink = { type: "link", label: "Health Records", path: FARM_HEALTH_PATH, icon: Stethoscope };
const healthMonitoringLink: NavLink = { type: "link", label: "Health Monitoring", path: FARM_HEALTH_PATH, icon: Stethoscope };
const salesExpensesLink: NavLink = { type: "link", label: "Sales & Expenses", path: FARM_SALES_EXPENSES_PATH, icon: Wallet };
// Points at Sales & Expenses rather than a separate page — that module already has its own full Reports section (Sales/Expense/Financial Summary/Daily/Weekly/Monthly reports), so "Reports" isn't a distinct destination.
const reportsLink: NavLink = { type: "link", label: "Reports", path: FARM_SALES_EXPENSES_PATH, icon: FileChartColumn };
const notificationsLink: NavLink = { type: "link", label: "Notifications", path: FARM_NOTIFICATIONS_PATH, icon: Bell };
const auditLogsLink: NavLink = { type: "link", label: "Audit Logs", path: FARM_AUDIT_LOGS_PATH, icon: Logs };
const activityHistoryLink: NavLink = { type: "link", label: "My Activity", path: FARM_AUDIT_LOGS_PATH, icon: Logs };
const farmProfileLink: NavLink = { type: "link", label: "Farm Profile", path: FARM_PROFILE_PATH, icon: Building2 };

// ── Sidebar content per role ──
// reportsLink is deliberately not listed here — it's the same destination as
// salesExpensesLink (Sales & Expenses already has its own Reports section),
// so the sidebar shows just the one entry. reportsLink still exists as its
// own constant for the mobile bottom nav below, which needs a distinct
// "Reports" tab slot regardless of where it points.
const farmAdminNavigation: NavLink[] = [
  dashboardLink,
  staffManagementLink,
  eggProductionLink,
  poultryInventoryLink,
  healthLink,
  salesExpensesLink,
  notificationsLink,
  auditLogsLink,
  farmProfileLink,
];

// Manager: everything Farm Admin sees except Staff Management — a shift-supervisor
// tier that runs operations/sales/reports but doesn't manage other staff accounts.
const managerNavigation: NavLink[] = farmAdminNavigation.filter((link) => link !== staffManagementLink);

// Staff: the spec's narrower set, with Health Records relabeled. Poultry
// Inventory covers stock/feed/vitamins/mortality behind its own tabs now,
// so this collapses from 4 separate entries (Poultry Inventory, Feed
// Distribution, Vitamins & Medicine, Mortality Records) to 1.
const staffNavigation: NavLink[] = [
  dashboardLink,
  eggProductionLink,
  poultryInventoryLink,
  healthMonitoringLink,
  notificationsLink,
  activityHistoryLink,
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

// ── Account menu (ProfileMenuPage) ──────────────────────────────────────
const accountMenuBase: NavLink[] = [
  { type: "link", label: "My Account", path: FARM_EDIT_PROFILE_PATH, icon: UserRound },
  { type: "link", label: "Security", path: FARM_ACCOUNT_SECURITY_PATH, icon: ShieldCheck },
  { type: "link", label: "Notifications", path: FARM_ACCOUNT_NOTIFICATIONS_PATH, icon: Bell },
  { type: "link", label: "Appearance", path: FARM_ACCOUNT_APPEARANCE_PATH, icon: Palette },
  { type: "link", label: "App Permissions", path: FARM_ACCOUNT_PERMISSIONS_PATH, icon: Smartphone },
];
// Farm Settings links straight at the existing read-only Farm Information
// page (FARM_PROFILE_PATH) — it already covers location/address/status, a
// separate "Farm Location" destination would just duplicate the same fields.
const farmSettingsMenuLink: NavLink = { type: "link", label: "Farm Settings", path: FARM_PROFILE_PATH, icon: Building2 };
const accountMenuTail: NavLink[] = [
  { type: "link", label: "Privacy", path: FARM_ACCOUNT_PRIVACY_PATH, icon: Lock },
  { type: "link", label: "Help & Support", path: FARM_ACCOUNT_HELP_PATH, icon: LifeBuoy },
  { type: "link", label: "About", path: FARM_ACCOUNT_ABOUT_PATH, icon: Info },
];

/** Mobile's Profile-tab menu (ProfileMenuPage) — Farm Settings only for Farm Admin/Manager, matching every other farm-level screen in this app. */
export function getAccountMenuItems(role: UserRole): NavLink[] {
  const farmSettings = role === "Farm Admin" || role === "Manager" ? [farmSettingsMenuLink] : [];
  return [...accountMenuBase, ...farmSettings, ...accountMenuTail];
}

// ── Mobile bottom nav (5 tabs max) — everything else lives behind a hub tab ──
const homeTab: NavLink = { type: "link", label: "Home", path: FARM_DASHBOARD_PATH, icon: House };
const operationsTab: NavLink = { type: "link", label: "Operations", path: FARM_OPERATIONS_PATH, icon: ClipboardList };
const productionHubTab: NavLink = { type: "link", label: "Production", path: FARM_PRODUCTION_HUB_PATH, icon: Egg };
// Points straight at Poultry Inventory rather than the generic hub page — that
// hub now only ever has the one item, so the intermediate hub screen is skipped.
const inventoryHubTab: NavLink = { type: "link", label: "Inventory", path: FARM_POULTRY_INVENTORY_PATH, icon: Boxes };
const profileTab: NavLink = { type: "link", label: "Profile", path: FARM_ACCOUNT_PATH, icon: CircleUserRound };

// Notifications isn't its own bottom tab — the topbar's notification bell
// (always visible, every breakpoint) already covers it, so a duplicate tab
// down here would be redundant. Still excluded from the Operations hub below
// for the same reason: the topbar bell is the one mobile entry point now,
// not nested a second time inside Operations either.
export function getFarmBottomNav(role: UserRole): NavLink[] {
  if (role === "Staff") {
    return [homeTab, productionHubTab, inventoryHubTab, profileTab];
  }
  return [homeTab, operationsTab, reportsLink, profileTab];
}

// Dashboard/Reports/Profile already have their own bottom tab, and
// Notifications is covered by the topbar bell (see getFarmBottomNav) —
// Operations collects everything else so nothing in the sidebar becomes
// unreachable on mobile just because it didn't fit in the bottom bar.
const OPERATIONS_HUB_EXCLUDED_PATHS = new Set([FARM_DASHBOARD_PATH, reportsLink.path, notificationsLink.path]);

export function getOperationsHubItems(role: UserRole): NavLink[] {
  const source = role === "Manager" ? managerNavigation : farmAdminNavigation;
  return source.filter((link) => !OPERATIONS_HUB_EXCLUDED_PATHS.has(link.path));
}

export function getProductionHubItems(): NavLink[] {
  return [eggProductionLink, healthMonitoringLink];
}

export function getInventoryHubItems(): NavLink[] {
  return [poultryInventoryLink];
}
