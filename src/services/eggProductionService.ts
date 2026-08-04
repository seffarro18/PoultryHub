import { supabase } from "./supabaseClient";
import type { EggProductionInput, EggProductionRecord, Farm, ProductionStatus } from "../types/eggProduction";

interface EggProductionRow {
  id: string;
  farm_id: string;
  production_date: string;
  house_pen: string;
  layer_count: number;
  eggs_collected: number;
  good_eggs: number;
  cracked_eggs: number;
  damaged_eggs: number;
  eggs_sold: number;
  recorded_by: string | null;
  notes: string | null;
  status: ProductionStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
  reviewed_by_profile: { name: string } | null;
}

function mapRow(row: EggProductionRow): EggProductionRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    productionDate: row.production_date,
    housePen: row.house_pen,
    layerCount: row.layer_count,
    eggsCollected: row.eggs_collected,
    goodEggs: row.good_eggs,
    crackedEggs: row.cracked_eggs,
    damagedEggs: row.damaged_eggs,
    eggsSold: row.eggs_sold,
    recordedById: row.recorded_by,
    recordedByName: row.recorded_by_profile?.name ?? null,
    notes: row.notes,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedByName: row.reviewed_by_profile?.name ?? null,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function listFarms(): Promise<Farm[]> {
  const { data, error } = await supabase.from("farms").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createFarm(name: string): Promise<Farm> {
  const { data, error } = await supabase.from("farms").insert({ name }).select("id, name").single();
  if (error) throw error;
  return data;
}

const RECORD_SELECT = `
  id, farm_id, production_date, house_pen, layer_count, eggs_collected,
  good_eggs, cracked_eggs, damaged_eggs, eggs_sold, recorded_by, notes,
  status, review_notes, reviewed_at, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name ),
  reviewed_by_profile:profiles!reviewed_by ( name )
`;

export async function listEggProductionRecords(): Promise<EggProductionRecord[]> {
  const { data, error } = await supabase
    .from("egg_production")
    .select(RECORD_SELECT)
    .order("production_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as EggProductionRow[]).map(mapRow);
}

function toRow(input: EggProductionInput) {
  return {
    farm_id: input.farmId,
    production_date: input.productionDate,
    house_pen: input.housePen,
    layer_count: input.layerCount,
    eggs_collected: input.eggsCollected,
    good_eggs: input.goodEggs,
    cracked_eggs: input.crackedEggs,
    damaged_eggs: input.damagedEggs,
    eggs_sold: input.eggsSold,
    notes: input.notes,
  };
}

/** Staff logging a new record — status defaults to 'pending' in the database. */
export async function createEggProductionRecord(input: EggProductionInput): Promise<void> {
  const { error } = await supabase.from("egg_production").insert(toRow(input));
  if (error) throw error;
}

/** Farm Admin/Manager correcting a record's data — doesn't touch status. */
export async function updateEggProductionRecord(id: string, input: EggProductionInput): Promise<void> {
  const { error } = await supabase.from("egg_production").update(toRow(input)).eq("id", id);
  if (error) throw error;
}

/** Staff correcting a rejected record and resubmitting it — flips status back to pending, clears the reviewer's comment. */
export async function resubmitEggProductionRecord(id: string, input: EggProductionInput): Promise<void> {
  const { error } = await supabase
    .from("egg_production")
    .update({ ...toRow(input), status: "pending", review_notes: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function approveEggProductionRecord(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("egg_production")
    .update({ status: "approved", review_notes: null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectEggProductionRecord(id: string, comment: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("egg_production")
    .update({ status: "rejected", review_notes: comment, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Sums of eggs collected for Today / This Week (Mon-start) / This Month, from an already-fetched record list. */
export function summarizePeriods(records: EggProductionRecord[], today = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekday = (startOfDay.getDay() + 6) % 7; // 0 = Monday
  const startOfWeek = new Date(startOfDay.getTime() - weekday * dayMs);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let dailyTotal = 0;
  let weeklyTotal = 0;
  let monthlyTotal = 0;

  for (const record of records) {
    const recordDate = new Date(`${record.productionDate}T00:00:00`);
    if (recordDate >= startOfDay) dailyTotal += record.eggsCollected;
    if (recordDate >= startOfWeek) weeklyTotal += record.eggsCollected;
    if (recordDate >= startOfMonth) monthlyTotal += record.eggsCollected;
  }

  return { dailyTotal, weeklyTotal, monthlyTotal };
}

export interface PeriodAggregate {
  period: string;
  collected: number;
  broken: number;
  damaged: number;
  sold: number;
  remaining: number;
}

type PeriodUnit = "day" | "week" | "month" | "year";

function bucketKey(date: Date, unit: PeriodUnit): string {
  if (unit === "year") return `${date.getFullYear()}`;
  if (unit === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (unit === "week") {
    const weekday = (date.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(date.getTime() - weekday * 24 * 60 * 60 * 1000);
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function formatPeriodLabel(key: string, unit: PeriodUnit): string {
  if (unit === "year") return key;
  if (unit === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  const date = new Date(`${key}T00:00:00`);
  const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return unit === "week" ? `Wk of ${label}` : label;
}

function aggregateByPeriod(records: EggProductionRecord[], unit: PeriodUnit, recentCount: number): PeriodAggregate[] {
  const buckets = new Map<string, PeriodAggregate>();

  for (const record of records) {
    const key = bucketKey(new Date(`${record.productionDate}T00:00:00`), unit);
    const bucket = buckets.get(key) ?? { period: formatPeriodLabel(key, unit), collected: 0, broken: 0, damaged: 0, sold: 0, remaining: 0 };
    bucket.collected += record.eggsCollected;
    bucket.broken += record.crackedEggs;
    bucket.damaged += record.damagedEggs;
    bucket.sold += record.eggsSold;
    bucket.remaining += record.goodEggs - record.eggsSold;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-recentCount)
    .map(([, bucket]) => bucket);
}

/** Eggs collected/broken/damaged/sold/remaining grouped by day, most recent 14 days that have records. */
export const aggregateByDay = (records: EggProductionRecord[]) => aggregateByPeriod(records, "day", 14);
/** Same, grouped by Monday-start week, most recent 8 weeks. */
export const aggregateByWeek = (records: EggProductionRecord[]) => aggregateByPeriod(records, "week", 8);
/** Same, grouped by calendar month, most recent 6 months. */
export const aggregateByMonth = (records: EggProductionRecord[]) => aggregateByPeriod(records, "month", 6);
/** Same, grouped by calendar year, most recent 5 years. */
export const aggregateByYear = (records: EggProductionRecord[]) => aggregateByPeriod(records, "year", 5);

export interface FarmAggregate {
  farmId: string;
  farmName: string;
  totalCollected: number;
}

/** Total eggs collected per farm, descending — powers Farm Comparison + Top/Low Performers. */
export function aggregateByFarm(records: EggProductionRecord[]): FarmAggregate[] {
  const totals = new Map<string, FarmAggregate>();
  for (const record of records) {
    const existing = totals.get(record.farmId);
    if (existing) existing.totalCollected += record.eggsCollected;
    else totals.set(record.farmId, { farmId: record.farmId, farmName: record.farmName, totalCollected: record.eggsCollected });
  }
  return [...totals.values()].sort((a, b) => b.totalCollected - a.totalCollected);
}
