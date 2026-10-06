import { supabase } from "./supabaseClient";
import type { EggPrice, EggPriceHistoryEntry, EggSize, ProductionSettings } from "../types/eggPricing";

// ── Egg prices ──────────────────────────────────────────────────────────

interface EggPriceRow {
  farm_id: string;
  egg_size: EggSize;
  full_tray_price: number;
  half_tray_price: number;
  updated_at: string;
  updated_by_profile: { name: string } | null;
}

const EGG_PRICE_SELECT = `
  farm_id, egg_size, full_tray_price, half_tray_price, updated_at,
  updated_by_profile:profiles!updated_by ( name )
`;

function mapEggPriceRow(row: EggPriceRow): EggPrice {
  return {
    farmId: row.farm_id,
    eggSize: row.egg_size,
    fullTrayPrice: row.full_tray_price,
    halfTrayPrice: row.half_tray_price,
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

/** Updates one size's prices — the AFTER UPDATE trigger on egg_prices writes egg_price_history automatically for whichever column(s) actually changed. */
export async function updateEggPrice(farmId: string, eggSize: EggSize, fullTrayPrice: number, halfTrayPrice: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("egg_prices")
    .update({ full_tray_price: fullTrayPrice, half_tray_price: halfTrayPrice, updated_by: auth.user?.id ?? null })
    .eq("farm_id", farmId)
    .eq("egg_size", eggSize);
  if (error) throw error;
}

// ── Egg price history ──────────────────────────────────────────────────

interface EggPriceHistoryRow {
  id: string;
  farm_id: string;
  egg_size: string;
  unit_type: "full_tray" | "half_tray";
  previous_price: number;
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
    previousPrice: row.previous_price,
    newPrice: row.new_price,
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

// ── Production settings ────────────────────────────────────────────────

interface ProductionSettingsRow {
  farm_id: string;
  expected_production_rate: number;
  updated_at: string;
  updated_by_profile: { name: string } | null;
}

const PRODUCTION_SETTINGS_SELECT = `
  farm_id, expected_production_rate, updated_at,
  updated_by_profile:profiles!updated_by ( name )
`;

function mapProductionSettingsRow(row: ProductionSettingsRow): ProductionSettings {
  return {
    farmId: row.farm_id,
    expectedProductionRate: row.expected_production_rate,
    updatedByName: row.updated_by_profile?.name ?? null,
    updatedAt: row.updated_at,
  };
}

export async function getProductionSettings(): Promise<ProductionSettings | null> {
  const { data, error } = await supabase.from("production_settings").select(PRODUCTION_SETTINGS_SELECT).maybeSingle();
  if (error) throw error;
  return data ? mapProductionSettingsRow(data as unknown as ProductionSettingsRow) : null;
}

export async function updateProductionSettings(farmId: string, expectedProductionRate: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("production_settings")
    .update({ expected_production_rate: expectedProductionRate, updated_by: auth.user?.id ?? null })
    .eq("farm_id", farmId);
  if (error) throw error;
}
