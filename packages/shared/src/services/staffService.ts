import { supabase } from "./supabaseClient";
import { requestPasswordResetWithSupabase } from "./authService";
import type { AccountStatus } from "../types/auth";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  farmId: string | null;
  employeeId: string | null;
  contactNumber: string | null;
  position: string | null;
  employmentStatus: string | null;
  assignedHousePen: string | null;
  username: string | null;
  createdAt: string;
}

export interface StaffInput {
  employeeId: string | null;
  contactNumber: string | null;
  position: string | null;
  employmentStatus: string | null;
  assignedHousePen: string | null;
  username: string | null;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  farm_id: string | null;
  employee_id: string | null;
  contact_number: string | null;
  position: string | null;
  employment_status: string | null;
  assigned_house_pen: string | null;
  username: string | null;
  created_at: string;
}

function mapRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    farmId: row.farm_id,
    employeeId: row.employee_id,
    contactNumber: row.contact_number,
    position: row.position,
    employmentStatus: row.employment_status,
    assignedHousePen: row.assigned_house_pen,
    username: row.username,
    createdAt: row.created_at,
  };
}

const STAFF_SELECT =
  "id, name, email, status, farm_id, employee_id, contact_number, position, employment_status, assigned_house_pen, username, created_at";

/** Every Staff-role account visible to the calling Farm Admin — their own farm's, plus anyone self-registered and still unassigned. */
export async function listFarmStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(STAFF_SELECT)
    .eq("role", "Staff")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

function toRow(input: StaffInput) {
  return {
    employee_id: input.employeeId,
    contact_number: input.contactNumber,
    position: input.position,
    employment_status: input.employmentStatus,
    assigned_house_pen: input.assignedHousePen,
    username: input.username,
  };
}

/**
 * Farm Admin creating a staff account directly. Uses a throwaway random
 * password for the signUp call itself — Farm Admin never knows a real
 * password — then immediately emails the new hire a set-password link.
 * Session-safe: this project requires email confirmation, so signUp()
 * doesn't hand a session to the browser, meaning it can't hijack the
 * already-logged-in Farm Admin's session (see authService.ts).
 */
export async function createStaffAccount(
  name: string,
  email: string,
  farmId: string,
  input: StaffInput
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: crypto.randomUUID(),
    options: { data: { name, role: "Staff" } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Account creation didn't return a user.");

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ status: "active", farm_id: farmId, ...toRow(input) })
    .eq("id", data.user.id);
  if (updateError) throw updateError;

  await requestPasswordResetWithSupabase(email);
}

export async function updateStaffProfile(id: string, name: string, input: StaffInput): Promise<void> {
  const { error } = await supabase.from("profiles").update({ name, ...toRow(input) }).eq("id", id);
  if (error) throw error;
}

export async function setStaffStatus(id: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Claims a self-registered, unassigned Staff account into the caller's farm and activates it. */
export async function claimStaff(id: string, farmId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ farm_id: farmId, status: "active" }).eq("id", id);
  if (error) throw error;
}

export async function resetStaffPassword(email: string): Promise<void> {
  await requestPasswordResetWithSupabase(email);
}
