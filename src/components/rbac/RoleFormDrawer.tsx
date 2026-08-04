import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createRole, updateRole } from "../../services/roleService";
import type { Permission, Role } from "../../types/rbac";
import type { UserRole } from "../../types/auth";

const BASE_ROLES: UserRole[] = ["Super Admin", "Farm Admin", "Manager", "Staff"];

interface RoleFormDrawerProps {
  /** null = create mode */
  role: Role | null;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}

export default function RoleFormDrawer({ role, permissions, onClose, onSaved }: RoleFormDrawerProps) {
  const isEdit = role !== null;
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [baseRole, setBaseRole] = useState<UserRole>(role?.baseRole ?? "Farm Admin");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissionIds ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateRole(role.id, { description: description.trim() || null, permissionIds: [...selected] });
      } else {
        await createRole({
          name: name.trim(),
          description: description.trim() || null,
          baseRole,
          permissionIds: [...selected],
        });
      }
      onSaved();
    } catch (err) {
      console.error("[RoleFormDrawer] save failed:", err);
      setError("Couldn't save this role. The name may already be in use.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Role" : "New Role"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role-name" className="text-sm font-medium text-[var(--color-foreground)]">
                Role name
              </label>
              <input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isEdit}
                placeholder="e.g. Read-Only Staff"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role-description" className="text-sm font-medium text-[var(--color-foreground)]">
                Description
              </label>
              <textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this role for?"
                className="resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role-base" className="text-sm font-medium text-[var(--color-foreground)]">
                Base role
              </label>
              <select
                id="role-base"
                value={baseRole}
                onChange={(e) => setBaseRole(e.target.value as UserRole)}
                disabled={isEdit}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
              >
                {BASE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--color-muted)]">
                Decides which portal this role's holders sign into. Can't be changed after creation.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[var(--color-foreground)]">Permissions</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {permissions.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-sm text-[var(--color-foreground)]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => togglePermission(p.id)}
                      style={{ accentColor: "var(--color-primary)" }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? "Save changes" : "Create role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
