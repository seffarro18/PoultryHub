import { supabase } from "./supabaseClient";
import type { ApprovalStatus, HealthRecord, HealthRecordInput } from "../types/health";

interface HealthRecordRow {
  id: string;
  farm_id: string;
  house_pen: string;
  record_date: string;
  disease_condition: string;
  symptoms: string | null;
  affected_birds: number;
  medication: string | null;
  treatment: string | null;
  vaccination: string | null;
  veterinarian: string | null;
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

const HEALTH_RECORD_SELECT = `
  id, farm_id, house_pen, record_date, disease_condition, symptoms, affected_birds,
  medication, treatment, vaccination, veterinarian, recorded_by, status, review_notes,
  reviewed_at, remarks, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name ),
  reviewed_by_profile:profiles!reviewed_by ( name )
`;

function mapHealthRecordRow(row: HealthRecordRow): HealthRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    housePen: row.house_pen,
    recordDate: row.record_date,
    diseaseCondition: row.disease_condition,
    symptoms: row.symptoms,
    affectedBirds: row.affected_birds,
    medication: row.medication,
    treatment: row.treatment,
    vaccination: row.vaccination,
    veterinarian: row.veterinarian,
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

export async function listHealthRecords(): Promise<HealthRecord[]> {
  const { data, error } = await supabase
    .from("health_records")
    .select(HEALTH_RECORD_SELECT)
    .order("record_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as HealthRecordRow[]).map(mapHealthRecordRow);
}

function healthRecordRow(input: HealthRecordInput) {
  return {
    farm_id: input.farmId,
    house_pen: input.housePen,
    record_date: input.recordDate,
    disease_condition: input.diseaseCondition,
    symptoms: input.symptoms,
    affected_birds: input.affectedBirds,
    medication: input.medication,
    treatment: input.treatment,
    vaccination: input.vaccination,
    veterinarian: input.veterinarian,
    remarks: input.remarks,
  };
}

/** Staff logging a new observation — status defaults to 'pending' in the database. */
export async function createHealthRecord(input: HealthRecordInput): Promise<void> {
  const { error } = await supabase.from("health_records").insert(healthRecordRow(input));
  if (error) throw error;
}

/** Farm Admin/Manager recording directly — pre-approved, since they already hold review authority (no self-approval step). */
export async function createApprovedHealthRecord(input: HealthRecordInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("health_records").insert({
    ...healthRecordRow(input),
    status: "approved",
    reviewed_by: auth.user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Correcting a record's data — doesn't touch status. */
export async function updateHealthRecord(id: string, input: HealthRecordInput): Promise<void> {
  const { error } = await supabase.from("health_records").update(healthRecordRow(input)).eq("id", id);
  if (error) throw error;
}

/** Staff correcting a rejected record and resubmitting it — flips status back to pending, clears the reviewer's comment. */
export async function resubmitHealthRecord(id: string, input: HealthRecordInput): Promise<void> {
  const { error } = await supabase
    .from("health_records")
    .update({ ...healthRecordRow(input), status: "pending", review_notes: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function approveHealthRecord(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("health_records")
    .update({ status: "approved", review_notes: null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectHealthRecord(id: string, comment: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("health_records")
    .update({ status: "rejected", review_notes: comment, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const { error } = await supabase.from("health_records").delete().eq("id", id);
  if (error) throw error;
}

// ── Analytics / alerts helpers ──────────────────────────────────────────

export interface FarmHealthAggregate {
  farmId: string;
  farmName: string;
  caseCount: number;
  affectedBirds: number;
}

/** Approved cases only, grouped per farm — feeds both "Disease Cases by Farm" and "Farm Health Comparison" (same aggregation, different chart framing). */
export function aggregateHealthByFarm(records: HealthRecord[]): FarmHealthAggregate[] {
  const totals = new Map<string, FarmHealthAggregate>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const existing = totals.get(r.farmId);
    if (existing) {
      existing.caseCount += 1;
      existing.affectedBirds += r.affectedBirds;
    } else {
      totals.set(r.farmId, { farmId: r.farmId, farmName: r.farmName, caseCount: 1, affectedBirds: r.affectedBirds });
    }
  }
  return [...totals.values()].sort((a, b) => b.affectedBirds - a.affectedBirds);
}

export interface DiseaseCauseAggregate {
  label: string;
  caseCount: number;
  affectedBirds: number;
}

/** Approved cases grouped by disease/condition, across all visible farms. */
export function aggregateHealthByCondition(records: HealthRecord[]): DiseaseCauseAggregate[] {
  const totals = new Map<string, DiseaseCauseAggregate>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const existing = totals.get(r.diseaseCondition);
    if (existing) {
      existing.caseCount += 1;
      existing.affectedBirds += r.affectedBirds;
    } else {
      totals.set(r.diseaseCondition, { label: r.diseaseCondition, caseCount: 1, affectedBirds: r.affectedBirds });
    }
  }
  return [...totals.values()].sort((a, b) => b.affectedBirds - a.affectedBirds);
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

/** Approved affected-birds count bucketed by month (last 12) — covers both "Disease Trends" and "Monthly Health Reports". */
export function aggregateHealthByMonth(records: HealthRecord[]): PeriodPoint[] {
  const buckets = new Map<string, number>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const key = monthBucketKey(r.recordDate);
    buckets.set(key, (buckets.get(key) ?? 0) + r.affectedBirds);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, value]) => ({ label: monthBucketLabel(key), value }));
}

export interface FarmRateAggregate {
  farmId: string;
  farmName: string;
  rate: number;
}

/** % of approved cases per farm with a non-empty vaccination field — "Vaccination Coverage" / the Vaccination Compliance Rate KPI. */
export function vaccinationComplianceByFarm(records: HealthRecord[]): FarmRateAggregate[] {
  return rateByFarm(records, (r) => Boolean(r.vaccination && r.vaccination.trim()));
}

/** % of approved cases per farm with a non-empty treatment field — substitutes for "Recovery Rate", which the schema has no outcome field to compute honestly. */
export function treatmentRateByFarm(records: HealthRecord[]): FarmRateAggregate[] {
  return rateByFarm(records, (r) => Boolean(r.treatment && r.treatment.trim()));
}

function rateByFarm(records: HealthRecord[], predicate: (r: HealthRecord) => boolean): FarmRateAggregate[] {
  const totals = new Map<string, { farmName: string; total: number; matched: number }>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const existing = totals.get(r.farmId) ?? { farmName: r.farmName, total: 0, matched: 0 };
    existing.total += 1;
    if (predicate(r)) existing.matched += 1;
    totals.set(r.farmId, existing);
  }
  return [...totals.entries()]
    .map(([farmId, { farmName, total, matched }]) => ({ farmId, farmName, rate: total > 0 ? Math.round((matched / total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

export interface FollowUpFarm {
  farmId: string;
  farmName: string;
  daysSinceLastVaccination: number | null;
}

/**
 * Live-computed, not a stored notification — "Vaccinations overdue" needs a scheduled job
 * (pg_cron) to detect on a day nothing happens, which this project doesn't use anywhere.
 * Farms with no vaccination on record at all get `null` (shown as "Never recorded").
 */
export function vaccinationFollowUpFarms(records: HealthRecord[], thresholdDays = 60, today = new Date()): FollowUpFarm[] {
  const lastVaccinated = new Map<string, { farmName: string; date: Date }>();
  for (const r of records) {
    if (r.status !== "approved" || !r.vaccination || !r.vaccination.trim()) continue;
    const date = new Date(`${r.recordDate}T00:00:00`);
    const existing = lastVaccinated.get(r.farmId);
    if (!existing || date > existing.date) lastVaccinated.set(r.farmId, { farmName: r.farmName, date });
  }
  const farmNames = new Map<string, string>();
  for (const r of records) farmNames.set(r.farmId, r.farmName);

  return [...farmNames.entries()]
    .map(([farmId, farmName]) => {
      const last = lastVaccinated.get(farmId);
      if (!last) return { farmId, farmName, daysSinceLastVaccination: null };
      const days = Math.round((today.getTime() - last.date.getTime()) / (24 * 60 * 60 * 1000));
      return { farmId, farmName, daysSinceLastVaccination: days };
    })
    .filter((f) => f.daysSinceLastVaccination === null || f.daysSinceLastVaccination > thresholdDays);
}

/** Live-computed — approved cases with no treatment recorded yet ("Treatments are incomplete"). */
export function untreatedOpenCases(records: HealthRecord[]): HealthRecord[] {
  return records.filter((r) => r.status === "approved" && !(r.treatment && r.treatment.trim()));
}
