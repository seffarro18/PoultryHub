import { supabase } from "./supabaseClient";
import type { LayerBreed, LayerBreedInput } from "../types/layerBreed";

interface LayerBreedRow {
  id: string;
  farm_id: string | null;
  name: string;
  egg_color: LayerBreed["eggColor"];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const LAYER_BREED_SELECT = "id, farm_id, name, egg_color, is_active, created_at, updated_at";

function mapLayerBreedRow(row: LayerBreedRow): LayerBreed {
  return {
    id: row.id,
    farmId: row.farm_id,
    name: row.name,
    eggColor: row.egg_color,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** System defaults (farm_id null) plus the caller's own farm's custom strains — RLS-scoped, same shape as every other list function in this file set. Ordered name-first within egg color so White/Brown/Other group cleanly for the dropdown. */
export async function listLayerBreeds(): Promise<LayerBreed[]> {
  const { data, error } = await supabase.from("layer_breeds").select(LAYER_BREED_SELECT).order("egg_color").order("name");
  if (error) throw error;
  return ((data ?? []) as unknown as LayerBreedRow[]).map(mapLayerBreedRow);
}

/** Farm Admin/Manager adding a strain specific to their own farm — system defaults (farm_id null) can never be created/edited this way, RLS blocks it regardless. */
export async function createLayerBreed(farmId: string, input: LayerBreedInput): Promise<LayerBreed> {
  const { data, error } = await supabase
    .from("layer_breeds")
    .insert({ farm_id: farmId, name: input.name, egg_color: input.eggColor, is_active: input.isActive })
    .select(LAYER_BREED_SELECT)
    .single();
  if (error) throw error;
  return mapLayerBreedRow(data as unknown as LayerBreedRow);
}

export async function updateLayerBreed(id: string, input: LayerBreedInput): Promise<void> {
  const { error } = await supabase
    .from("layer_breeds")
    .update({ name: input.name, egg_color: input.eggColor, is_active: input.isActive })
    .eq("id", id);
  if (error) throw error;
}
