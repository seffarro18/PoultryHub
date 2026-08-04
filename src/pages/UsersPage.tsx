import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Search, UserRound, X } from "lucide-react";
import {
  activateUser,
  approveUser,
  assignFarm,
  deactivateUser,
  listUsers,
  rejectUser,
  type ManagedUser,
} from "../services/userManagementService";
import { listFarms } from "../services/eggProductionService";
import FarmSelect from "../components/production/FarmSelect";
import AccountStatusBadge from "../components/users/AccountStatusBadge";
import { useAuth } from "../context/AuthContext";
import type { AccountStatus, UserRole } from "../types/auth";
import type { Farm } from "../types/eggProduction";

const STATUS_LABELS: Record<AccountStatus, string> = { pending: "Pending", active: "Active", disabled: "Disabled" };

const ROLE_FILTERS: (UserRole | "All")[] = ["All", "Super Admin", "Farm Admin", "Manager", "Staff"];
const STATUS_FILTERS: (AccountStatus | "All")[] = ["All", "pending", "active", "disabled"];

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-muted-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-foreground)]">
      {role}
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "All">("All");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "All">("All");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listUsers(), listFarms()])
      .then(([userRows, farmRows]) => {
        if (!cancelled) {
          setUsers(userRows);
          setFarms(farmRows);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load users.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "All" && u.role !== roleFilter) return false;
      if (statusFilter !== "All" && u.status !== statusFilter) return false;
      if (term && !u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  async function runAction(id: string, action: (id: string) => Promise<void>, nextStatus: AccountStatus) {
    setPendingActionId(id);
    try {
      await action(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));
    } catch (err) {
      console.error("[UsersPage] status change failed:", err);
      alert("That action failed. Please try again.");
    } finally {
      setPendingActionId(null);
    }
  }

  const handleApprove = (id: string) => runAction(id, approveUser, "active");
  const handleReject = (id: string) => {
    if (!window.confirm("Reject this account? They won't be able to sign in.")) return;
    void runAction(id, rejectUser, "disabled");
  };
  const handleActivate = (id: string) => runAction(id, activateUser, "active");
  const handleDeactivate = (id: string) => {
    if (!window.confirm("Deactivate this account? They'll lose access immediately.")) return;
    void runAction(id, deactivateUser, "disabled");
  };

  const handleAssignFarm = async (id: string, farmId: string) => {
    const resolvedFarmId = farmId === "" ? null : farmId;
    try {
      await assignFarm(id, resolvedFarmId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, farmId: resolvedFarmId, farmName: farms.find((f) => f.id === resolvedFarmId)?.name ?? null }
            : u
        )
      );
    } catch (err) {
      console.error("[UsersPage] farm assignment failed:", err);
      alert("Couldn't assign that farm.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Review new accounts and manage access across every farm.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "All")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r === "All" ? "All roles" : r}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "All")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All statuses" : STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading users…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle size={20} className="text-[var(--color-danger)]" />
            <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-muted)]">No users match those filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Farm</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isBusy = pendingActionId === u.id;
                  return (
                    <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <UserRound size={15} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--color-foreground)]">{u.name}</p>
                            <p className="truncate text-xs text-[var(--color-muted)]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "Super Admin" ? (
                          <span className="text-xs text-[var(--color-muted)]">—</span>
                        ) : (
                          <FarmSelect
                            value={u.farmId ?? ""}
                            farms={farms}
                            allowUnassigned
                            onChange={(farmId) => void handleAssignFarm(u.id, farmId)}
                            onFarmCreated={(farm) => setFarms((prev) => [...prev, farm].sort((a, b) => a.name.localeCompare(b.name)))}
                            className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-xs text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountStatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-xs text-[var(--color-muted)]">You</span>
                        ) : isBusy ? (
                          <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                        ) : (
                          <div className="flex items-center gap-2">
                            {u.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleApprove(u.id)}
                                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                                >
                                  <Check size={13} /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(u.id)}
                                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                >
                                  <X size={13} /> Reject
                                </button>
                              </>
                            )}
                            {u.status === "active" && (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(u.id)}
                                className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                              >
                                Deactivate
                              </button>
                            )}
                            {u.status === "disabled" && (
                              <button
                                type="button"
                                onClick={() => void handleActivate(u.id)}
                                className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
