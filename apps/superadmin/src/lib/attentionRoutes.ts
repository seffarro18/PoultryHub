import type { AttentionModule } from "@poultryhub/shared/types/attention";
import { FEED_VITAMIN_PATH, MORTALITY_RECORDS_PATH } from "../config/navigation";

/** Where tapping an attention card's action button navigates. Only the two modules Super Admin's aggregation actually surfaces (see attentionService.ts's listSuperAdminAttentionItems doc comment for why egg production/staff aren't included here — health_records was removed along with the Health Records module). MORTALITY_RECORDS_PATH now aliases into Poultry Inventory's own "Mortality" tab rather than a standalone page. */
export function attentionModulePath(module: AttentionModule): string {
  switch (module) {
    case "feed_inventory":
    case "vitamin_inventory":
      return FEED_VITAMIN_PATH;
    case "mortality_records":
      return MORTALITY_RECORDS_PATH;
    case "egg_production":
    case "staff_management":
    case "tasks":
      // Not produced by listSuperAdminAttentionItems() today — kept exhaustive so a future addition can't silently fall through.
      return FEED_VITAMIN_PATH;
  }
}
