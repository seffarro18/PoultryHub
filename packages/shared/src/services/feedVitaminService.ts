import { supabase } from "./supabaseClient";
import type {
  ApprovalStatus,
  FeedBatch,
  FeedBatchInput,
  FeedDistributionInput,
  FeedDistributionRecord,
  VitaminAdministrationInput,
  VitaminAdministrationRecord,
  VitaminBatch,
  VitaminBatchInput,
} from "../types/feedVitamin";

// ── Feed batches ────────────────────────────────────────────────────────

interface FeedBatchRow {
  id: string;
  farm_id: string;
  feed_name: string;
  category: string | null;
  brand: string | null;
  batch_number: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  remaining_stock: number;
  minimum_stock_level: number;
  purchase_date: string;
  expiration_date: string | null;
  storage_location: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

const FEED_SELECT = `
  id, farm_id, feed_name, category, brand, batch_number, supplier, quantity, unit,
  remaining_stock, minimum_stock_level, purchase_date, expiration_date, storage_location, remarks, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name )
`;

function mapFeedRow(row: FeedBatchRow): FeedBatch {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    feedName: row.feed_name,
    category: row.category,
    brand: row.brand,
    batchNumber: row.batch_number,
    supplier: row.supplier,
    quantity: row.quantity,
    unit: row.unit,
    remainingStock: row.remaining_stock,
    minimumStockLevel: row.minimum_stock_level,
    purchaseDate: row.purchase_date,
    expirationDate: row.expiration_date,
    storageLocation: row.storage_location,
    remarks: row.remarks,
    recordedByName: row.recorded_by_profile?.name ?? null,
    createdAt: row.created_at,
  };
}

export async function listFeedBatches(): Promise<FeedBatch[]> {
  const { data, error } = await supabase.from("feeds").select(FEED_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as FeedBatchRow[]).map(mapFeedRow);
}

export async function createFeedBatch(input: FeedBatchInput): Promise<void> {
  const { error } = await supabase.from("feeds").insert({
    farm_id: input.farmId,
    feed_name: input.feedName,
    category: input.category,
    brand: input.brand,
    batch_number: input.batchNumber,
    supplier: input.supplier,
    quantity: input.quantity,
    unit: input.unit,
    remaining_stock: input.quantity,
    minimum_stock_level: input.minimumStockLevel,
    purchase_date: input.purchaseDate,
    expiration_date: input.expirationDate,
    storage_location: input.storageLocation,
    remarks: input.remarks,
  });
  if (error) throw error;
}

export async function updateFeedBatch(id: string, input: FeedBatchInput): Promise<void> {
  const { error } = await supabase
    .from("feeds")
    .update({
      feed_name: input.feedName,
      category: input.category,
      brand: input.brand,
      batch_number: input.batchNumber,
      supplier: input.supplier,
      quantity: input.quantity,
      unit: input.unit,
      remaining_stock: input.remainingStock,
      minimum_stock_level: input.minimumStockLevel,
      purchase_date: input.purchaseDate,
      expiration_date: input.expirationDate,
      storage_location: input.storageLocation,
      remarks: input.remarks,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFeedBatch(id: string): Promise<void> {
  const { error } = await supabase.from("feeds").delete().eq("id", id);
  if (error) throw error;
}

// ── Vitamin batches ─────────────────────────────────────────────────────

interface VitaminBatchRow {
  id: string;
  farm_id: string;
  vitamin_name: string;
  category: string | null;
  brand: string | null;
  batch_number: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  remaining_stock: number;
  minimum_stock_level: number;
  purchase_date: string;
  expiration_date: string;
  storage_location: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

const VITAMIN_SELECT = `
  id, farm_id, vitamin_name, category, brand, batch_number, supplier, quantity, unit,
  remaining_stock, minimum_stock_level, purchase_date, expiration_date, storage_location, remarks, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name )
`;

function mapVitaminRow(row: VitaminBatchRow): VitaminBatch {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    vitaminName: row.vitamin_name,
    category: row.category,
    brand: row.brand,
    batchNumber: row.batch_number,
    supplier: row.supplier,
    quantity: row.quantity,
    unit: row.unit,
    remainingStock: row.remaining_stock,
    minimumStockLevel: row.minimum_stock_level,
    purchaseDate: row.purchase_date,
    expirationDate: row.expiration_date,
    storageLocation: row.storage_location,
    remarks: row.remarks,
    recordedByName: row.recorded_by_profile?.name ?? null,
    createdAt: row.created_at,
  };
}

export async function listVitaminBatches(): Promise<VitaminBatch[]> {
  const { data, error } = await supabase.from("vitamins").select(VITAMIN_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as VitaminBatchRow[]).map(mapVitaminRow);
}

export async function createVitaminBatch(input: VitaminBatchInput): Promise<void> {
  const { error } = await supabase.from("vitamins").insert({
    farm_id: input.farmId,
    vitamin_name: input.vitaminName,
    category: input.category,
    brand: input.brand,
    batch_number: input.batchNumber,
    supplier: input.supplier,
    quantity: input.quantity,
    unit: input.unit,
    remaining_stock: input.quantity,
    minimum_stock_level: input.minimumStockLevel,
    purchase_date: input.purchaseDate,
    expiration_date: input.expirationDate,
    storage_location: input.storageLocation,
    remarks: input.remarks,
  });
  if (error) throw error;
}

export async function updateVitaminBatch(id: string, input: VitaminBatchInput): Promise<void> {
  const { error } = await supabase
    .from("vitamins")
    .update({
      vitamin_name: input.vitaminName,
      category: input.category,
      brand: input.brand,
      batch_number: input.batchNumber,
      supplier: input.supplier,
      quantity: input.quantity,
      unit: input.unit,
      remaining_stock: input.remainingStock,
      minimum_stock_level: input.minimumStockLevel,
      purchase_date: input.purchaseDate,
      expiration_date: input.expirationDate,
      storage_location: input.storageLocation,
      remarks: input.remarks,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteVitaminBatch(id: string): Promise<void> {
  const { error } = await supabase.from("vitamins").delete().eq("id", id);
  if (error) throw error;
}

// ── Feed distribution (Staff -> Farm Admin approval workflow) ──────────

interface FeedDistributionRow {
  id: string;
  farm_id: string;
  feed_id: string;
  house_pen: string;
  quantity_used: number;
  unit: string;
  number_of_chickens: number;
  distribution_date: string;
  recorded_by: string | null;
  status: ApprovalStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  feeds: { feed_name: string } | null;
  recorded_by_profile: { name: string } | null;
  reviewed_by_profile: { name: string } | null;
}

const FEED_DISTRIBUTION_SELECT = `
  id, farm_id, feed_id, house_pen, quantity_used, unit, number_of_chickens, distribution_date,
  recorded_by, status, review_notes, reviewed_at, remarks, created_at,
  farms ( name ),
  feeds ( feed_name ),
  recorded_by_profile:profiles!recorded_by ( name ),
  reviewed_by_profile:profiles!reviewed_by ( name )
`;

function mapFeedDistributionRow(row: FeedDistributionRow): FeedDistributionRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    feedId: row.feed_id,
    feedName: row.feeds?.feed_name ?? "Unknown feed",
    housePen: row.house_pen,
    quantityUsed: row.quantity_used,
    unit: row.unit,
    numberOfChickens: row.number_of_chickens,
    distributionDate: row.distribution_date,
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

export async function listFeedDistributionRecords(): Promise<FeedDistributionRecord[]> {
  const { data, error } = await supabase
    .from("feed_distribution")
    .select(FEED_DISTRIBUTION_SELECT)
    .order("distribution_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as FeedDistributionRow[]).map(mapFeedDistributionRow);
}

function feedDistributionRow(input: FeedDistributionInput) {
  return {
    farm_id: input.farmId,
    feed_id: input.feedId,
    house_pen: input.housePen,
    quantity_used: input.quantityUsed,
    unit: input.unit,
    number_of_chickens: input.numberOfChickens,
    distribution_date: input.distributionDate,
    remarks: input.remarks,
  };
}

/** Staff logging a new record — status defaults to 'pending' in the database. */
export async function createFeedDistributionRecord(input: FeedDistributionInput): Promise<void> {
  const { error } = await supabase.from("feed_distribution").insert(feedDistributionRow(input));
  if (error) throw error;
}

/** Farm Admin/Manager correcting a record's data — doesn't touch status; the stock delta trigger reconciles remaining_stock if quantity_used changed on an already-approved row. */
export async function updateFeedDistributionRecord(id: string, input: FeedDistributionInput): Promise<void> {
  const { error } = await supabase.from("feed_distribution").update(feedDistributionRow(input)).eq("id", id);
  if (error) throw error;
}

/** Staff correcting a rejected record and resubmitting it — flips status back to pending, clears the reviewer's comment. */
export async function resubmitFeedDistributionRecord(id: string, input: FeedDistributionInput): Promise<void> {
  const { error } = await supabase
    .from("feed_distribution")
    .update({ ...feedDistributionRow(input), status: "pending", review_notes: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function approveFeedDistributionRecord(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("feed_distribution")
    .update({ status: "approved", review_notes: null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectFeedDistributionRecord(id: string, comment: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("feed_distribution")
    .update({ status: "rejected", review_notes: comment, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Vitamin administration (Staff -> Farm Admin approval workflow) ─────

interface VitaminAdministrationRow {
  id: string;
  farm_id: string;
  vitamin_id: string;
  house_pen: string;
  dosage: string | null;
  quantity_used: number;
  unit: string;
  administration_date: string;
  purpose: string | null;
  recorded_by: string | null;
  status: ApprovalStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  vitamins: { vitamin_name: string } | null;
  recorded_by_profile: { name: string } | null;
  reviewed_by_profile: { name: string } | null;
}

const VITAMIN_ADMINISTRATION_SELECT = `
  id, farm_id, vitamin_id, house_pen, dosage, quantity_used, unit, administration_date, purpose,
  recorded_by, status, review_notes, reviewed_at, remarks, created_at,
  farms ( name ),
  vitamins ( vitamin_name ),
  recorded_by_profile:profiles!recorded_by ( name ),
  reviewed_by_profile:profiles!reviewed_by ( name )
`;

function mapVitaminAdministrationRow(row: VitaminAdministrationRow): VitaminAdministrationRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    vitaminId: row.vitamin_id,
    vitaminName: row.vitamins?.vitamin_name ?? "Unknown vitamin",
    housePen: row.house_pen,
    dosage: row.dosage,
    quantityUsed: row.quantity_used,
    unit: row.unit,
    administrationDate: row.administration_date,
    purpose: row.purpose,
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

export async function listVitaminAdministrationRecords(): Promise<VitaminAdministrationRecord[]> {
  const { data, error } = await supabase
    .from("vitamin_administration")
    .select(VITAMIN_ADMINISTRATION_SELECT)
    .order("administration_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as VitaminAdministrationRow[]).map(mapVitaminAdministrationRow);
}

function vitaminAdministrationRow(input: VitaminAdministrationInput) {
  return {
    farm_id: input.farmId,
    vitamin_id: input.vitaminId,
    house_pen: input.housePen,
    dosage: input.dosage,
    quantity_used: input.quantityUsed,
    unit: input.unit,
    administration_date: input.administrationDate,
    purpose: input.purpose,
    remarks: input.remarks,
  };
}

export async function createVitaminAdministrationRecord(input: VitaminAdministrationInput): Promise<void> {
  const { error } = await supabase.from("vitamin_administration").insert(vitaminAdministrationRow(input));
  if (error) throw error;
}

export async function updateVitaminAdministrationRecord(id: string, input: VitaminAdministrationInput): Promise<void> {
  const { error } = await supabase.from("vitamin_administration").update(vitaminAdministrationRow(input)).eq("id", id);
  if (error) throw error;
}

export async function resubmitVitaminAdministrationRecord(id: string, input: VitaminAdministrationInput): Promise<void> {
  const { error } = await supabase
    .from("vitamin_administration")
    .update({ ...vitaminAdministrationRow(input), status: "pending", review_notes: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function approveVitaminAdministrationRecord(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("vitamin_administration")
    .update({ status: "approved", review_notes: null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectVitaminAdministrationRecord(id: string, comment: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("vitamin_administration")
    .update({ status: "rejected", review_notes: comment, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Pure aggregation / analytics helpers ────────────────────────────────

export interface FarmUsageAggregate {
  farmId: string;
  farmName: string;
  totalUsed: number;
}

/** Total quantity_used per farm, approved records only, descending. */
export function aggregateFeedByFarm(records: FeedDistributionRecord[]): FarmUsageAggregate[] {
  const totals = new Map<string, FarmUsageAggregate>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const existing = totals.get(r.farmId);
    if (existing) existing.totalUsed += r.quantityUsed;
    else totals.set(r.farmId, { farmId: r.farmId, farmName: r.farmName, totalUsed: r.quantityUsed });
  }
  return [...totals.values()].sort((a, b) => b.totalUsed - a.totalUsed);
}

export function aggregateVitaminByFarm(records: VitaminAdministrationRecord[]): FarmUsageAggregate[] {
  const totals = new Map<string, FarmUsageAggregate>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const existing = totals.get(r.farmId);
    if (existing) existing.totalUsed += r.quantityUsed;
    else totals.set(r.farmId, { farmId: r.farmId, farmName: r.farmName, totalUsed: r.quantityUsed });
  }
  return [...totals.values()].sort((a, b) => b.totalUsed - a.totalUsed);
}

export interface PeriodUsage {
  label: string;
  value: number;
}

type PeriodUnit = "day" | "week" | "month";

function bucketKey(date: Date, unit: PeriodUnit): string {
  if (unit === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (unit === "week") {
    const weekday = (date.getDay() + 6) % 7;
    const monday = new Date(date.getTime() - weekday * 24 * 60 * 60 * 1000);
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function formatPeriodLabel(key: string, unit: PeriodUnit): string {
  if (unit === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  const date = new Date(`${key}T00:00:00`);
  const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return unit === "week" ? `Wk of ${label}` : label;
}

function aggregateUsageByPeriod<T extends { status: ApprovalStatus; quantityUsed: number }>(
  records: T[],
  dateOf: (r: T) => string,
  unit: PeriodUnit,
  recentCount: number
): PeriodUsage[] {
  const buckets = new Map<string, PeriodUsage>();
  for (const r of records) {
    if (r.status !== "approved") continue;
    const key = bucketKey(new Date(`${dateOf(r)}T00:00:00`), unit);
    const bucket = buckets.get(key) ?? { label: formatPeriodLabel(key, unit), value: 0 };
    bucket.value += r.quantityUsed;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-recentCount)
    .map(([, bucket]) => bucket);
}

export const aggregateFeedByDay = (records: FeedDistributionRecord[]) =>
  aggregateUsageByPeriod(records, (r) => r.distributionDate, "day", 14);
export const aggregateFeedByWeek = (records: FeedDistributionRecord[]) =>
  aggregateUsageByPeriod(records, (r) => r.distributionDate, "week", 8);
export const aggregateFeedByMonth = (records: FeedDistributionRecord[]) =>
  aggregateUsageByPeriod(records, (r) => r.distributionDate, "month", 12);
export const aggregateVitaminByMonth = (records: VitaminAdministrationRecord[]) =>
  aggregateUsageByPeriod(records, (r) => r.administrationDate, "month", 12);

const EXPIRY_THRESHOLD_DAYS = 30;

export interface ExpiringVitamin {
  vitamin: VitaminBatch;
  daysUntilExpiry: number;
  isExpired: boolean;
}

/** Always computed fresh from expiration_date vs. today — correct regardless of when the page happens to be opened, unlike the best-effort DB trigger which only re-checks on write. */
export function expiringVitamins(vitamins: VitaminBatch[], thresholdDays = EXPIRY_THRESHOLD_DAYS, today = new Date()): ExpiringVitamin[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return vitamins
    .filter((v) => v.remainingStock > 0)
    .map((v) => {
      const expiry = new Date(`${v.expirationDate}T00:00:00`);
      const daysUntilExpiry = Math.round((expiry.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
      return { vitamin: v, daysUntilExpiry, isExpired: daysUntilExpiry < 0 };
    })
    .filter((entry) => entry.daysUntilExpiry <= thresholdDays)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export function lowStockFeeds(feeds: FeedBatch[]): FeedBatch[] {
  return feeds.filter((f) => f.remainingStock <= f.minimumStockLevel).sort((a, b) => a.remainingStock - b.remainingStock);
}

export function lowStockVitamins(vitamins: VitaminBatch[]): VitaminBatch[] {
  return vitamins.filter((v) => v.remainingStock <= v.minimumStockLevel).sort((a, b) => a.remainingStock - b.remainingStock);
}

/** Groups remaining stock by unit — summing raw quantities across different units (kg vs sacks) would be meaningless. */
export function summarizeByUnit(items: { unit: string; remainingStock: number }[]): { unit: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.unit, (totals.get(item.unit) ?? 0) + item.remainingStock);
  }
  return [...totals.entries()]
    .map(([unit, total]) => ({ unit, total }))
    .sort((a, b) => b.total - a.total);
}

/** "1,200 kg" for a single unit, "1,200 kg + 40 sacks" for a mixed set, "0" when there's nothing yet. */
export function formatUnitSummary(items: { unit: string; remainingStock: number }[]): string {
  const summary = summarizeByUnit(items);
  if (summary.length === 0) return "0";
  return summary.map((s) => `${s.total.toLocaleString()} ${s.unit}`).join(" + ");
}
