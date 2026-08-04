import { useEffect, useMemo, useState } from "react";
import { AlertCircle, KeyRound, Loader2, Mail, Pencil, Phone, Plus, Power, Search, ShieldAlert, UserPlus } from "lucide-react";
import {
  claimStaff,
  listFarmStaff,
  resetStaffPassword,
  setStaffStatus,
  type StaffMember,
} from "../services/staffService";
import StaffFormDrawer from "../components/staff/StaffFormDrawer";
import AccountStatusBadge from "../components/users/AccountStatusBadge";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import type { AccountStatus } from "../types/auth";

const STATUS_FILTERS: (AccountStatus | "All")[] = ["All", "pending", "active", "disabled"];

interface StaffActionsProps {
  member: StaffMember;
  isBusy: boolean;
  compact?: boolean;
  onClaim: (member: StaffMember) => void;
  onEdit: (member: StaffMember) => void;
  onToggleStatus: (member: StaffMember) => void;
  onResetPassword: (member: StaffMember) => void;
}

/** Row/card actions — shared so mobile cards and the desktop table stay in sync. */
function StaffActions({ member, isBusy, compact, onClaim, onEdit, onToggleStatus, onResetPassword }: StaffActionsProps) {
  if (isBusy) return <Loader2 size={15} className="spinner text-[var(--color-muted)]" />;

  if (member.farmId === null) {
    return (
      <button
        type="button"
        onClick={() => onClaim(member)}
        className={`flex items-center justify-center gap-1.5 rounded-lg font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 ${
          compact ? "w-full py-2.5 text-sm" : "px-2 py-1 text-xs"
        }`}
      >
        <UserPlus size={compact ? 15 : 13} /> Claim to My Farm
      </button>
    );
  }

  const buttonClass = compact
    ? "flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium hover:bg-[var(--color-muted-bg)]"
    : "rounded-md p-1.5 hover:bg-[var(--color-muted-bg)]";
  const iconSize = compact ? 17 : 14;

  return (
    <div className={compact ? "flex items-stretch gap-1.5" : "flex items-center gap-1"}>
      <button
        type="button"
        onClick={() => onEdit(member)}
        title="Edit"
        className={`${buttonClass} text-[var(--color-muted)] hover:text-[var(--color-foreground)]`}
      >
        <Pencil size={iconSize} />
        {compact && "Edit"}
      </button>
      <button
        type="button"
        onClick={() => onToggleStatus(member)}
        title={member.status === "active" ? "Deactivate" : "Activate"}
        className={`${buttonClass} ${member.status === "active" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}
      >
        <Power size={iconSize} />
        {compact && (member.status === "active" ? "Deactivate" : "Activate")}
      </button>
      <button
        type="button"
        onClick={() => onResetPassword(member)}
        title="Reset password"
        className={`${buttonClass} text-[var(--color-muted)] hover:text-[var(--color-foreground)]`}
      >
        <KeyRound size={iconSize} />
        {compact && "Reset"}
      </button>
    </div>
  );
}

export default function StaffManagementPage() {
  const { user } = useAuth();
  const breakpoint = useBreakpoint();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "All">("All");
  const [editingStaff, setEditingStaff] = useState<StaffMember | null | "new">(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setStaff(await listFarmStaff());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "Farm Admin") void refresh();
    else setIsLoading(false);
  }, [user?.role]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      if (
        term &&
        !s.name.toLowerCase().includes(term) &&
        !s.email.toLowerCase().includes(term) &&
        !(s.employeeId ?? "").toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [staff, search, statusFilter]);

  const handleClaim = async (member: StaffMember) => {
    if (!user?.farmId) return;
    setBusyId(member.id);
    try {
      await claimStaff(member.id, user.farmId);
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, farmId: user.farmId, status: "active" } : s)));
    } catch (err) {
      console.error("[StaffManagementPage] claim failed:", err);
      alert("Couldn't claim that staff member.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    const nextStatus: AccountStatus = member.status === "active" ? "disabled" : "active";
    if (nextStatus === "disabled" && !window.confirm(`Deactivate ${member.name}? They'll lose access immediately.`))
      return;
    setBusyId(member.id);
    try {
      await setStaffStatus(member.id, nextStatus);
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, status: nextStatus } : s)));
    } catch (err) {
      console.error("[StaffManagementPage] status change failed:", err);
      alert("Couldn't update that account.");
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    setBusyId(member.id);
    try {
      await resetStaffPassword(member.email);
      alert(`Password reset email sent to ${member.email}.`);
    } catch (err) {
      console.error("[StaffManagementPage] reset password failed:", err);
      alert("Couldn't send a reset email.");
    } finally {
      setBusyId(null);
    }
  };

  if (user?.role !== "Farm Admin") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Farm Admin only</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Staff Management is available to Farm Admin accounts only.
          </p>
        </div>
      </div>
    );
  }

  if (!user.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">
            Not assigned to a farm yet
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can manage staff.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Staff Management</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Add and manage staff assigned to your farm.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingStaff("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Add Staff
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or employee ID…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "All")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading staff…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center text-sm text-[var(--color-muted)]">
          No staff match those filters.
        </div>
      ) : breakpoint === "mobile" ? (
        // Mobile: one card per staff member — every field visible without a
        // horizontal scroll, actions right on the card instead of behind a tap.
        <div className="flex flex-col gap-3">
          {filtered.map((member) => (
            <div key={member.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--color-foreground)]">{member.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--color-muted)]">
                    <Mail size={11} /> {member.email}
                  </p>
                  {member.contactNumber && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted)]">
                      <Phone size={11} /> {member.contactNumber}
                    </p>
                  )}
                </div>
                <AccountStatusBadge status={member.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
                <div>
                  <p className="text-[var(--color-muted)]">Employee ID</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{member.employeeId ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)]">Position</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{member.position ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)]">House/Pen</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{member.assignedHousePen ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)]">Employment</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{member.employmentStatus ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--color-muted)]">Joined</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <StaffActions
                  member={member}
                  isBusy={busyId === member.id}
                  compact
                  onClaim={handleClaim}
                  onEdit={setEditingStaff}
                  onToggleStatus={handleToggleStatus}
                  onResetPassword={handleResetPassword}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Employee ID</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">House/Pen</th>
                  <th className="px-4 py-3 font-medium">Account Status</th>
                  <th className="px-4 py-3 font-medium">Employment</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-foreground)]">{member.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{member.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{member.employeeId ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{member.position ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{member.contactNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{member.assignedHousePen ?? "—"}</td>
                    <td className="px-4 py-3">
                      <AccountStatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{member.employmentStatus ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StaffActions
                        member={member}
                        isBusy={busyId === member.id}
                        onClaim={handleClaim}
                        onEdit={setEditingStaff}
                        onToggleStatus={handleToggleStatus}
                        onResetPassword={handleResetPassword}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingStaff !== null && (
        <StaffFormDrawer
          staff={editingStaff === "new" ? null : editingStaff}
          farmId={user.farmId}
          onClose={() => setEditingStaff(null)}
          onSaved={() => {
            setEditingStaff(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
