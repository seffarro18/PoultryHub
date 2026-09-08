import { supabase } from "./supabaseClient";
import { listUsers } from "./userManagementService";
import type { FarmDeleteImpact, FarmInput, FarmStatus, ManagedFarm } from "../types/farm";
import type { MyFarmSummary } from "../types/profile";

interface FarmRow {
  id: string;
  name: string;
  owner: string | null;
  address: string | null;
  region: string | null;
  province: string | null;
  city: string | null;
  contact_number: string | null;
  email: string | null;
  farm_type: string | null;
  capacity: number | null;
  status: FarmStatus;
  created_at: string;
  farm_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

const FARM_SELECT =
  "id, name, owner, address, region, province, city, contact_number, email, farm_type, capacity, status, created_at, farm_code, latitude, longitude";

/** Every farm, with its currently-assigned Farm Admin/Manager accounts attached — cross-referenced against listUsers(), not a second per-farm query. */
export async function listManagedFarms(): Promise<ManagedFarm[]> {
  const [{ data, error }, users] = await Promise.all([
    supabase.from("farms").select(FARM_SELECT).order("created_at", { ascending: false }),
    listUsers(),
  ]);
  if (error) throw error;

  const adminsByFarm = new Map<string, ManagedFarm["admins"]>();
  for (const u of users) {
    if (!u.farmId || (u.role !== "Farm Admin" && u.role !== "Manager")) continue;
    const list = adminsByFarm.get(u.farmId) ?? [];
    list.push({ id: u.id, name: u.name });
    adminsByFarm.set(u.farmId, list);
  }

  return ((data ?? []) as FarmRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    owner: row.owner,
    address: row.address,
    region: row.region,
    province: row.province,
    city: row.city,
    contactNumber: row.contact_number,
    email: row.email,
    farmType: row.farm_type,
    capacity: row.capacity,
    status: row.status,
    createdAt: row.created_at,
    admins: adminsByFarm.get(row.id) ?? [],
    farmCode: row.farm_code,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}

/** A Farm Admin/Manager/Staff's own farm — read-only, for the Profile page's "My Farm"/"Work Information" cards and the Farm Profile page. RLS ("Farm users can view their assigned farm") already scopes this to the caller's own farm_id. */
export async function getMyFarm(farmId: string): Promise<MyFarmSummary | null> {
  const { data, error } = await supabase.from("farms").select(FARM_SELECT).eq("id", farmId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as FarmRow;
  return {
    id: row.id,
    name: row.name,
    farmCode: row.farm_code,
    address: row.address,
    region: row.region,
    province: row.province,
    city: row.city,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/** Farm Admin setting their own farm's coordinates from the mobile app — RLS + prevent_farm_field_overreach() (0006) restrict this to Farm Admin, their own assigned farm, and exactly these two columns. */
export async function updateFarmLocation(farmId: string, latitude: number, longitude: number): Promise<void> {
  const { error } = await supabase.from("farms").update({ latitude, longitude }).eq("id", farmId);
  if (error) throw error;
}

function toRow(input: FarmInput) {
  return {
    name: input.name,
    owner: input.owner,
    address: input.address,
    region: input.region,
    province: input.province,
    city: input.city,
    contact_number: input.contactNumber,
    email: input.email,
    farm_type: input.farmType,
    capacity: input.capacity,
    farm_code: input.farmCode,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

export async function createManagedFarm(input: FarmInput): Promise<void> {
  const { error } = await supabase.from("farms").insert(toRow(input));
  if (error) throw error;
}

export async function updateManagedFarm(id: string, input: FarmInput): Promise<void> {
  const { error } = await supabase.from("farms").update(toRow(input)).eq("id", id);
  if (error) throw error;
}

/** Powers Activate/Deactivate/Archive/Unarchive — all just a status write. */
export async function setFarmStatus(id: string, status: FarmStatus): Promise<void> {
  const { error } = await supabase.from("farms").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteFarm(id: string): Promise<void> {
  const { error } = await supabase.from("farms").delete().eq("id", id);
  if (error) throw error;
}

/** Record counts that would be lost if this farm were deleted — powers the delete-confirmation warning. */
export async function getFarmDeleteImpact(id: string): Promise<FarmDeleteImpact> {
  const [production, inventory, staff] = await Promise.all([
    supabase.from("egg_production").select("id", { count: "exact", head: true }).eq("farm_id", id),
    supabase.from("poultry_inventory_events").select("id", { count: "exact", head: true }).eq("farm_id", id),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("farm_id", id),
  ]);
  if (production.error) throw production.error;
  if (inventory.error) throw inventory.error;
  if (staff.error) throw staff.error;
  return {
    productionRecords: production.count ?? 0,
    inventoryEvents: inventory.count ?? 0,
    staffCount: staff.count ?? 0,
  };
}
