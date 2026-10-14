import { supabase } from "./supabaseClient";
import type { FeedType, FeedTypeInput, VitaminTypeInput, VitaminTypeItem } from "../types/catalog";

// ── Feed types ───────────────────────────────────────────────────────────

interface FeedTypeRow {
  id: string;
  farm_id: string | null;
  brand: string;
  category: FeedType["category"];
  package_size: FeedType["packageSize"];
  is_active: boolean;
}

const FEED_TYPE_SELECT = "id, farm_id, brand, category, package_size, is_active";

const mapFeedType = (row: FeedTypeRow): FeedType => ({
  id: row.id,
  farmId: row.farm_id,
  brand: row.brand,
  category: row.category,
  packageSize: row.package_size,
  isActive: row.is_active,
});

/** System defaults plus the caller's own farm's types — RLS-scoped (another farm's types are never returned). */
export async function listFeedTypes(): Promise<FeedType[]> {
  const { data, error } = await supabase.from("feed_types").select(FEED_TYPE_SELECT).order("brand").order("category").order("package_size");
  if (error) throw error;
  return ((data ?? []) as FeedTypeRow[]).map(mapFeedType);
}

/** Farm Admin/Manager only (RLS). Creates a catalog entry only — no stock, purchase or expense. Duplicates are refused by the database. */
export async function createFeedType(farmId: string, input: FeedTypeInput): Promise<FeedType> {
  const { data, error } = await supabase
    .from("feed_types")
    .insert({ farm_id: farmId, brand: input.brand, category: input.category, package_size: input.packageSize })
    .select(FEED_TYPE_SELECT)
    .single();
  if (error) throw error;
  return mapFeedType(data as FeedTypeRow);
}

// ── Vitamin types ────────────────────────────────────────────────────────

interface VitaminTypeRow {
  id: string;
  farm_id: string | null;
  name: string;
  category: VitaminTypeItem["category"];
  product_form: VitaminTypeItem["productForm"];
  default_unit: VitaminTypeItem["defaultUnit"];
  package_size: string | null;
  is_active: boolean;
}

const VITAMIN_TYPE_SELECT = "id, farm_id, name, category, product_form, default_unit, package_size, is_active";

const mapVitaminType = (row: VitaminTypeRow): VitaminTypeItem => ({
  id: row.id,
  farmId: row.farm_id,
  name: row.name,
  category: row.category,
  productForm: row.product_form,
  defaultUnit: row.default_unit,
  packageSize: row.package_size,
  isActive: row.is_active,
});

export async function listVitaminTypes(): Promise<VitaminTypeItem[]> {
  const { data, error } = await supabase.from("vitamin_types").select(VITAMIN_TYPE_SELECT).order("name");
  if (error) throw error;
  return ((data ?? []) as VitaminTypeRow[]).map(mapVitaminType);
}

export async function createVitaminType(farmId: string, input: VitaminTypeInput): Promise<VitaminTypeItem> {
  const { data, error } = await supabase
    .from("vitamin_types")
    .insert({
      farm_id: farmId,
      name: input.name,
      category: input.category,
      product_form: input.productForm,
      default_unit: input.defaultUnit,
      package_size: input.packageSize,
    })
    .select(VITAMIN_TYPE_SELECT)
    .single();
  if (error) throw error;
  return mapVitaminType(data as VitaminTypeRow);
}

/**
 * Calls `onChange` whenever a catalog row visible to this user is added or
 * changed (Realtime, RLS-authorized) — so an already-open form picks up a
 * type another user just added. Returns the unsubscribe function.
 */
export function subscribeToCatalog(table: "feed_types" | "vitamin_types", onChange: () => void): () => void {
  const channel = supabase
    .channel(`catalog:${table}:${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
