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
  layerCount: number;
  eggsCollected: number;
  goodEggs: number;
  crackedEggs: number;
  damagedEggs: number;
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
  layerCount: number;
  eggsCollected: number;
  goodEggs: number;
  crackedEggs: number;
  damagedEggs: number;
  eggsSold: number;
  notes: string | null;
}

/** "Remaining" is derived, not stored — see schema.sql. */
export function remainingEggs(record: Pick<EggProductionRecord, "goodEggs" | "eggsSold">): number {
  return record.goodEggs - record.eggsSold;
}
