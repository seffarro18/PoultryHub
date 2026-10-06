import type { BirdType } from "./poultryInventory";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface MortalityRecord {
  id: string;
  farmId: string;
  farmName: string;
  housePen: string;
  /** Real reference into poultry_houses — null only for records saved before this existed. housePen (text) is kept in sync at save time so existing readers of it don't need to change. */
  poultryHouseId: string | null;
  recordDate: string;
  /** Nullable — existing rows predate this field; new submissions require it at the form layer. Also what lets approved mortality subtract from stock per bird type. */
  birdType: BirdType | null;
  deadBirds: number;
  /** Optional now — the Mortality form no longer collects Cause of Death/Disposal Method/Veterinarian Confirmation; these stay nullable purely to keep displaying pre-existing historical records that do have them. */
  causeOfDeath: string | null;
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
  poultryHouseId: string | null;
  recordDate: string;
  birdType: BirdType | null;
  deadBirds: number;
  photoUrl: string | null;
  remarks: string | null;
}
