import { supabase } from "./supabaseClient";
import type { AccountStatus, UserRole } from "../types/auth";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  farmId: string | null;
  farmName: string | null;
  avatar: string | null;
  createdAt: string;
}

/**
 * Real Supabase reads/writes — `profiles` already exists and, as of
 * migrations 0002/0003, a Super Admin can see and update every row (not
 * just their own). Unlike the dashboard services, this isn't seeded demo
 * data: user accounts are exactly the kind of entity that's already real.
 */

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  farm_id: string | null;
  avatar: string | null;
  created_at: string;
  farms: { name: string } | null;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, status, farm_id, avatar, created_at, farms ( name )")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as ProfileRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    status: row.status as AccountStatus,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? null,
    avatar: row.avatar,
    createdAt: row.created_at,
  }));
}

export async function setUserStatus(id: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function assignFarm(id: string, farmId: string | null): Promise<void> {
  const { error } = await supabase.from("profiles").update({ farm_id: farmId }).eq("id", id);
  if (error) throw error;
}

export const approveUser = (id: string) => setUserStatus(id, "active");
export const rejectUser = (id: string) => setUserStatus(id, "disabled");
export const activateUser = (id: string) => setUserStatus(id, "active");
export const deactivateUser = (id: string) => setUserStatus(id, "disabled");
