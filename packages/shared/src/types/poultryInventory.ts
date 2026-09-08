export type BirdType = "Layer" | "Chick" | "Grower" | "Breeder";
export type PoultryEventType = "arrival" | "transfer" | "sale" | "mortality" | "count_update";

export const BIRD_TYPES: BirdType[] = ["Layer", "Chick", "Grower", "Breeder"];

export interface PoultryEvent {
  id: string;
  farmId: string;
  farmName: string;
  eventDate: string;
  birdType: BirdType;
  eventType: PoultryEventType;
  quantity: number;
  fromHousePen: string | null;
  toHousePen: string | null;
  notes: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  createdAt: string;
  /** Batch-descriptive fields — meaningful mainly on "arrival" rows, blank elsewhere. */
  breed: string | null;
  ageLabel: string | null;
  source: string | null;
  status: string | null;
}

export interface PoultryEventInput {
  farmId: string;
  eventDate: string;
  birdType: BirdType;
  eventType: PoultryEventType;
  quantity: number;
  fromHousePen: string | null;
  toHousePen: string | null;
  notes: string | null;
  breed: string | null;
  ageLabel: string | null;
  source: string | null;
  status: string | null;
}
