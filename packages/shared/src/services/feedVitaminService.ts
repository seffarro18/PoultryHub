import { supabase } from "./supabaseClient";
import {
  feedStockStatus,
  vitaminStockStatus,
  type ApprovalStatus,
  type FeedBatch,
  type FeedBatchInput,
  type FeedDistributionInput,
  type FeedDistributionRecord,
  type VitaminAdministrationInput,
  type VitaminAdministrationRecord,
  type VitaminBatch,
  type VitaminBatchInput,
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
  package_size: string | null;
  remaining_stock: number;
  purchase_date: string;
  expiration_date: string | null;
  remarks: string | null;
  created_at: string;
  archived_at: string | null;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

// minimum_stock_level/storage_location columns still exist on `feeds` for
// backward compatibility, but are no longer read or written here — low
// stock is now a hardcoded threshold (feedStockStatus()), and Storage
// Location was dropped from the form entirely.
const FEED_SELECT = `
  id, farm_id, feed_name, category, brand, batch_number, supplier, quantity, unit, package_size,
  remaining_stock, purchase_date, expiration_date, remarks, created_at, archived_at,
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
    packageSize: row.package_size,
    remainingStock: row.remaining_stock,
    purchaseDate: row.purchase_date,
    expirationDate: row.expiration_date,
    remarks: row.remarks,
    recordedByName: row.recorded_by_profile?.name ?? null,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

/** RLS already excludes archived rows for every role (0036) — this never returns a batch Farm Admin has archived. */
export async function listFeedBatches(): Promise<FeedBatch[]> {
  const { data, error } = await supabase.from("feeds").select(FEED_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as FeedBatchRow[]).map(mapFeedRow);
}

// Creating a new feed batch now always goes through recordFeedPurchase()
// (purchaseService.ts) — it's a purchase, not a plain insert, and also
// creates the matching Expense + receipt in the same transaction.
//
// Editing goes through the update_feed_batch RPC (0036), not a plain
// client update — it's the one place that enforces "never reduce quantity
// below what's already been distributed" and keeps feed_name in sync with
// Brand/Category, so that validation can't be bypassed by a client that
// skips it.
export async function updateFeedBatch(id: string, input: FeedBatchInput): Promise<void> {
  const { error } = await supabase.rpc("update_feed_batch", {
    p_id: id,
    p_category: input.category,
    p_brand: input.brand,
    p_quantity: input.quantity,
    p_package_size: input.packageSize,
    p_purchase_date: input.purchaseDate,
    p_expiration_date: input.expirationDate,
    p_remarks: input.remarks,
  });
  if (error) throw error;
}

/** Soft delete — archives the batch (excluded from every active list/dropdown/dashboard via RLS) without losing its history or breaking existing feed_distribution rows that reference it. */
export async function archiveFeedBatch(id: string): Promise<void> {
  const { error } = await supabase.rpc("archive_feed_batch", { p_id: id });
  if (error) throw error;
}

export async function restoreFeedBatch(id: string): Promise<void> {
  const { error } = await supabase.rpc("restore_feed_batch", { p_id: id });
  if (error) throw error;
}

// ── Vitamin batches ─────────────────────────────────────────────────────

interface VitaminBatchRow {
  id: string;
  farm_id: string;
  vitamin_name: string;
  vitamin_type: VitaminBatch["vitaminType"];
  category: string | null;
  brand: string | null;
  batch_number: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  package_size: string | null;
  remaining_stock: number;
  purchase_date: string;
  expiration_date: string | null;
  remarks: string | null;
  created_at: string;
  archived_at: string | null;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

// minimum_stock_level/storage_location columns still exist on `vitamins` for
// backward compatibility — see the matching comment on FEED_SELECT above.
const VITAMIN_SELECT = `
  id, farm_id, vitamin_name, vitamin_type, category, brand, batch_number, supplier, quantity, unit,
  package_size, remaining_stock, purchase_date, expiration_date, remarks, created_at, archived_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name )
`;

function mapVitaminRow(row: VitaminBatchRow): VitaminBatch {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    vitaminName: row.vitamin_name,
    vitaminType: row.vitamin_type,
    category: row.category,
    brand: row.brand,
    batchNumber: row.batch_number,
    supplier: row.supplier,
    quantity: row.quantity,
    unit: row.unit,
    packageSize: row.package_size,
    remainingStock: row.remaining_stock,
    purchaseDate: row.purchase_date,
    expirationDate: row.expiration_date,
    remarks: row.remarks,
    recordedByName: row.recorded_by_profile?.name ?? null,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

/** RLS already excludes archived rows for every role (0036). */
export async function listVitaminBatches(): Promise<VitaminBatch[]> {
  const { data, error } = await supabase.from("vitamins").select(VITAMIN_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as VitaminBatchRow[]).map(mapVitaminRow);
}

// Creating a new vitamin batch now always goes through recordVitaminPurchase()
// (purchaseService.ts) — same reasoning as updateFeedBatch above.
//
// Editing goes through the update_vitamin_batch RPC (0036) — see
// updateFeedBatch's matching comment for why.
export async function updateVitaminBatch(id: string, input: VitaminBatchInput): Promise<void> {
  const { error } = await supabase.rpc("update_vitamin_batch", {
    p_id: id,
    p_vitamin_name: input.vitaminName,
    p_vitamin_type: input.vitaminType,
    p_category: input.category,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_package_size: input.packageSize,
    p_purchase_date: input.purchaseDate,
    p_expiration_date: input.expirationDate,
    p_remarks: input.remarks,
  });
  if (error) throw error;
}

/** Soft delete — see archiveFeedBatch's matching comment. */
export async function archiveVitaminBatch(id: string): Promise<void> {
  const { error } = await supabase.rpc("archive_vitamin_batch", { p_id: id });
  if (error) throw error;
}

export async function restoreVitaminBatch(id: string): Promise<void> {
  const { error } = await supabase.rpc("restore_vitamin_batch", { p_id: id });
  if (error) throw error;
}

// ── Feed distribution (Staff -> Farm Admin approval workflow) ──────────

interface FeedDistributionRow {
  id: string;
  farm_id: string;
  feed_id: string;
  house_pen: string;
  house_id: string | null;
  quantity_used: number;
  unit: string;
  number_of_chickens: number | null;
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
  id, farm_id, feed_id, house_pen, house_id, quantity_used, unit, number_of_chickens, distribution_date,
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
    houseId: row.house_id,
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
    house_id: input.houseId,
    quantity_used: input.quantityUsed,
    unit: input.unit,
    distribution_date: input.distributionDate,
    remarks: input.remarks,
  };
}

/** Staff logging a new record — status defaults to 'pending' in the database. Returns the new row's id (used by createApprovedFeedDistributionRecord below). */
export async function createFeedDistributionRecord(input: FeedDistributionInput): Promise<string> {
  const { data, error } = await supabase.from("feed_distribution").insert(feedDistributionRow(input)).select("id").single();
  if (error) throw error;
  return data.id;
}

/**
 * Farm Admin/Manager recording their own usage directly — pre-approved,
 * since they already hold review authority (same shortcut
 * createApprovedMortalityRecord already gives Farm Admin for mortality).
 * The stock-delta trigger only fires on UPDATE (pending -> approved), not
 * INSERT, so this inserts as pending then immediately approves it — two
 * calls, not a single DB transaction, but a safe failure mode: if the
 * approval step fails (e.g. a concurrent submission already depleted the
 * stock), the row is left as an ordinary pending record for later review
 * rather than any stock being touched incorrectly.
 */
export async function createApprovedFeedDistributionRecord(input: FeedDistributionInput): Promise<void> {
  const id = await createFeedDistributionRecord(input);
  await approveFeedDistributionRecord(id);
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

/** Returns the new row's id (used by createApprovedVitaminAdministrationRecord below). */
export async function createVitaminAdministrationRecord(input: VitaminAdministrationInput): Promise<string> {
  const { data, error } = await supabase.from("vitamin_administration").insert(vitaminAdministrationRow(input)).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Farm Admin/Manager recording their own usage directly — pre-approved. See createApprovedFeedDistributionRecord's doc comment for why this is two calls, not one transaction. */
export async function createApprovedVitaminAdministrationRecord(input: VitaminAdministrationInput): Promise<void> {
  const id = await createVitaminAdministrationRecord(input);
  await approveVitaminAdministrationRecord(id);
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
/** Expiration Date is optional now (a vitamin's shelf life isn't always tracked) — a batch with none set just never shows up here. */
export function expiringVitamins(vitamins: VitaminBatch[], thresholdDays = EXPIRY_THRESHOLD_DAYS, today = new Date()): ExpiringVitamin[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return vitamins
    .filter((v) => v.remainingStock > 0 && v.expirationDate)
    .map((v) => {
      const expiry = new Date(`${v.expirationDate}T00:00:00`);
      const daysUntilExpiry = Math.round((expiry.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
      return { vitamin: v, daysUntilExpiry, isExpired: daysUntilExpiry < 0 };
    })
    .filter((entry) => entry.daysUntilExpiry <= thresholdDays)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/** Hardcoded threshold (FEED_LOW_STOCK_THRESHOLD), not a per-batch configurable one — see feedStockStatus(). */
export function lowStockFeeds(feeds: FeedBatch[]): FeedBatch[] {
  return feeds.filter((f) => feedStockStatus(f.remainingStock) !== "normal").sort((a, b) => a.remainingStock - b.remainingStock);
}

export function lowStockVitamins(vitamins: VitaminBatch[]): VitaminBatch[] {
  return vitamins.filter((v) => vitaminStockStatus(v.remainingStock) !== "normal").sort((a, b) => a.remainingStock - b.remainingStock);
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
