import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Copy, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { deleteRole, duplicateRole, listPermissions, listRoles } from "../services/roleService";
import RoleFormDrawer from "../components/rbac/RoleFormDrawer";
import type { Permission, Role } from "../types/rbac";
import type { UserRole } from "@poultryhub/shared/types/auth";

const BASE_ROLE_FILTERS: (UserRole | "All")[] = ["All", "Super Admin", "Farm Admin", "Manager", "Staff"];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [baseRoleFilter, setBaseRoleFilter] = useState<UserRole | "All">("All");

  const [editingRole, setEditingRole] = useState<Role | null | "new">(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [roleRows, permissionRows] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(roleRows);
      setPermissions(permissionRows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load roles.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roles.filter((r) => {
      if (baseRoleFilter !== "All" && r.baseRole !== baseRoleFilter) return false;
      if (term && !r.name.toLowerCase().includes(term) && !(r.description ?? "").toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [roles, search, baseRoleFilter]);

  const handleDuplicate = async (role: Role) => {
    const suggested = `${role.name} (copy)`;
    const newName = window.prompt("Name for the duplicated role:", suggested);
    if (!newName || !newName.trim()) return;
    setBusyId(role.id);
    try {
      await duplicateRole(role, newName.trim());
      await refresh();
    } catch (err) {
      console.error("[RolesPage] duplicate failed:", err);
      alert("Couldn't duplicate that role. The name may already be in use.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`Delete "${role.name}"? This can't be undone.`)) return;
    setBusyId(role.id);
    try {
      await deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (err) {
      console.error("[RolesPage] delete failed:", err);
      alert("Couldn't delete that role.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Roles</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Manage roles and the permissions each one grants.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingRole("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> New Role
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
          />
        </div>
        <select
          value={baseRoleFilter}
          onChange={(e) => setBaseRoleFilter(e.target.value as UserRole | "All")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          {BASE_ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r === "All" ? "All base roles" : r}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading roles…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle size={20} className="text-[var(--color-danger)]" />
            <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-muted)]">No roles match those filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Base role</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((role) => (
                  <tr key={role.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[var(--color-foreground)]">{role.name}</p>
                        {role.isSystem && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                            <ShieldCheck size={11} /> System
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-[var(--color-muted)]">{role.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-[var(--color-muted-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-foreground)]">
                        {role.baseRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {role.permissionIds.length}/{permissions.length}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {new Date(role.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {busyId === role.id ? (
                        <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingRole(role)}
                            title="Edit"
                            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDuplicate(role)}
                            title="Duplicate"
                            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                          >
                            <Copy size={14} />
                          </button>
                          {!role.isSystem && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(role)}
                              title="Delete"
                              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRole !== null && (
        <RoleFormDrawer
          role={editingRole === "new" ? null : editingRole}
          permissions={permissions}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
