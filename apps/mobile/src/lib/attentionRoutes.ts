import type { AttentionModule } from "@poultryhub/shared/types/attention";
import {
  FARM_DASHBOARD_PATH,
  FARM_EGG_PRODUCTION_PATH,
  FARM_FEED_PATH,
  FARM_MORTALITY_PATH,
  FARM_STAFF_PATH,
  FARM_TASKS_PATH,
  FARM_VITAMINS_PATH,
} from "../config/farmNavigation";

/**
 * Where tapping an attention card's action button should navigate — kept in
 * the app, not the shared service, since route paths are per-app (Super
 * Admin's desktop paths will differ when its dashboard gets this feature).
 * FARM_MORTALITY_PATH is an alias route into Poultry Inventory's own
 * Mortality tab, not a separate page — mortality_records still lands there
 * correctly. (Health Records was removed from both this app and Super
 * Admin's, and "health_records" no longer exists in the shared
 * AttentionModule type at all — the `default` case below is just a normal
 * fallback now, not a dead branch for a removed module.)
 */
export function attentionModulePath(module: AttentionModule): string {
  switch (module) {
    case "egg_production":
      return FARM_EGG_PRODUCTION_PATH;
    case "feed_inventory":
      return FARM_FEED_PATH;
    case "vitamin_inventory":
      return FARM_VITAMINS_PATH;
    case "mortality_records":
      return FARM_MORTALITY_PATH;
    case "staff_management":
      return FARM_STAFF_PATH;
    case "tasks":
      return FARM_TASKS_PATH;
    default:
      return FARM_DASHBOARD_PATH;
  }
}
