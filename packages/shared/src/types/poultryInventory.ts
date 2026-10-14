// "Chick" removed — PoultryHub is a layer-chicken-only system, and chick
// (pre-layer) inventory is no longer a tracked concept anywhere in the app.
// Existing historical bird_type='Chick' rows, if any, are left untouched in
// the database; this union just stops the application from creating,
// displaying, or offering new ones.
import type { ProductionStatus } from "./eggProduction";

export type BirdType = "Layer" | "Grower" | "Breeder";
export type PoultryEventType = "arrival" | "transfer" | "sale" | "culling" | "mortality" | "count_update";

export const BIRD_TYPES: BirdType[] = ["Layer", "Grower", "Breeder"];

export interface PoultryEvent {
  id: string;
  farmId: string;
  farmName: string;
  eventDate: string;
  birdType: BirdType;
  eventType: PoultryEventType;
  quantity: number;
  fromHousePen: string | null;
  /** Real reference into poultry_houses — null only for events saved before this existed. fromHousePen (text) is kept in sync at save time so existing readers of it don't need to change. */
  fromHousePenId: string | null;
  toHousePen: string | null;
  /** Same as fromHousePenId, for the destination pen. */
  toHousePenId: string | null;
  notes: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  createdAt: string;
  /** Batch-descriptive fields — meaningful mainly on "arrival" rows, blank elsewhere. */
  breed: string | null;
  /** Layer age in weeks (1-100), selected from a fixed dropdown — never free text. */
  ageWeeks: number | null;
  source: string | null;
  /** The BIRD status (Active / Sold / Culled / Transferred) — derived from eventType. Not the review state; see reviewStatus. */
  status: string | null;
  /** Approval lifecycle. Only "approved" events count toward official stock — Staff submissions start "pending" (enforced by a database trigger, not the client). */
  reviewStatus: ProductionStatus;
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface PoultryEventInput {
  farmId: string;
  eventDate: string;
  birdType: BirdType;
  eventType: PoultryEventType;
  quantity: number;
  fromHousePen: string | null;
  fromHousePenId: string | null;
  toHousePen: string | null;
  toHousePenId: string | null;
  notes: string | null;
  breed: string | null;
  ageWeeks: number | null;
  source: string | null;
  status: string | null;
}
