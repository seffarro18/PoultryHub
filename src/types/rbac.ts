import type { UserRole } from "./auth";

export interface Permission {
  id: string;
  key: string;
  label: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  baseRole: UserRole;
  isSystem: boolean;
  permissionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleInput {
  name: string;
  description: string | null;
  baseRole: UserRole;
  permissionIds: string[];
}
