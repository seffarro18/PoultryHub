import {
  LayoutDashboard,
  Warehouse,
  Tractor,
  CircleUserRound,
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
  ShoppingCart,
  Receipt,
  TrendingUp,
  ChartColumn,
  FileChartColumn,
  PackageSearch,
  FileSpreadsheet,
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
} from "lucide-react";
import { flattenNavLinks as flattenLinks, type NavEntry } from "./navTypes";

export type { NavLink, NavGroup, NavEntry } from "./navTypes";

/** Absolute path to the Dashboard Overview route — the only entry with a real page in Phase 1. */
export const DASHBOARD_PATH = "/dashboard";
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

export const navigation: NavEntry[] = [
  { type: "link", label: "Dashboard", path: DASHBOARD_PATH, icon: LayoutDashboard },
  {
    type: "group",
    label: "Farm Management",
    icon: Warehouse,
    children: [
      { type: "link", label: "Farms", path: "/dashboard/farms", icon: Tractor },
      { type: "link", label: "Farm Owners", path: "/dashboard/farms/owners", icon: CircleUserRound },
      { type: "link", label: "Locations", path: "/dashboard/farms/locations", icon: MapPin },
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
      { type: "link", label: "Poultry Inventory", path: "/dashboard/production/inventory", icon: Bird },
      { type: "link", label: "Feed & Vitamins", path: "/dashboard/production/feed", icon: Wheat },
      { type: "link", label: "Health Records", path: "/dashboard/production/health", icon: HeartPulse },
      { type: "link", label: "Mortality Records", path: "/dashboard/production/mortality", icon: TrendingDown },
    ],
  },
  {
    type: "group",
    label: "Sales & Finance",
    icon: Wallet,
    children: [
      { type: "link", label: "Sales", path: "/dashboard/sales", icon: ShoppingCart },
      { type: "link", label: "Expenses", path: "/dashboard/sales/expenses", icon: Receipt },
      { type: "link", label: "Revenue", path: "/dashboard/sales/revenue", icon: TrendingUp },
    ],
  },
  {
    type: "group",
    label: "Reports & Analytics",
    icon: ChartColumn,
    children: [
      { type: "link", label: "Production Reports", path: "/dashboard/reports/production", icon: FileChartColumn },
      { type: "link", label: "Inventory Reports", path: "/dashboard/reports/inventory", icon: PackageSearch },
      { type: "link", label: "Financial Reports", path: "/dashboard/reports/financial", icon: FileSpreadsheet },
      { type: "link", label: "Farm Performance", path: "/dashboard/reports/farm-performance", icon: Gauge },
      { type: "link", label: "Export Reports", path: "/dashboard/reports/export", icon: Download },
    ],
  },
  { type: "link", label: "Notifications", path: "/dashboard/notifications", icon: Bell },
  { type: "link", label: "Audit Logs", path: "/dashboard/audit-logs", icon: Logs },
  { type: "link", label: "Backup & Restore", path: "/dashboard/backup", icon: DatabaseBackup },
  {
    type: "group",
    label: "System Settings",
    icon: Settings,
    children: [
      { type: "link", label: "General Settings", path: "/dashboard/settings/general", icon: SlidersHorizontal },
      { type: "link", label: "Branding", path: "/dashboard/settings/branding", icon: Palette },
      { type: "link", label: "Security", path: "/dashboard/settings/security", icon: Lock },
      { type: "link", label: "Email Configuration", path: "/dashboard/settings/email", icon: Mail },
      { type: "link", label: "Database", path: "/dashboard/settings/database", icon: Database },
      { type: "link", label: "Maintenance", path: "/dashboard/settings/maintenance", icon: Wrench },
    ],
  },
];

/** Every navigable leaf, including nested group children — used to generate placeholder routes. */
export function flattenNavLinks(entries: NavEntry[] = navigation) {
  return flattenLinks(entries);
}
