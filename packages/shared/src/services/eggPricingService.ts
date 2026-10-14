import { supabase } from "./supabaseClient";
import type { EggPrice, EggPriceHistoryEntry, EggSize, ProductionSettings } from "../types/eggPricing";

// ── Egg prices ──────────────────────────────────────────────────────────

interface EggPriceRow {
  farm_id: string;
  egg_size: EggSize;
  full_tray_price: number | null;
  half_tray_price: number | null;
  piece_price: number | null;
  updated_at: string;
  updated_by_profile: { name: string } | null;
}

const EGG_PRICE_SELECT = `
  farm_id, egg_size, full_tray_price, half_tray_price, piece_price, updated_at,
  updated_by_profile:profiles!updated_by ( name )
`;

function mapEggPriceRow(row: EggPriceRow): EggPrice {
  return {
    farmId: row.farm_id,
    eggSize: row.egg_size,
    fullTrayPrice: row.full_tray_price === null ? null : Number(row.full_tray_price),
    halfTrayPrice: row.half_tray_price === null ? null : Number(row.half_tray_price),
    piecePrice: row.piece_price === null ? null : Number(row.piece_price),
    updatedByName: row.updated_by_profile?.name ?? null,
    updatedAt: row.updated_at,
  };
}

/** RLS-scoped to the caller's own farm (Farm Admin/Manager/Staff) — same as every other query in this file set. */
export async function listEggPrices(): Promise<EggPrice[]> {
  const { data, error } = await supabase.from("egg_prices").select(EGG_PRICE_SELECT).order("egg_size");
  if (error) throw error;
  return ((data ?? []) as unknown as EggPriceRow[]).map(mapEggPriceRow);
}

/**
 * Updates one size's prices — the AFTER UPDATE trigger on egg_prices writes
 * egg_price_history automatically for whichever price(s) actually changed.
 * Any price null = not configured (that unit can't be sold for this size).
 * Zero rows updated means RLS refused it, which is reported, not ignored.
 */
export async function updateEggPrice(
  farmId: string,
  eggSize: EggSize,
  fullTrayPrice: number | null,
  halfTrayPrice: number | null,
  piecePrice: number | null
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("egg_prices")
    .update({ full_tray_price: fullTrayPrice, half_tray_price: halfTrayPrice, piece_price: piecePrice, updated_by: auth.user?.id ?? null })
    .eq("farm_id", farmId)
    .eq("egg_size", eggSize)
    .select("egg_size");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Couldn't save ${eggSize} prices — you may not have permission.`);
}

// ── Egg price history ──────────────────────────────────────────────────

interface EggPriceHistoryRow {
  id: string;
  farm_id: string;
  egg_size: string;
  unit_type: "full_tray" | "half_tray" | "piece";
  previous_price: number | null;
  new_price: number;
  created_at: string;
  updated_by_profile: { name: string } | null;
}

const EGG_PRICE_HISTORY_SELECT = `
  id, farm_id, egg_size, unit_type, previous_price, new_price, created_at,
  updated_by_profile:profiles!updated_by ( name )
`;

function mapEggPriceHistoryRow(row: EggPriceHistoryRow): EggPriceHistoryEntry {
  return {
    id: row.id,
    farmId: row.farm_id,
    eggSize: row.egg_size,
    unitType: row.unit_type,
    previousPrice: row.previous_price === null ? null : Number(row.previous_price),
    newPrice: Number(row.new_price),
    updatedByName: row.updated_by_profile?.name ?? null,
    createdAt: row.created_at,
  };
}

export async function listEggPriceHistory(): Promise<EggPriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from("egg_price_history")
    .select(EGG_PRICE_HISTORY_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as EggPriceHistoryRow[]).map(mapEggPriceHistoryRow);
}

// ── Remaining egg stock by size ─────────────────────────────────────────

export interface EggStockBySize {
  /** Peewee … Super Jumbo, in order — sellable pieces per size. */
  sizes: { eggSize: EggSize; available: number }[];
  /** Approved good eggs never classified by size (older records) — counted in the total, not sellable by size. */
  unclassified: number;
  /** Eggs sold before per-size sales existed (<= 0) — counted in the total, not attributable to a size. */
  unattributedSales: number;
  /** Equals the Remaining Eggs total. */
  total: number;
}

/**
 * The same per-size stock save_egg_sale validates against
 * (get_egg_stock_by_size -> egg_stock_for_size, migration 0046) — Farm
 * Admin/Manager/Staff of the farm (quantities only, no prices) or Super Admin.
 */
export async function getEggStockBySize(farmId: string): Promise<EggStockBySize> {
  const { data, error } = await supabase.rpc("get_egg_stock_by_size", { p_farm_id: farmId });
  if (error) throw error;
  const rows = (data ?? []) as { egg_size: string; available: number }[];
  const sizes = rows
    .filter((r) => r.egg_size !== "Unclassified" && r.egg_size !== "Unattributed sales")
    .map((r) => ({ eggSize: r.egg_size as EggSize, available: Number(r.available) }));
  const unclassified = Number(rows.find((r) => r.egg_size === "Unclassified")?.available ?? 0);
  const unattributedSales = Number(rows.find((r) => r.egg_size === "Unattributed sales")?.available ?? 0);
  const total = sizes.reduce((sum, s) => sum + s.available, 0) + unclassified + unattributedSales;
  return { sizes, unclassified, unattributedSales, total };
}

// ── Production settings ────────────────────────────────────────────────

interface ProductionSettingsRow {
  farm_id: string;
  expected_production_rate: number;
  feed_consumption_unit: "sack" | "kg" | null;
  updated_at: string;
  updated_by_profile: { name: string } | null;
}

const PRODUCTION_SETTINGS_SELECT = `
  farm_id, expected_production_rate, feed_consumption_unit, updated_at,
  updated_by_profile:profiles!updated_by ( name )
`;

function mapProductionSettingsRow(row: ProductionSettingsRow): ProductionSettings {
  return {
    farmId: row.farm_id,
    expectedProductionRate: row.expected_production_rate,
    feedConsumptionUnit: row.feed_consumption_unit ?? "sack",
    updatedByName: row.updated_by_profile?.name ?? null,
    updatedAt: row.updated_at,
  };
}

/** Every visible farm's Feed Consumption Unit (RLS: own farm; Super Admin: all) — reports convert each farm's feed figures with its own setting. */
export async function listFeedConsumptionUnits(): Promise<Record<string, "sack" | "kg">> {
  const { data, error } = await supabase.from("production_settings").select("farm_id, feed_consumption_unit");
  if (error) throw error;
  const units: Record<string, "sack" | "kg"> = {};
  for (const row of (data ?? []) as { farm_id: string; feed_consumption_unit: "sack" | "kg" | null }[]) {
    units[row.farm_id] = row.feed_consumption_unit ?? "sack";
  }
  return units;
}

export async function getProductionSettings(): Promise<ProductionSettings | null> {
  const { data, error } = await supabase.from("production_settings").select(PRODUCTION_SETTINGS_SELECT).maybeSingle();
  if (error) throw error;
  return data ? mapProductionSettingsRow(data as unknown as ProductionSettingsRow) : null;
}

/** Farm Admin/Manager — how the farm records feed consumption. Only future entries change; stock and history don't. Zero rows = refused by RLS. */
export async function updateFeedConsumptionUnit(farmId: string, unit: "sack" | "kg"): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("production_settings")
    .update({ feed_consumption_unit: unit, updated_by: auth.user?.id ?? null })
    .eq("farm_id", farmId)
    .select("farm_id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't save the feed consumption setting — you may not have permission.");
}

export async function updateProductionSettings(farmId: string, expectedProductionRate: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("production_settings")
    .update({ expected_production_rate: expectedProductionRate, updated_by: auth.user?.id ?? null })
    .eq("farm_id", farmId);
  if (error) throw error;
}
