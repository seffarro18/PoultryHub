export interface Farm {
  id: string;
  name: string;
}

export type ProductionStatus = "pending" | "approved" | "rejected";

export interface EggProductionRecord {
  id: string;
  farmId: string;
  farmName: string;
  productionDate: string;
  housePen: string;
  /** The house/pen actually selected, as a real reference — null only for records saved before this existed. housePen (text) is kept in sync at save time so existing readers of it don't need to change. */
  poultryHouseId: string | null;
  /** Derived from goodEggs via traysForGoodEggs(), not independently entered — see that function. Not rounded (e.g. 70 good eggs = 2.33 trays). */
  numberOfTrays: number;
  eggsCollected: number;
  goodEggs: number;
  peeweeEggs: number;
  smallEggs: number;
  mediumEggs: number;
  largeEggs: number;
  xLargeEggs: number;
  jumboEggs: number;
  damagedCrackedEggs: number;
  eggsSold: number;
  recordedById: string | null;
  recordedByName: string | null;
  notes: string | null;
  status: ProductionStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface EggProductionInput {
  farmId: string;
  productionDate: string;
  housePen: string;
  poultryHouseId: string | null;
  numberOfTrays: number;
  eggsCollected: number;
  goodEggs: number;
  peeweeEggs: number;
  smallEggs: number;
  mediumEggs: number;
  largeEggs: number;
  xLargeEggs: number;
  jumboEggs: number;
  damagedCrackedEggs: number;
  eggsSold: number;
  notes: string | null;
}

/** "Remaining" is derived, not stored — see schema.sql. */
export function remainingEggs(record: Pick<EggProductionRecord, "goodEggs" | "eggsSold">): number {
  return record.goodEggs - record.eggsSold;
}

/** Eggs per tray — a fixed constant, not a per-record or per-farm value. */
export const EGGS_PER_TRAY = 30;

/**
 * Number of Trays is derived from Good Eggs Total, not independently
 * entered — a plain division by EGGS_PER_TRAY, deliberately NOT rounded
 * (70 good eggs = 2.33 trays, not 2 or 3).
 */
export function traysForGoodEggs(goodEggsTotal: number): number {
  return goodEggsTotal / EGGS_PER_TRAY;
}

/** Good Eggs, broken out by size — the record fields Egg Pricing/Sales' 6-size taxonomy is checked against for per-size stock. */
export const GOOD_EGGS_FIELD_BY_SIZE = {
  Peewee: "peeweeEggs",
  Small: "smallEggs",
  Medium: "mediumEggs",
  Large: "largeEggs",
  "X Large": "xLargeEggs",
  Jumbo: "jumboEggs",
} as const satisfies Record<string, keyof EggProductionRecord>;
