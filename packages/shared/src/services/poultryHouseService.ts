import { supabase } from "./supabaseClient";
import type { PoultryHouse } from "../types/poultryHouse";

interface PoultryHouseRow {
  id: string;
  farm_id: string;
  name: string;
}

function mapRow(row: PoultryHouseRow): PoultryHouse {
  return { id: row.id, farmId: row.farm_id, name: row.name };
}

/** RLS already scopes this to the caller's own farm (or lets Super Admin see any farm's) — farmId here just narrows which farm's list is requested. */
export async function listPoultryHouses(farmId: string): Promise<PoultryHouse[]> {
  const { data, error } = await supabase
    .from("poultry_houses")
    .select("id, farm_id, name")
    .eq("farm_id", farmId)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as PoultryHouseRow[]).map(mapRow);
}

/** Farm Admin/Manager only — RLS rejects this for Staff regardless of what the UI allows. */
export async function createPoultryHouse(farmId: string, name: string): Promise<PoultryHouse> {
  const { data, error } = await supabase
    .from("poultry_houses")
    .insert({ farm_id: farmId, name })
    .select("id, farm_id, name")
    .single();
  if (error) throw error;
  return mapRow(data as PoultryHouseRow);
}
