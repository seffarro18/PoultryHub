import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { listPermissions, listRoles } from "../services/roleService";
import { ROLES_PATH } from "../config/navigation";
import type { Permission, Role } from "../types/rbac";

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPermissions(), listRoles()])
      .then(([permissionRows, roleRows]) => {
        if (cancelled) return;
        setPermissions(permissionRows);
        setRoles(roleRows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load permissions.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Permissions</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          A reference view of what each role currently grants. To change anything, edit the role from{" "}
          <Link to={ROLES_PATH} className="font-medium text-[var(--color-primary)] hover:underline">
            Roles
          </Link>
          .
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading permissions…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle size={20} className="text-[var(--color-danger)]" />
            <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="sticky left-0 bg-[var(--color-card)] px-4 py-3 font-medium">Permission</th>
                  {roles.map((role) => (
                    <th key={role.id} className="whitespace-nowrap px-4 py-3 text-center font-medium">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((permission) => (
                  <tr key={permission.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="sticky left-0 bg-[var(--color-card)] px-4 py-2.5 font-medium text-[var(--color-foreground)]">
                      {permission.label}
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-4 py-2.5 text-center">
                        {role.permissionIds.includes(permission.id) ? (
                          <Check size={15} className="mx-auto text-[var(--color-success)]" />
                        ) : (
                          <span className="mx-auto block h-1 w-1 rounded-full bg-[var(--color-border)]" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
