export type FarmStatus = "active" | "inactive" | "archived";

export interface FarmAdminSummary {
  id: string;
  name: string;
}

export interface ManagedFarm {
  id: string;
  name: string;
  owner: string | null;
  /** Street/barangay/building detail line — region/province/city are separate, structured fields below. */
  address: string | null;
  region: string | null;
  province: string | null;
  city: string | null;
  contactNumber: string | null;
  email: string | null;
  farmType: string | null;
  capacity: number | null;
  status: FarmStatus;
  createdAt: string;
  admins: FarmAdminSummary[];
  /** Super-Admin-entered reference code — not auto-generated. */
  farmCode: string | null;
  /** Set from this same Farms module (numeric entry or click-to-pin) — the Locations map is read-only and just displays these. */
  latitude: number | null;
  longitude: number | null;
}

export interface FarmInput {
  name: string;
  owner: string | null;
  address: string | null;
  region: string | null;
  province: string | null;
  city: string | null;
  contactNumber: string | null;
  email: string | null;
  farmType: string | null;
  capacity: number | null;
  farmCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface FarmDeleteImpact {
  productionRecords: number;
  inventoryEvents: number;
  staffCount: number;
}

export const FARM_TYPE_SUGGESTIONS = ["Layer Farm", "Broiler Farm", "Breeder Farm", "Hatchery", "Mixed/Integrated"];
