export const EGG_SIZES = ["Peewee", "Small", "Medium", "Large", "X Large", "Jumbo", "Super Jumbo"] as const;
export type EggSize = (typeof EGG_SIZES)[number];

export interface EggPrice {
  farmId: string;
  eggSize: EggSize;
  /** null = not configured (e.g. a newly added size like Super Jumbo) — that unit can't be sold until a Farm Admin sets it. */
  fullTrayPrice: number | null;
  halfTrayPrice: number | null;
  /** null = not configured — Piece sales are disabled for this size until a Farm Admin sets it (never derived from the tray prices). */
  piecePrice: number | null;
  updatedByName: string | null;
  updatedAt: string;
}

/** Eggs per sale unit — the only conversion table; the database's egg_unit_size() mirrors it (0046). */
export const EGGS_PER_UNIT = { "Full Tray": 30, "Half Tray": 15, Piece: 1 } as const;
export type EggSaleUnit = keyof typeof EGGS_PER_UNIT;
export const EGG_SALE_UNITS = Object.keys(EGGS_PER_UNIT) as EggSaleUnit[];
export type EggUnitCode = "full_tray" | "half_tray" | "piece";
export const EGG_UNIT_CODE: Record<EggSaleUnit, EggUnitCode> = { "Full Tray": "full_tray", "Half Tray": "half_tray", Piece: "piece" };
export const EGG_UNIT_LABEL: Record<EggUnitCode, EggSaleUnit> = { full_tray: "Full Tray", half_tray: "Half Tray", piece: "Piece" };

/** "2 Full Trays", "1 Half Tray", "10 Pieces". */
export function formatEggUnitQuantity(quantity: number, unit: EggUnitCode): string {
  const label = EGG_UNIT_LABEL[unit];
  if (quantity === 1) return `1 ${label}`;
  return `${quantity.toLocaleString()} ${label === "Piece" ? "Pieces" : `${label}s`}`;
}

/** The configured price for a size+unit, or null when that price isn't set (Piece only). */
export function priceForUnit(price: EggPrice | undefined, unit: EggSaleUnit): number | null {
  if (!price) return null;
  if (unit === "Full Tray") return price.fullTrayPrice;
  if (unit === "Half Tray") return price.halfTrayPrice;
  return price.piecePrice;
}

/** Display-only split of a piece count into full trays, a half tray and loose eggs (76 = 2x30 + 15 + 1). */
export function splitEggCount(eggs: number): { fullTrays: number; halfTrays: number; loose: number } {
  const whole = Math.max(Math.floor(eggs), 0);
  const fullTrays = Math.floor(whole / 30);
  const rest = whole - fullTrays * 30;
  const halfTrays = Math.floor(rest / 15);
  return { fullTrays, halfTrays, loose: rest - halfTrays * 15 };
}

/** One row per changed price column — see log_egg_price_history() in 0021_egg_pricing_production_settings.sql. */
export interface EggPriceHistoryEntry {
  id: string;
  farmId: string;
  eggSize: string;
  unitType: EggUnitCode;
  /** null when the price was being configured for the first time (per-piece). */
  previousPrice: number | null;
  newPrice: number;
  updatedByName: string | null;
  createdAt: string;
}

export interface ProductionSettings {
  farmId: string;
  expectedProductionRate: number;
  /** How the farm records feed consumption — stock is always kept in sacks either way. */
  feedConsumptionUnit: "sack" | "kg";
  updatedByName: string | null;
  updatedAt: string;
}
