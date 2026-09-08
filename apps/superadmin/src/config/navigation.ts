import {
  LayoutDashboard,
  Warehouse,
  Tractor,
  MapPin,
  Users,
  UsersRound,
  ShieldCheck,
  KeyRound,
  Egg,
  Bird,
  Wheat,
  HeartPulse,
  TrendingDown,
  Wallet,
  ChartColumn,
  FileChartColumn,
  PackageSearch,
  Gauge,
  Download,
  Bell,
  Logs,
  DatabaseBackup,
  Settings,
  SlidersHorizontal,
  Palette,
  Lock,
  Mail,
  Database,
  Wrench,
  UserRound,
  LifeBuoy,
  Info,
} from "lucide-react";
import { flattenNavLinks as flattenLinks, type NavEntry, type NavLink } from "@poultryhub/shared/config/navTypes";

export type { NavLink, NavGroup, NavEntry } from "@poultryhub/shared/config/navTypes";

/** Absolute path to the Dashboard Overview route — the only entry with a real page in Phase 1. */
export const DASHBOARD_PATH = "/dashboard";
/** Absolute path to the Farms page — real (Supabase-backed), not a placeholder. */
export const FARMS_PATH = "/dashboard/farms";
/** Absolute path to the Locations page — real (Supabase-backed), not a placeholder. */
export const FARM_LOCATIONS_PATH = "/dashboard/farms/locations";
/** Absolute path to the Profile page — also real in Phase 1 (backed by AuthContext). */
export const PROFILE_PATH = "/dashboard/profile";
/** Absolute path to the Users page — real (Supabase-backed), not a placeholder. */
export const USERS_PATH = "/dashboard/users";
/** Absolute path to the Roles page — real (Supabase-backed), not a placeholder. */
export const ROLES_PATH = "/dashboard/users/roles";
/** Absolute path to the Permissions page — real (Supabase-backed), not a placeholder. */
export const PERMISSIONS_PATH = "/dashboard/users/permissions";
/** Absolute path to the Egg Production page — real (Supabase-backed), not a placeholder. */
export const EGG_PRODUCTION_PATH = "/dashboard/production/eggs";
/** Absolute path to the Poultry Inventory page — real (Supabase-backed), not a placeholder. */
export const POULTRY_INVENTORY_PATH = "/dashboard/production/inventory";
/** Absolute path to the Notifications page — real (Supabase-backed), not a placeholder. */
export const NOTIFICATIONS_PATH = "/dashboard/notifications";
/** Absolute path to the Feeds & Vitamins page — real (Supabase-backed), not a placeholder. */
export const FEED_VITAMIN_PATH = "/dashboard/production/feed";
/** Absolute path to the Health Records page — real (Supabase-backed), not a placeholder. */
export const HEALTH_RECORDS_PATH = "/dashboard/production/health";
/** Absolute path to the Mortality Records page — real (Supabase-backed), not a placeholder. */
export const MORTALITY_RECORDS_PATH = "/dashboard/production/mortality";
/** Absolute path to the Audit Logs page — real (Supabase-backed), not a placeholder. */
export const AUDIT_LOGS_PATH = "/dashboard/audit-logs";
/** Absolute path to the Security Management page — real (Supabase-backed), not a placeholder. */
export const SECURITY_PATH = "/dashboard/settings/security";
/** Absolute path to the General System Settings page — real (Supabase-backed), not a placeholder. */
export const GENERAL_SETTINGS_PATH = "/dashboard/settings/general";
/** Absolute path to the Email Configuration page — real (Supabase-backed), not a placeholder. */
export const EMAIL_CONFIG_PATH = "/dashboard/settings/email";
/** Absolute path to the Sales & Expenses page — real (Supabase-backed), not a placeholder. Consolidates the old separate Sales/Expenses/Revenue placeholders into one module. */
export const SALES_EXPENSES_PATH = "/dashboard/sales";
/** Absolute path to the Backup & Restore page — real (Supabase-backed), not a placeholder. */
export const BACKUP_PATH = "/dashboard/backup";
/** Absolute path to the My Account (edit personal info/password) screen — Profile menu. */
export const PROFILE_EDIT_PATH = "/dashboard/profile/edit";
/** Absolute path to the Security screen (2FA, Active Devices, Login History) — Profile menu. */
export const PROFILE_SECURITY_PATH = "/dashboard/profile/security";
/** Absolute path to the Notifications preferences screen — Profile menu. */
export const PROFILE_NOTIFICATIONS_PATH = "/dashboard/profile/notifications";
/** Absolute path to the Appearance (theme) screen — Profile menu. */
export const PROFILE_APPEARANCE_PATH = "/dashboard/profile/appearance";
/** Absolute path to the Data Privacy screen — Profile menu. */
export const PROFILE_PRIVACY_PATH = "/dashboard/profile/privacy";
/** Absolute path to the Help & Support screen — Profile menu. */
export const PROFILE_HELP_PATH = "/dashboard/profile/help";
/** Absolute path to the About screen — Profile menu. */
export const PROFILE_ABOUT_PATH = "/dashboard/profile/about";

export const navigation: NavEntry[] = [
  { type: "link", label: "Dashboard", path: DASHBOARD_PATH, icon: LayoutDashboard },
  {
    type: "group",
    label: "Farm Management",
    icon: Warehouse,
    children: [
      { type: "link", label: "Farms", path: FARMS_PATH, icon: Tractor },
      { type: "link", label: "Locations", path: FARM_LOCATIONS_PATH, icon: MapPin },
    ],
  },
  {
    type: "group",
    label: "User Management",
    icon: Users,
    children: [
      { type: "link", label: "Users", path: "/dashboard/users", icon: UsersRound },
      { type: "link", label: "Roles", path: "/dashboard/users/roles", icon: ShieldCheck },
      { type: "link", label: "Permissions", path: "/dashboard/users/permissions", icon: KeyRound },
    ],
  },
  {
    type: "group",
    label: "Production",
    icon: Egg,
    children: [
      { type: "link", label: "Egg Production", path: EGG_PRODUCTION_PATH, icon: Egg },
      { type: "link", label: "Poultry Inventory", path: POULTRY_INVENTORY_PATH, icon: Bird },
      { type: "link", label: "Feed & Vitamins", path: FEED_VITAMIN_PATH, icon: Wheat },
      { type: "link", label: "Health Records", path: HEALTH_RECORDS_PATH, icon: HeartPulse },
      { type: "link", label: "Mortality Records", path: MORTALITY_RECORDS_PATH, icon: TrendingDown },
    ],
  },
  { type: "link", label: "Sales & Expenses", path: SALES_EXPENSES_PATH, icon: Wallet },
  {
    type: "group",
    label: "Reports & Analytics",
    icon: ChartColumn,
    children: [
      { type: "link", label: "Production Reports", path: "/dashboard/reports/production", icon: FileChartColumn },
      { type: "link", label: "Inventory Reports", path: "/dashboard/reports/inventory", icon: PackageSearch },
      { type: "link", label: "Farm Performance", path: "/dashboard/reports/farm-performance", icon: Gauge },
      { type: "link", label: "Export Reports", path: "/dashboard/reports/export", icon: Download },
    ],
  },
  { type: "link", label: "Notifications", path: NOTIFICATIONS_PATH, icon: Bell },
  { type: "link", label: "Audit Logs", path: AUDIT_LOGS_PATH, icon: Logs },
  { type: "link", label: "Backup & Restore", path: BACKUP_PATH, icon: DatabaseBackup },
  {
    type: "group",
    label: "System Settings",
    icon: Settings,
    children: [
      { type: "link", label: "General Settings", path: GENERAL_SETTINGS_PATH, icon: SlidersHorizontal },
      { type: "link", label: "Branding", path: "/dashboard/settings/branding", icon: Palette },
      { type: "link", label: "Security", path: SECURITY_PATH, icon: Lock },
      { type: "link", label: "Email Configuration", path: EMAIL_CONFIG_PATH, icon: Mail },
      { type: "link", label: "Database", path: "/dashboard/settings/database", icon: Database },
      { type: "link", label: "Maintenance", path: "/dashboard/settings/maintenance", icon: Wrench },
    ],
  },
];

/** Every navigable leaf, including nested group children — used to generate placeholder routes. */
export function flattenNavLinks(entries: NavEntry[] = navigation) {
  return flattenLinks(entries);
}

/** ProfileMenuPage's rows — no role branching needed, Super Admin is the only role this app serves. No "Farm Settings" entry (mobile's Farm Admin/Manager-only row) — Super Admin has no single assigned farm. */
export const PROFILE_MENU_ITEMS: NavLink[] = [
  { type: "link", label: "My Account", path: PROFILE_EDIT_PATH, icon: UserRound },
  { type: "link", label: "Security", path: PROFILE_SECURITY_PATH, icon: ShieldCheck },
  { type: "link", label: "Notifications", path: PROFILE_NOTIFICATIONS_PATH, icon: Bell },
  { type: "link", label: "Appearance", path: PROFILE_APPEARANCE_PATH, icon: Palette },
  { type: "link", label: "Privacy", path: PROFILE_PRIVACY_PATH, icon: Lock },
  { type: "link", label: "Help & Support", path: PROFILE_HELP_PATH, icon: LifeBuoy },
  { type: "link", label: "About", path: PROFILE_ABOUT_PATH, icon: Info },
];
