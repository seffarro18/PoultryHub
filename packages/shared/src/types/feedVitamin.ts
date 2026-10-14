/** Own alias, not cross-imported from types/eggProduction.ts — same shape, independent domain. */
export type ApprovalStatus = "pending" | "approved" | "rejected";

// ── Locked dropdown lists ────────────────────────────────────────────────
// Category/Brand/Unit are all standardized, locked choices now — no free
// text — so every batch reads consistently instead of accumulating typo
// variants ("kg" vs "Kg" vs "kilograms") across records.

export const FEED_CATEGORIES = ["Booster / Pre-Starter", "Starter", "Grower", "Pre-Lay", "Layer"] as const;
export const FEED_BRANDS = ["B-MEG", "Sarimanok", "Sunjin", "Excel La Filipina", "VIEPro", "Other Feed Brand"] as const;
/** The Feed Unit is always "Sack" — a fixed value, not a dropdown (the farmer never chooses it). Sack Size is the real variable, kept separate and informational-only (packageSize below). */
export const FEED_UNIT = "Sack";
/**
 * Stored exactly as before ("25 kg"/"50 kg", unit "Sack" implied) — the
 * form presents Unit + Sack Size as one combined "Packaging / Sack Size"
 * dropdown ("25 kg Sack"/"50 kg Sack"), but that's a UI merge only, not a
 * schema change: Unit is still always "Sack" under the hood, packageSize
 * still stores just the kg figure, so historical batches keep reading
 * correctly either way.
 */
export const FEED_PACKAGE_SIZES = ["25 kg", "50 kg"] as const;

/** How a farm records feed consumption (production_settings.feed_consumption_unit, migration 0052). Stock itself is always kept in sacks. */
export type FeedConsumptionUnit = "sack" | "kg";

/** "50 kg" → 50; null when the batch has no sack size. Mirrors the database's feed_sack_kg(). */
export function feedSackKg(packageSize: string | null): number | null {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*kg/i.exec(packageSize ?? "");
  return match ? Number(match[1]) : null;
}

/** Display-only number formatting without trailing zeros (1, 0.5, 99.5, 4,975). */
export function fmtFeedNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Sack counts in whole + half notation: 0.5 → "½", 98.5 → "98½", 20 → "20". Amounts that aren't whole/half sacks (left by kg entries) fall back to decimals. */
export function fmtSackCount(sacks: number): string {
  const halves = Math.round(sacks * 2);
  if (Math.abs(sacks * 2 - halves) > 1e-6) return fmtFeedNumber(sacks);
  const whole = Math.floor(halves / 2);
  const hasHalf = halves % 2 === 1;
  if (!hasHalf) return whole.toLocaleString();
  return `${whole > 0 ? whole.toLocaleString() : ""}½`;
}

/** "½ Sack", "1 Sack", "1½ Sacks", "98½ Sacks". */
export function fmtSacks(sacks: number): string {
  return `${fmtSackCount(sacks)} ${sacks > 0 && sacks <= 1 ? "Sack" : "Sacks"}`;
}

/**
 * Every selectable sack quantity (½-sack steps) up to what's available —
 * the Record Feed Distribution "Sack" choices. Staff pick, never type decimals.
 */
export function sackQuantityChoices(availableSacks: number): number[] {
  const maxHalves = Math.floor(availableSacks * 2 + 1e-9);
  return Array.from({ length: Math.max(0, maxHalves) }, (_, i) => (i + 1) / 2);
}

/** Today's date as YYYY-MM-DD in the device's own timezone (the farm's local day) — not toISOString(), which is UTC and rolls "today" back a day before 8 AM in UTC+8. */
export function localIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type UsageFields = Pick<FeedDistributionRecord, "enteredQuantity" | "enteredUnit" | "quantityUsed" | "kgPerSack">;

/** The physical weight a distribution consumed, from that record's own saved sack size (a kg entry is exactly what was typed). null = no sack size on record — never guessed. */
export function feedUsageKg(record: UsageFields): number | null {
  if (record.enteredUnit === "kg") return record.enteredQuantity;
  return record.kgPerSack ? record.quantityUsed * record.kgPerSack : null;
}

/**
 * A distribution in the farm's display unit, the other unit alongside:
 * kg → "1,000 kg (40 Sacks)"; sack → "1½ Sacks (37.5 kg)". Without a display
 * unit it follows how the record was entered. Each record converts with its
 * own saved sack size.
 */
export function formatFeedUsage(record: UsageFields, mode: FeedConsumptionUnit = record.enteredUnit): string {
  const kg = feedUsageKg(record);
  if (kg === null) return fmtSacks(record.quantityUsed);
  return mode === "kg" ? `${fmtFeedNumber(kg)} kg (${fmtSacks(record.quantityUsed)})` : `${fmtSacks(record.quantityUsed)} (${fmtFeedNumber(kg)} kg)`;
}

/**
 * A total in the display unit. Sack mode sums sacks. Kg mode sums each part's
 * own weight; any part with no sack size can't be weighed, so it's shown
 * separately ("5,000 kg + 3 Sacks without a sack size") rather than guessed.
 */
function formatFeedTotal(parts: { sacks: number; kg: number | null }[], mode: FeedConsumptionUnit): string {
  const sacks = parts.reduce((s, p) => s + p.sacks, 0);
  if (mode === "sack") return fmtSacks(sacks);
  const kg = parts.reduce((s, p) => s + (p.kg ?? 0), 0);
  const unweighed = parts.filter((p) => p.kg === null).reduce((s, p) => s + p.sacks, 0);
  return unweighed > 0 ? `${fmtFeedNumber(kg)} kg + ${fmtSacks(unweighed)} without a sack size` : `${fmtFeedNumber(kg)} kg`;
}

/** Total remaining feed stock: "160 Sacks" or "7,000 kg" — every batch weighed with its own sack size. */
export function formatFeedStockTotal(batches: Pick<FeedBatch, "remainingStock" | "packageSize">[], mode: FeedConsumptionUnit): string {
  return formatFeedTotal(
    batches.map((b) => {
      const kg = feedSackKg(b.packageSize);
      return { sacks: b.remainingStock, kg: kg === null ? null : b.remainingStock * kg };
    }),
    mode
  );
}

/** Total of the given distributions (callers pass approved ones only): "50 Sacks" or "1,500 kg". */
export function formatFeedUsageTotal(records: UsageFields[], mode: FeedConsumptionUnit): string {
  return formatFeedTotal(records.map((r) => ({ sacks: r.quantityUsed, kg: feedUsageKg(r) })), mode);
}

/** Batch stock in the farm's consumption unit, with the other unit alongside: "4,000 kg (80 Sacks × 50 kg)" or "80 Sacks × 50 kg (4,000 kg)". */
export function formatFeedStock(sacks: number, packageSize: string | null, mode: FeedConsumptionUnit): string {
  const kg = feedSackKg(packageSize);
  if (kg === null) return fmtSacks(sacks);
  const sackText = `${fmtSacks(sacks)} × ${fmtFeedNumber(kg)} kg`;
  const kgText = `${fmtFeedNumber(sacks * kg)} kg`;
  return mode === "kg" ? `${kgText} (${sackText})` : `${sackText} (${kgText})`;
}

/** "50 kg Sack" — the one combined label the Packaging / Sack Size field and every inventory/receipt display uses instead of showing Unit and Sack Size separately. */
export function formatFeedPackaging(packageSize: string | null): string {
  return packageSize ? `${packageSize} Sack` : "—";
}

export const VITAMIN_TYPES = ["Liquid", "Solid", "Tablet"] as const;
export type VitaminType = (typeof VITAMIN_TYPES)[number];

export const VITAMIN_CATEGORIES = [
  "Egg Quality & Shell Enhancer",
  "Stress Reliever / Electrolytes",
  "Production Booster (Multivitamin)",
  "Growth & Frame Developer",
  "Immune & Gut Health",
] as const;

/**
 * Vitamin Name is a dropdown, not free text — each named product maps to one
 * fixed category, so the farmer never picks it separately (categories here
 * are for INVENTORY ORGANIZATION only, not a medical/dosage recommendation —
 * what a flock actually needs depends on its full diet and condition, not on
 * which bucket a supplement is filed under). "Other Layer Supplement" is a
 * plain catch-all entry like Feed Brand's "Other Feed Brand" — its category
 * is just the literal string "Other", not a member of VITAMIN_CATEGORIES.
 */
export const VITAMIN_NAME_OPTIONS = [
  { name: "Probiotics", category: "Immune & Gut Health" },
  { name: "Vitamin AD3E", category: "Egg Quality & Shell Enhancer" },
  { name: "Vitamin D3", category: "Egg Quality & Shell Enhancer" },
  { name: "Vitamin E", category: "Immune & Gut Health" },
  { name: "Multivitamin", category: "Production Booster (Multivitamin)" },
  { name: "Electrolytes", category: "Stress Reliever / Electrolytes" },
  { name: "Calcium / Shell Support", category: "Egg Quality & Shell Enhancer" },
  { name: "Vitamin + Mineral Supplement", category: "Production Booster (Multivitamin)" },
  { name: "Other Layer Supplement", category: "Other" },
] as const;

/** Stock is always counted in whole containers — "bot"/"pack"/"box" is what's stored; the label is what's shown. Package Size (e.g. "1 L", "100 tablets") is separate, informational-only text, never used to compute stock. */
export const VITAMIN_UNIT_OPTIONS = [
  { value: "bot", label: "Bottle" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
] as const;
export type VitaminUnit = (typeof VITAMIN_UNIT_OPTIONS)[number]["value"];
export const VITAMIN_UNIT_LABEL: Record<string, string> = Object.fromEntries(VITAMIN_UNIT_OPTIONS.map((o) => [o.value, o.label]));

const UNIT_PLURAL: Record<string, string> = { Bottle: "Bottles", Pack: "Packs", Box: "Boxes", Sack: "Sacks" };

/**
 * Display name for a stored unit. Vitamin units are stored as short codes
 * ("bot", "pack", "box") — never show those raw. Pass `quantity` to get the
 * plural form when it isn't exactly 1 ("8 Bottles", "1 Bottle"); omit it for
 * a bare singular label ("Quantity Used (Bottle)"). Unknown units (e.g. the
 * feed unit "Sack") pass through unchanged apart from pluralisation.
 */
export function formatUnitLabel(unit: string, quantity?: number): string {
  const label = VITAMIN_UNIT_LABEL[unit] ?? unit;
  if (quantity === undefined || quantity === 1) return label;
  return UNIT_PLURAL[label] ?? label;
}

/** Package Size options depend on which Unit is selected — a liquid size doesn't make sense for a box of tablets, so the form filters to just this unit's list rather than showing every size at once. */
export const VITAMIN_PACKAGE_SIZES_BY_UNIT: Record<VitaminUnit, readonly string[]> = {
  bot: ["25 ml bottle", "50 ml bottle", "100 ml bottle", "250 ml bottle", "500 ml bottle", "1 L bottle", "5 L container"],
  pack: ["25 g pack", "50 g pack", "100 g pack", "250 g pack", "500 g pack", "1 kg pack"],
  box: ["50 tablets", "100 tablets", "500 tablets", "Other"],
};

// ── Hardcoded low-stock thresholds ───────────────────────────────────────
// Replaces a per-batch configurable "Minimum Stock Level" — a farm doesn't
// have to decide or enter a threshold at all, and every batch's status means
// the same thing everywhere in the app.

export const FEED_LOW_STOCK_THRESHOLD = 10;
export const VITAMIN_LOW_STOCK_THRESHOLD = 2;

export type StockStatus = "normal" | "low" | "out";

function stockStatus(remainingStock: number, threshold: number): StockStatus {
  if (remainingStock <= 0) return "out";
  if (remainingStock <= threshold) return "low";
  return "normal";
}

export const feedStockStatus = (remainingStock: number): StockStatus => stockStatus(remainingStock, FEED_LOW_STOCK_THRESHOLD);
export const vitaminStockStatus = (remainingStock: number): StockStatus => stockStatus(remainingStock, VITAMIN_LOW_STOCK_THRESHOLD);

/** Same 30-day window expiringVitamins() uses for the "Expiring Vitamins" tile. */
export const EXPIRY_WARNING_DAYS = 30;
export type ExpiryStatus = "normal" | "expiring" | "expired";

/** null when the batch has no expiration date recorded. */
export function vitaminExpiryStatus(expirationDate: string | null, today = new Date()): ExpiryStatus | null {
  if (!expirationDate) return null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiry = new Date(`${expirationDate.slice(0, 10)}T00:00:00`);
  const days = Math.round((expiry.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "expiring";
  return "normal";
}

export interface FeedBatch {
  id: string;
  farmId: string;
  farmName: string;
  feedName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  /**
   * Original purchased amount — never touched by distribution, but
   * correctable by Farm Admin via updateFeedBatch() (the update_feed_batch
   * RPC) to fix a data-entry mistake. The RPC refuses to drop it below
   * whatever's already been distributed, and shifts remainingStock by the
   * same delta so the correction never fabricates or destroys stock. Every
   * edit lands in audit_logs as a before/after diff — never silently
   * overwritten. Counts whole sacks/bags, per `unit`, never kilograms.
   */
  quantity: number;
  unit: string;
  /** Informational only (e.g. "50 kg") — never used to compute stock, same as Vitamins' packageSize. */
  packageSize: string | null;
  remainingStock: number;
  purchaseDate: string;
  expirationDate: string | null;
  remarks: string | null;
  recordedByName: string | null;
  createdAt: string;
  /** Soft-delete marker — null = active. Archived batches are excluded from every active query at the RLS level (never just hidden client-side) and only ever visible again through audit_logs' history. */
  archivedAt: string | null;
}

/** Used for the Edit Feed Stock form only — quantity/packageSize/dates/remarks are the correctable fields; remainingStock is always server-derived now (update_feed_batch RPC), never sent directly. */
export interface FeedBatchInput {
  farmId: string;
  feedName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  packageSize: string | null;
  purchaseDate: string;
  expirationDate: string | null;
  remarks: string | null;
}

export interface VitaminBatch {
  id: string;
  farmId: string;
  farmName: string;
  vitaminName: string;
  vitaminType: VitaminType;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  /** Counts whole containers (bottles/packs/boxes), per `unit` — never the liquid/tablet content inside one. */
  quantity: number;
  unit: string;
  /** Informational only (e.g. "1 L", "100 tablets") — never used to compute stock. */
  packageSize: string | null;
  remainingStock: number;
  purchaseDate: string;
  /** Optional — a vitamin's shelf life isn't always tracked; when set, still feeds expiringVitamins(). */
  expirationDate: string | null;
  remarks: string | null;
  recordedByName: string | null;
  createdAt: string;
  /** Soft-delete marker — null = active. Same RLS-enforced exclusion as FeedBatch's. */
  archivedAt: string | null;
}

/** Used for the Edit Vitamin Batch form only — see FeedBatchInput's matching comment. */
export interface VitaminBatchInput {
  farmId: string;
  vitaminName: string;
  vitaminType: VitaminType;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  packageSize: string | null;
  purchaseDate: string;
  expirationDate: string | null;
  remarks: string | null;
}

export interface FeedDistributionRecord {
  id: string;
  farmId: string;
  farmName: string;
  feedId: string;
  feedName: string;
  housePen: string;
  /** Real reference into poultry_houses, added alongside the pre-existing housePen text (0032) — null for rows recorded before this existed, or if the referenced house was later deleted. */
  houseId: string | null;
  /** Always in sacks (fractional allowed) — the amount stock moves by. Derived by the database from the entry below (migration 0052). */
  quantityUsed: number;
  unit: string;
  /** What was actually typed, in the unit it was typed in — shown in history. */
  enteredQuantity: number;
  enteredUnit: FeedConsumptionUnit;
  /** The batch's sack size (kg) when the entry was made; null if the batch had none. */
  kgPerSack: number | null;
  /** No longer collected by the Record Feed Distribution modal (either role) — kept nullable for historical rows that have a real value. */
  numberOfChickens: number | null;
  distributionDate: string;
  recordedById: string | null;
  recordedByName: string | null;
  status: ApprovalStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface FeedDistributionInput {
  farmId: string;
  feedId: string;
  housePen: string;
  houseId: string | null;
  /** The typed amount, in enteredUnit. The database converts it to sacks (quantity_used). */
  enteredQuantity: number;
  enteredUnit: FeedConsumptionUnit;
  /** Client-side sack equivalent (for compatibility) — the database recomputes it authoritatively. */
  quantityUsed: number;
  unit: string;
  distributionDate: string;
  remarks: string | null;
}

export interface VitaminAdministrationRecord {
  id: string;
  farmId: string;
  farmName: string;
  vitaminId: string;
  vitaminName: string;
  housePen: string;
  /** null on rows recorded before migration 0045 whose house name didn't match a registered house. */
  houseId: string | null;
  dosage: string | null;
  quantityUsed: number;
  unit: string;
  administrationDate: string;
  purpose: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  status: ApprovalStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
  /** Batch stock immediately before/after this usage was approved — captured by the database at approval time (migration 0042), null until approved. */
  stockBefore: number | null;
  stockAfter: number | null;
}

export interface VitaminAdministrationInput {
  farmId: string;
  vitaminId: string;
  housePen: string;
  houseId: string | null;
  dosage: string | null;
  quantityUsed: number;
  unit: string;
  administrationDate: string;
  purpose: string | null;
  remarks: string | null;
}
