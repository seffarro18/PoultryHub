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

/** Package Size options depend on which Unit is selected — a liquid size doesn't make sense for a box of tablets, so the form filters to just this unit's list rather than showing every size at once. */
export const VITAMIN_PACKAGE_SIZES_BY_UNIT: Record<VitaminUnit, readonly string[]> = {
  bot: ["100 ml bottle", "250 ml bottle", "500 ml bottle", "1 L bottle", "5 L container"],
  pack: ["100 g pack", "250 g pack", "500 g pack", "1 kg pack"],
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
  quantityUsed: number;
  unit: string;
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
}

export interface VitaminAdministrationInput {
  farmId: string;
  vitaminId: string;
  housePen: string;
  dosage: string | null;
  quantityUsed: number;
  unit: string;
  administrationDate: string;
  purpose: string | null;
  remarks: string | null;
}
