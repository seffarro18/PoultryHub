import {
  LayoutDashboard,
  UsersRound,
  Egg,
  Bird,
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
  ListChecks,
  Tag,
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
/** Absolute path to the Farm portal's Tasks list — real (Supabase-backed), not a placeholder. Farm Admin/Manager see and assign their farm's tasks; Staff see only tasks assigned to them. */
export const FARM_TASKS_PATH = "/farm/tasks";
export const FARM_INVENTORY_HUB_PATH = "/farm/inventory-hub";
/** Absolute path to the Farm portal's Egg Production page — real (Supabase-backed), not a placeholder. */
export const FARM_EGG_PRODUCTION_PATH = "/farm/egg-production";
/** Absolute path to Staff Management — real (Supabase-backed), Farm Admin only, not a placeholder. */
export const FARM_STAFF_PATH = "/farm/staff";
/** Absolute path to the Farm portal's Poultry Inventory page — real (Supabase-backed), not a placeholder. */
export const FARM_POULTRY_INVENTORY_PATH = "/farm/inventory";
/** Absolute path to the Farm portal's Notifications page — real (Supabase-backed), not a placeholder. Reachable only via the topbar bell now; no sidebar/menu link points here. */
export const FARM_NOTIFICATIONS_PATH = "/farm/notifications";
/** Absolute path to the Farm portal's Feed & Vitamins page — real (Supabase-backed), not a placeholder. Farm Admin gets a single combined "Feed & Vitamins" nav entry here; Staff get this same path for feed distribution and a separate one (FARM_VITAMINS_PATH) for vitamin administration. */
export const FARM_FEED_PATH = "/farm/feed";
/** Absolute path to the Farm portal's Vitamins page — real (Supabase-backed), not a placeholder. */
export const FARM_VITAMINS_PATH = "/farm/vitamins";
/** Absolute path to the Farm portal's Mortality records — an alias route into Poultry Inventory's own "Mortality" tab (same pattern as FARM_FEED_PATH/FARM_VITAMINS_PATH), not a standalone page or sidebar entry. */
export const FARM_MORTALITY_PATH = "/farm/mortality";
/** Absolute path to the Farm portal's Audit Logs page — real (Supabase-backed), not a placeholder. Shared by Farm Admin/Manager ("Audit Logs") and Staff ("My Activity"). */
export const FARM_AUDIT_LOGS_PATH = "/farm/audit-logs";
/** Absolute path to the Farm portal's Sales & Expenses page — real (Supabase-backed), not a placeholder. Farm Admin/Manager only — Staff has no access, same as `feeds`/`vitamins` batch management. */
export const FARM_SALES_EXPENSES_PATH = "/farm/sales";
/** Absolute path to the Farm portal's Egg Pricing page — real (Supabase-backed), not a placeholder. Farm Admin/Manager only — Staff has no Sales access to begin with, so there's no lookup destination for them. */
export const FARM_EGG_PRICING_PATH = "/farm/egg-pricing";
/** Absolute path to the Farm portal's read-only "My Farm" detail page — real (Supabase-backed), not a placeholder. Farm Admin/Manager only, linked from the Profile page's "My Farm" card. */
export const FARM_PROFILE_PATH = "/farm/profile";

// ── Shared link definitions — reused across roles so paths/icons stay in sync ──
const dashboardLink: NavLink = { type: "link", label: "Dashboard", path: FARM_DASHBOARD_PATH, icon: LayoutDashboard };
const tasksLink: NavLink = { type: "link", label: "Tasks", path: FARM_TASKS_PATH, icon: ListChecks };
const staffManagementLink: NavLink = { type: "link", label: "Staff Management", path: FARM_STAFF_PATH, icon: UsersRound };
const eggProductionLink: NavLink = { type: "link", label: "Egg Production", path: FARM_EGG_PRODUCTION_PATH, icon: Egg };
// One nav entry for the unified Poultry Inventory module (Poultry Stock / Feeds & Vitamins / Mortality tabs) —
// FARM_FEED_PATH/FARM_VITAMINS_PATH/FARM_MORTALITY_PATH still exist as routes (old links/notifications keep
// working, landing on the right tab) but no longer have their own nav entries; Mortality's own standalone
// page/sidebar entry was removed as a duplicate of this same tab.
const poultryInventoryLink: NavLink = { type: "link", label: "Poultry Inventory", path: FARM_POULTRY_INVENTORY_PATH, icon: Bird };
const salesExpensesLink: NavLink = { type: "link", label: "Sales & Expenses", path: FARM_SALES_EXPENSES_PATH, icon: Wallet };
const eggPricingLink: NavLink = { type: "link", label: "Egg Pricing", path: FARM_EGG_PRICING_PATH, icon: Tag };
// Points at Sales & Expenses rather than a separate page — that module already has its own full Reports section (Sales/Expense/Financial Summary/Daily/Weekly/Monthly reports), so "Reports" isn't a distinct destination.
const reportsLink: NavLink = { type: "link", label: "Reports", path: FARM_SALES_EXPENSES_PATH, icon: FileChartColumn };
const auditLogsLink: NavLink = { type: "link", label: "Audit Logs", path: FARM_AUDIT_LOGS_PATH, icon: Logs };
const activityHistoryLink: NavLink = { type: "link", label: "My Activity", path: FARM_AUDIT_LOGS_PATH, icon: Logs };
const farmProfileLink: NavLink = { type: "link", label: "Farm Profile", path: FARM_PROFILE_PATH, icon: Building2 };

// ── Sidebar content per role ──
// reportsLink is deliberately not listed here — it's the same destination as
// salesExpensesLink (Sales & Expenses already has its own Reports section),
// so the sidebar shows just the one entry. reportsLink still exists as its
// own constant for the mobile bottom nav below, which needs a distinct
// "Reports" tab slot regardless of where it points.
//
// Notifications and Mortality Records are deliberately not listed here —
// Notifications' only UI is the topbar bell now (still fully functional,
// just no separate sidebar destination), and Mortality lives inside Poultry
// Inventory's own "Mortality" tab instead of a duplicate standalone entry.
const farmAdminNavigation: NavLink[] = [
  dashboardLink,
  tasksLink,
  staffManagementLink,
  eggProductionLink,
  poultryInventoryLink,
  salesExpensesLink,
  eggPricingLink,
  auditLogsLink,
  farmProfileLink,
];

// Manager: everything Farm Admin sees except Staff Management — a shift-supervisor
// tier that runs operations/sales/reports but doesn't manage other staff accounts.
const managerNavigation: NavLink[] = farmAdminNavigation.filter((link) => link !== staffManagementLink);

// Staff: the spec's narrower set. Poultry Inventory covers stock/feed/
// vitamins/mortality behind its own tabs.
const staffNavigation: NavLink[] = [
  dashboardLink,
  tasksLink,
  eggProductionLink,
  poultryInventoryLink,
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
// Points straight at Egg Production rather than a "Production" hub screen — Mortality
// Records lives under Poultry Inventory now, not as a sibling to pick between here, so
// there's nothing left for an intermediate hub to actually choose between.
const productionTab: NavLink = { type: "link", label: "Production", path: FARM_EGG_PRODUCTION_PATH, icon: Egg };
// Points straight at Poultry Inventory rather than the generic hub page — that
// hub now only ever has the one item, so the intermediate hub screen is skipped.
// matchPaths covers Feed/Vitamins/Mortality too — those are separate top-level
// alias routes into this same page (see FARM_FEED_PATH's own doc comment),
// not nested children of FARM_POULTRY_INVENTORY_PATH, so without this the tab
// wouldn't highlight when a Quick Action or notification lands on one of them
// directly instead of via this tab.
const inventoryHubTab: NavLink = {
  type: "link",
  label: "Inventory",
  path: FARM_POULTRY_INVENTORY_PATH,
  icon: Boxes,
  matchPaths: [FARM_POULTRY_INVENTORY_PATH, FARM_FEED_PATH, FARM_VITAMINS_PATH, FARM_MORTALITY_PATH],
};
const profileTab: NavLink = { type: "link", label: "Profile", path: FARM_ACCOUNT_PATH, icon: CircleUserRound };

// Notifications isn't its own bottom tab — the topbar's notification bell
// (always visible, every breakpoint) already covers it, so a duplicate tab
// down here would be redundant. Still excluded from the Operations hub below
// for the same reason: the topbar bell is the one mobile entry point now,
// not nested a second time inside Operations either.
export function getFarmBottomNav(role: UserRole): NavLink[] {
  if (role === "Staff") {
    return [homeTab, tasksLink, productionTab, inventoryHubTab, profileTab];
  }
  // Operations' own matchPaths mirror everything reachable through the hub
  // (see getOperationsHubItems below) plus Inventory's own feed/vitamin/
  // mortality aliases — so landing on any of those pages directly (a Quick
  // Action, a notification link, a deep link) highlights Operations exactly
  // as if the user had drilled in through the hub tab itself. Tasks' own
  // path is deliberately excluded — it already has its own dedicated tab,
  // and including it here would light up two tabs at once.
  const operationsMatchPaths = [
    FARM_OPERATIONS_PATH,
    ...getOperationsHubItems(role)
      .map((item) => item.path)
      .filter((path) => path !== FARM_TASKS_PATH),
    FARM_FEED_PATH,
    FARM_VITAMINS_PATH,
    FARM_MORTALITY_PATH,
  ];
  return [homeTab, tasksLink, { ...operationsTab, matchPaths: operationsMatchPaths }, reportsLink, profileTab];
}

// Explicit, ordered list rather than filtering farmAdminNavigation — Tasks
// already has its own bottom tab too (a deliberate, harmless duplication:
// discoverable both ways, same as this list itself being reachable via the
// "Operations" bottom tab), and needs a specific position here (2nd) that
// differs from its position in the sidebar array. Egg Production is
// deliberately not listed — Farm Admin/Manager have no bottom-nav tab for
// it, so it's kept reachable instead via a "Records" link on the
// Dashboard's Egg Production Trend chart (FarmEggProductionChart.tsx).
const OPERATIONS_HUB_ITEMS: NavLink[] = [
  staffManagementLink,
  tasksLink,
  poultryInventoryLink,
  eggPricingLink,
  auditLogsLink,
  farmProfileLink,
];

export function getOperationsHubItems(role: UserRole): NavLink[] {
  if (role === "Manager") return OPERATIONS_HUB_ITEMS.filter((link) => link !== staffManagementLink);
  return OPERATIONS_HUB_ITEMS;
}

export function getInventoryHubItems(): NavLink[] {
  return [poultryInventoryLink];
}
