import { supabase } from "./supabaseClient";
import { BIRD_TYPES, type BirdType, type PoultryEvent, type PoultryEventInput } from "../types/poultryInventory";
import type { MortalityRecord } from "../types/mortality";

export { listFarms, createFarm } from "./eggProductionService";

interface PoultryEventRow {
  id: string;
  farm_id: string;
  event_date: string;
  bird_type: BirdType;
  event_type: PoultryEvent["eventType"];
  quantity: number;
  from_house_pen: string | null;
  to_house_pen: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  breed: string | null;
  age_label: string | null;
  source: string | null;
  status: string | null;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

function mapRow(row: PoultryEventRow): PoultryEvent {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    eventDate: row.event_date,
    birdType: row.bird_type,
    eventType: row.event_type,
    quantity: row.quantity,
    fromHousePen: row.from_house_pen,
    toHousePen: row.to_house_pen,
    notes: row.notes,
    recordedById: row.recorded_by,
    recordedByName: row.recorded_by_profile?.name ?? null,
    createdAt: row.created_at,
    breed: row.breed,
    ageLabel: row.age_label,
    source: row.source,
    status: row.status,
  };
}

const EVENT_SELECT = `
  id, farm_id, event_date, bird_type, event_type, quantity,
  from_house_pen, to_house_pen, notes, recorded_by, created_at,
  breed, age_label, source, status,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name )
`;

export async function listInventoryEvents(): Promise<PoultryEvent[]> {
  const { data, error } = await supabase
    .from("poultry_inventory_events")
    .select(EVENT_SELECT)
    .order("event_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PoultryEventRow[]).map(mapRow);
}

function toRow(input: PoultryEventInput) {
  return {
    farm_id: input.farmId,
    event_date: input.eventDate,
    bird_type: input.birdType,
    event_type: input.eventType,
    quantity: input.quantity,
    from_house_pen: input.fromHousePen,
    to_house_pen: input.toHousePen,
    notes: input.notes,
    breed: input.breed,
    age_label: input.ageLabel,
    source: input.source,
    status: input.status,
  };
}

export async function createInventoryEvent(input: PoultryEventInput): Promise<void> {
  const { error } = await supabase.from("poultry_inventory_events").insert(toRow(input));
  if (error) throw error;
}

export async function updateInventoryEvent(id: string, input: PoultryEventInput): Promise<void> {
  const { error } = await supabase.from("poultry_inventory_events").update(toRow(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryEvent(id: string): Promise<void> {
  const { error } = await supabase.from("poultry_inventory_events").delete().eq("id", id);
  if (error) throw error;
}

export async function getStaffCanDeleteInventory(farmId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("farms")
    .select("staff_can_delete_inventory")
    .eq("id", farmId)
    .single();
  if (error) throw error;
  return data.staff_can_delete_inventory;
}

export async function setStaffCanDeleteInventory(farmId: string, allowed: boolean): Promise<void> {
  const { error } = await supabase
    .from("farms")
    .update({ staff_can_delete_inventory: allowed })
    .eq("id", farmId);
  if (error) throw error;
}

/**
 * Approved mortality_records, totalled two ways: by bird type (only records
 * that have one — older rows predate the field and can't be attributed) and
 * by farm (every approved record counts, regardless of bird type). Shared by
 * currentStockByType/currentStockByFarm below — this is the one place
 * "approved mortality" actually gets read out of the dedicated Mortality
 * module and folded into the stock figure, closing the gap where approving
 * a mortality record used to have no effect on official stock at all.
 */
function approvedMortalityTotals(mortalityRecords: MortalityRecord[]): {
  byType: Partial<Record<BirdType, number>>;
  byFarm: Map<string, number>;
} {
  const byType: Partial<Record<BirdType, number>> = {};
  const byFarm = new Map<string, number>();
  for (const record of mortalityRecords) {
    if (record.status !== "approved") continue;
    if (record.birdType) byType[record.birdType] = (byType[record.birdType] ?? 0) + record.deadBirds;
    byFarm.set(record.farmId, (byFarm.get(record.farmId) ?? 0) + record.deadBirds);
  }
  return { byType, byFarm };
}

/**
 * Current stock per bird type = arrivals + count-update corrections − sales
 * − approved mortality (from mortality_records, not this event log —
 * see approvedMortalityTotals). Transfers move pens, not the farm total, so
 * they're excluded. The event log's own 'mortality' event type is
 * deliberately excluded too: it's a deprecated, unreviewed path superseded
 * by the Mortality tab's real approval workflow — new ones can no longer be
 * created, but historical rows are left in place and simply ignored here.
 */
export function currentStockByType(events: PoultryEvent[], mortalityRecords: MortalityRecord[] = []): Record<BirdType, number> {
  const totals = Object.fromEntries(BIRD_TYPES.map((type) => [type, 0])) as Record<BirdType, number>;
  for (const event of events) {
    if (event.eventType === "transfer" || event.eventType === "mortality") continue;
    const signed = event.eventType === "sale" ? -event.quantity : event.quantity;
    totals[event.birdType] += signed;
  }
  const { byType } = approvedMortalityTotals(mortalityRecords);
  for (const type of BIRD_TYPES) {
    totals[type] -= byType[type] ?? 0;
  }
  return totals;
}

export interface FarmStockTotal {
  farmId: string;
  farmName: string;
  totalStock: number;
}

/** Total stock (all bird types) per farm, descending — same formula as currentStockByType, aggregated by farm instead of type. */
export function currentStockByFarm(events: PoultryEvent[], mortalityRecords: MortalityRecord[] = []): FarmStockTotal[] {
  const totals = new Map<string, FarmStockTotal>();
  for (const event of events) {
    if (event.eventType === "transfer" || event.eventType === "mortality") continue;
    const signed = event.eventType === "sale" ? -event.quantity : event.quantity;
    const existing = totals.get(event.farmId);
    if (existing) existing.totalStock += signed;
    else totals.set(event.farmId, { farmId: event.farmId, farmName: event.farmName, totalStock: signed });
  }
  const { byFarm } = approvedMortalityTotals(mortalityRecords);
  for (const [farmId, dead] of byFarm) {
    const existing = totals.get(farmId);
    if (existing) existing.totalStock -= dead;
  }
  return [...totals.values()].sort((a, b) => b.totalStock - a.totalStock);
}

export interface MortalityAlert {
  farmId: string;
  farmName: string;
  mortality7d: number;
  currentStock: number;
  ratePercent: number;
}

const MORTALITY_ALERT_THRESHOLD_PERCENT = 5;

/** Farms whose approved mortality in the last 7 days exceeds 5% of their current stock. */
export function mortalityAlerts(events: PoultryEvent[], mortalityRecords: MortalityRecord[] = [], today = new Date()): MortalityAlert[] {
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stockByFarm = new Map(currentStockByFarm(events, mortalityRecords).map((f) => [f.farmId, f]));
  const mortalityByFarm = new Map<string, number>();

  for (const record of mortalityRecords) {
    if (record.status !== "approved") continue;
    if (new Date(`${record.recordDate}T00:00:00`) < sevenDaysAgo) continue;
    mortalityByFarm.set(record.farmId, (mortalityByFarm.get(record.farmId) ?? 0) + record.deadBirds);
  }

  const alerts: MortalityAlert[] = [];
  for (const [farmId, mortality7d] of mortalityByFarm) {
    const farm = stockByFarm.get(farmId);
    if (!farm || farm.totalStock <= 0) continue;
    const ratePercent = (mortality7d / farm.totalStock) * 100;
    if (ratePercent > MORTALITY_ALERT_THRESHOLD_PERCENT) {
      alerts.push({ farmId, farmName: farm.farmName, mortality7d, currentStock: farm.totalStock, ratePercent });
    }
  }
  return alerts.sort((a, b) => b.ratePercent - a.ratePercent);
}

export interface DailyArrivalsMortality {
  label: string;
  arrivals: number;
  mortality: number;
}

/** Arrivals (events) vs. approved mortality (mortality_records) per day, most recent 30 days that have activity. */
export function aggregateArrivalsVsMortalityByDay(events: PoultryEvent[], mortalityRecords: MortalityRecord[] = []): DailyArrivalsMortality[] {
  const buckets = new Map<string, DailyArrivalsMortality>();

  const bucketFor = (dateStr: string) =>
    buckets.get(dateStr) ?? {
      label: new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      arrivals: 0,
      mortality: 0,
    };

  for (const event of events) {
    if (event.eventType !== "arrival") continue;
    const bucket = bucketFor(event.eventDate);
    bucket.arrivals += event.quantity;
    buckets.set(event.eventDate, bucket);
  }
  for (const record of mortalityRecords) {
    if (record.status !== "approved") continue;
    const bucket = bucketFor(record.recordDate);
    bucket.mortality += record.deadBirds;
    buckets.set(record.recordDate, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([, bucket]) => bucket);
}
