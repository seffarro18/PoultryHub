import { supabase } from "./supabaseClient";
import type { Permission, Role, RoleInput } from "../types/rbac";
import type { UserRole } from "../types/auth";

/** Real Supabase reads/writes against the roles/permissions/role_permissions tables (supabase/schema.sql). */

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  base_role: UserRole;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  role_permissions: { permission_id: string }[];
}

function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    baseRole: row.base_role,
    isSystem: row.is_system,
    permissionIds: row.role_permissions.map((rp) => rp.permission_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase.from("permissions").select("id, key, label").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description, base_role, is_system, created_at, updated_at, role_permissions(permission_id)")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(mapRole);
}

export async function createRole(input: RoleInput): Promise<void> {
  const { data, error } = await supabase
    .from("roles")
    .insert({ name: input.name, description: input.description, base_role: input.baseRole, is_system: false })
    .select("id")
    .single();
  if (error) throw error;

  await linkPermissions(data.id, input.permissionIds);
}

export async function updateRole(id: string, input: Pick<RoleInput, "description" | "permissionIds">): Promise<void> {
  const { error } = await supabase.from("roles").update({ description: input.description }).eq("id", id);
  if (error) throw error;

  const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", id);
  if (deleteError) throw deleteError;

  await linkPermissions(id, input.permissionIds);
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateRole(source: Role, newName: string): Promise<void> {
  await createRole({
    name: newName,
    description: source.description,
    baseRole: source.baseRole,
    permissionIds: source.permissionIds,
  });
}

async function linkPermissions(roleId: string, permissionIds: string[]): Promise<void> {
  if (permissionIds.length === 0) return;
  const { error } = await supabase
    .from("role_permissions")
    .insert(permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })));
  if (error) throw error;
}
