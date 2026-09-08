import type { BirdType } from "./poultryInventory";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface MortalityRecord {
  id: string;
  farmId: string;
  farmName: string;
  housePen: string;
  recordDate: string;
  /** Nullable — existing rows predate this field; new submissions require it at the form layer. Also what lets approved mortality subtract from stock per bird type. */
  birdType: BirdType | null;
  deadBirds: number;
  causeOfDeath: string;
  disposalMethod: string | null;
  veterinarianConfirmation: string | null;
  photoUrl: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  status: ApprovalStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface MortalityRecordInput {
  farmId: string;
  housePen: string;
  recordDate: string;
  birdType: BirdType | null;
  deadBirds: number;
  causeOfDeath: string;
  disposalMethod: string | null;
  veterinarianConfirmation: string | null;
  photoUrl: string | null;
  remarks: string | null;
}
