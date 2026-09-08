import { supabase } from "./supabaseClient";
import type { BirdType } from "../types/poultryInventory";
import type { ApprovalStatus, MortalityRecord, MortalityRecordInput } from "../types/mortality";
import type { FarmStockTotal } from "./poultryInventoryService";

interface MortalityRecordRow {
  id: string;
  farm_id: string;
  house_pen: string;
  record_date: string;
  bird_type: BirdType | null;
  dead_birds: number;
  cause_of_death: string;
  disposal_method: string | null;
  veterinarian_confirmation: string | null;
  photo_url: string | null;
  recorded_by: string | null;
  status: ApprovalStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
  reviewed_by_profile: { name: string } | null;
}

const MORTALITY_RECORD_SELECT = `
  id, farm_id, house_pen, record_date, bird_type, dead_birds, cause_of_death, disposal_method,
  veterinarian_confirmation, photo_url, recorded_by, status, review_notes,
  reviewed_at, remarks, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name ),
  reviewed_by_profile:profiles!reviewed_by ( name )
`;

function mapMortalityRecordRow(row: MortalityRecordRow): MortalityRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    housePen: row.house_pen,
    recordDate: row.record_date,
    birdType: row.bird_type,
    deadBirds: row.dead_birds,
    causeOfDeath: row.cause_of_death,
    disposalMethod: row.disposal_method,
    veterinarianConfirmation: row.veterinarian_confirmation,
    photoUrl: row.photo_url,
    recordedById: row.recorded_by,
    recordedByName: row.recorded_by_profile?.name ?? null,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedByName: row.reviewed_by_profile?.name ?? null,
    reviewedAt: row.reviewed_at,
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

export async function listMortalityRecords(): Promise<MortalityRecord[]> {
  const { data, error } = await supabase
    .from("mortality_records")
    .select(MORTALITY_RECORD_SELECT)
    .order("record_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as MortalityRecordRow[]).map(mapMortalityRecordRow);
}

function mortalityRecordRow(input: MortalityRecordInput) {
  return {
    farm_id: input.farmId,
    house_pen: input.housePen,
    record_date: input.recordDate,
    bird_type: input.birdType,
    dead_birds: input.deadBirds,
    cause_of_death: input.causeOfDeath,
    disposal_method: input.disposalMethod,
    veterinarian_confirmation: input.veterinarianConfirmation,
    photo_url: input.photoUrl,
    remarks: input.remarks,
  };
}

/** Staff logging a new mortality report — status defaults to 'pending' in the database. */
export async function createMortalityRecord(input: MortalityRecordInput): Promise<void> {
  const { error } = await supabase.from("mortality_records").insert(mortalityRecordRow(input));
  if (error) throw error;
}

/** Farm Admin/Manager recording directly — pre-approved, since they already hold review authority. */
export async function createApprovedMortalityRecord(input: MortalityRecordInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("mortality_records").insert({
    ...mortalityRecordRow(input),
    status: "approved",
    reviewed_by: auth.user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function updateMortalityRecord(id: string, input: MortalityRecordInput): Promise<void> {
  const { error } = await supabase.from("mortality_records").update(mortalityRecordRow(input)).eq("id", id);
  if (error) throw error;
}

/** Staff correcting a rejected record and resubmitting it — flips status back to pending, clears the reviewer's comment. */
export async function resubmitMortalityRecord(id: string, input: MortalityRecordInput): Promise<void> {
  const { error } = await supabase
    .from("mortality_records")
    .update({ ...mortalityRecordRow(input), status: "pending", review_notes: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function approveMortalityRecord(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("mortality_records")
    .update({ status: "approved", review_notes: null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectMortalityRecord(id: string, comment: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("mortality_records")
    .update({ status: "rejected", review_notes: comment, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMortalityRecord(id: string): Promise<void> {
  const { error } = await supabase.from("mortality_records").delete().eq("id", id);
  if (error) throw error;
}

// ── Photo evidence (optional) ───────────────────────────────────────────

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Uploads to the private mortality-photos bucket under a farm-scoped folder (RLS reads the folder prefix). Returns the storage path, not a public URL — nothing here is publicly reachable. */
export async function uploadMortalityPhoto(file: File, farmId: string): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error("Photo must be a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be 5MB or smaller.");
  }

  const extension = file.name.split(".").pop() ?? "jpg";
  const path = `${farmId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("mortality-photos").upload(path, file);
  if (error) throw error;

  return path;
}

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

/** Short-lived signed URL for a private mortality photo — regenerated on each view, never cached as a public link. */
export async function getMortalityPhotoSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("mortality-photos").createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

// ── Analytics / alerts helpers ──────────────────────────────────────────

export interface FarmMortalityAggregate {
  farmId: string;
  farmName: string;
  deathCount: number;
  deadBirds: number;
}

/** Approved records only, grouped per farm — feeds "Farm Mortality Comparison". */
export function aggregateMortalityByFarm(records: MortalityRecord[]): FarmMortalityAggregate[] {
  const totals = new Map<string, FarmMortalityAggregate>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const existing = totals.get(r.farmId);
    if (existing) {
      existing.deathCount += 1;
      existing.deadBirds += r.deadBirds;
    } else {
      totals.set(r.farmId, { farmId: r.farmId, farmName: r.farmName, deathCount: 1, deadBirds: r.deadBirds });
    }
  }
  return [...totals.values()].sort((a, b) => b.deadBirds - a.deadBirds);
}

export interface CauseAggregate {
  label: string;
  deadBirds: number;
}

/** Approved records grouped by cause of death — "Mortality by Cause". */
export function aggregateMortalityByCause(records: MortalityRecord[]): CauseAggregate[] {
  const totals = new Map<string, number>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    totals.set(r.causeOfDeath, (totals.get(r.causeOfDeath) ?? 0) + r.deadBirds);
  }
  return [...totals.entries()].map(([label, deadBirds]) => ({ label, deadBirds })).sort((a, b) => b.deadBirds - a.deadBirds);
}

export interface PeriodPoint {
  label: string;
  value: number;
}

function monthBucketKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBucketLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Approved dead-bird count bucketed by month (last 12) — covers both "Mortality Trends" and "Monthly Mortality Reports". */
export function aggregateMortalityByMonth(records: MortalityRecord[]): PeriodPoint[] {
  const buckets = new Map<string, number>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const key = monthBucketKey(r.recordDate);
    buckets.set(key, (buckets.get(key) ?? 0) + r.deadBirds);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, value]) => ({ label: monthBucketLabel(key), value }));
}

export interface FarmMortalityRate {
  farmId: string;
  farmName: string;
  deadBirds: number;
  currentStock: number;
  ratePercent: number;
}

/**
 * Real percentage, not a raw count — dead birds (approved, trailing `days`) divided by the
 * farm's current stock. Reads poultry_inventory_events for the stock denominator only (a
 * read-only cross-reference, via the caller-supplied stockTotals from
 * poultryInventoryService.ts's currentStockByFarm) — no write coupling between the two
 * independent mortality-tracking systems.
 */
export function mortalityRateByFarm(records: MortalityRecord[], stockTotals: FarmStockTotal[], days = 30, today = new Date()): FarmMortalityRate[] {
  const cutoff = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const deaths = new Map<string, { farmName: string; deadBirds: number }>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    if (new Date(`${r.recordDate}T00:00:00`) < cutoff) continue;
    const existing = deaths.get(r.farmId) ?? { farmName: r.farmName, deadBirds: 0 };
    existing.deadBirds += r.deadBirds;
    deaths.set(r.farmId, existing);
  }

  const stockByFarm = new Map(stockTotals.map((s) => [s.farmId, s]));

  return [...deaths.entries()]
    .map(([farmId, { farmName, deadBirds }]) => {
      const stock = stockByFarm.get(farmId)?.totalStock ?? 0;
      const ratePercent = stock > 0 ? Math.round((deadBirds / stock) * 1000) / 10 : 0;
      return { farmId, farmName, deadBirds, currentStock: stock, ratePercent };
    })
    .sort((a, b) => b.ratePercent - a.ratePercent);
}
