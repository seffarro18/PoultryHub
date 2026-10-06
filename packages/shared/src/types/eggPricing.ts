export const EGG_SIZES = ["Peewee", "Small", "Medium", "Large", "X Large", "Jumbo"] as const;
export type EggSize = (typeof EGG_SIZES)[number];

export interface EggPrice {
  farmId: string;
  eggSize: EggSize;
  fullTrayPrice: number;
  halfTrayPrice: number;
  updatedByName: string | null;
  updatedAt: string;
}

/** One row per changed price column — see log_egg_price_history() in 0021_egg_pricing_production_settings.sql. */
export interface EggPriceHistoryEntry {
  id: string;
  farmId: string;
  eggSize: string;
  unitType: "full_tray" | "half_tray";
  previousPrice: number;
  newPrice: number;
  updatedByName: string | null;
  createdAt: string;
}

export interface ProductionSettings {
  farmId: string;
  expectedProductionRate: number;
  updatedByName: string | null;
  updatedAt: string;
}
