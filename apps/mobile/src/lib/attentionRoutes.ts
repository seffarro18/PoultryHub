import type { AttentionItem, AttentionModule } from "@poultryhub/shared/types/attention";
import {
  FARM_EGG_PRODUCTION_PATH,
  FARM_FEED_PATH,
  FARM_HEALTH_PATH,
  FARM_MORTALITY_PATH,
  FARM_STAFF_PATH,
  FARM_VITAMINS_PATH,
} from "../config/farmNavigation";

/** Where tapping an attention card's action button should navigate — kept in the app, not the shared service, since route paths are per-app (Super Admin's desktop paths will differ when its dashboard gets this feature). */
export function attentionModulePath(module: AttentionModule): string {
  switch (module) {
    case "egg_production":
      return FARM_EGG_PRODUCTION_PATH;
    case "feed_inventory":
      return FARM_FEED_PATH;
    case "vitamin_inventory":
      return FARM_VITAMINS_PATH;
    case "health_records":
      return FARM_HEALTH_PATH;
    case "mortality_records":
      return FARM_MORTALITY_PATH;
    case "staff_management":
      return FARM_STAFF_PATH;
  }
}

/** Farm Admin/Manager's category filter pills — "Inventory" groups feed+vitamin the way the spec's own filter list does, even though they're separate modules internally (separate icons/routes). Manager gets no "Staff" pill since they have no staff-management access. */
export function farmAdminAttentionCategories(includeStaff: boolean): { value: string; label: string }[] {
  return [
    { value: "all", label: "All" },
    { value: "egg_production", label: "Egg Production" },
    { value: "inventory", label: "Inventory" },
    { value: "health_records", label: "Health" },
    { value: "mortality_records", label: "Mortality" },
    ...(includeStaff ? [{ value: "staff_management", label: "Staff" }] : []),
  ];
}

export function farmAdminMatchesCategory(item: AttentionItem, category: string): boolean {
  if (category === "inventory") return item.module === "feed_inventory" || item.module === "vitamin_inventory";
  return item.module === category;
}
