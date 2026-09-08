import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ChartColumn,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  Search,
  Trash2,
  UserCog,
} from "lucide-react";
import { deleteFarm, listManagedFarms, setFarmStatus } from "@poultryhub/shared/services/farmService";
import { listEggProductionRecords } from "@poultryhub/shared/services/eggProductionService";
import { listInventoryEvents } from "@poultryhub/shared/services/poultryInventoryService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { listUsers, type ManagedUser } from "@poultryhub/shared/services/userManagementService";
import FarmFormDrawer from "../components/farms/FarmFormDrawer";
import FarmAdminAssignmentDrawer from "../components/farms/FarmAdminAssignmentDrawer";
import FarmStatsDrawer from "../components/farms/FarmStatsDrawer";
import DeleteFarmDialog from "../components/farms/DeleteFarmDialog";
import FarmStatusBadge from "@poultryhub/shared/components/farms/FarmStatusBadge";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import type { EggProductionRecord } from "@poultryhub/shared/types/eggProduction";
import type { FarmStatus, ManagedFarm } from "@poultryhub/shared/types/farm";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

const STATUS_FILTERS: (FarmStatus | "All")[] = ["All", "active", "inactive", "archived"];

function formatLocation(farm: ManagedFarm): string {
  return [farm.city, farm.province].filter(Boolean).join(", ") || "—";
}

interface FarmActionsProps {
  farm: ManagedFarm;
  isBusy: boolean;
  compact?: boolean;
  onViewStats: (farm: ManagedFarm) => void;
  onAssignAdmin: (farm: ManagedFarm) => void;
  onEdit: (farm: ManagedFarm) => void;
  onToggleActive: (farm: ManagedFarm) => void;
  onArchiveToggle: (farm: ManagedFarm) => void;
  onDelete: (farm: ManagedFarm) => void;
}

/** Row/card actions — shared so mobile cards and the desktop table stay in sync. */
function FarmActions({
  farm,
  isBusy,
  compact,
  onViewStats,
  onAssignAdmin,
  onEdit,
  onToggleActive,
  onArchiveToggle,
  onDelete,
}: FarmActionsProps) {
  if (isBusy) return <Loader2 size={15} className="spinner text-[var(--color-muted)]" />;

  const buttonClass = compact
    ? "flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium hover:bg-[var(--color-muted-bg)]"
    : "rounded-md p-1.5 hover:bg-[var(--color-muted-bg)]";
  const iconSize = compact ? 16 : 14;

  return (
    <div className={compact ? "flex flex-wrap items-stretch gap-1.5" : "flex items-center gap-1"}>
      <button
        type="button"
        onClick={() => onViewStats(farm)}
        title="Statistics"
        className={`${buttonClass} text-[var(--color-muted)] hover:text-[var(--color-foreground)]`}
      >
        <ChartColumn size={iconSize} />
        {compact && "Stats"}
      </button>
      <button
        type="button"
        onClick={() => onAssignAdmin(farm)}
        title="Assign Admin"
        className={`${buttonClass} text-[var(--color-muted)] hover:text-[var(--color-foreground)]`}
      >
        <UserCog size={iconSize} />
        {compact && "Assign"}
      </button>
      <button
        type="button"
        onClick={() => onEdit(farm)}
        title="Edit"
        className={`${buttonClass} text-[var(--color-muted)] hover:text-[var(--color-foreground)]`}
      >
        <Pencil size={iconSize} />
        {compact && "Edit"}
      </button>
      {farm.status !== "archived" && (
        <button
          type="button"
          onClick={() => onToggleActive(farm)}
          title={farm.status === "active" ? "Deactivate" : "Activate"}
          className={`${buttonClass} ${farm.status === "active" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}
        >
          <Power size={iconSize} />
          {compact && (farm.status === "active" ? "Deactivate" : "Activate")}
        </button>
      )}
      <button
        type="button"
        onClick={() => onArchiveToggle(farm)}
        title={farm.status === "archived" ? "Unarchive" : "Archive"}
        className={`${buttonClass} text-[var(--color-muted)] hover:text-[var(--color-foreground)]`}
      >
        {farm.status === "archived" ? <ArchiveRestore size={iconSize} /> : <Archive size={iconSize} />}
        {compact && (farm.status === "archived" ? "Unarchive" : "Archive")}
      </button>
      <button
        type="button"
        onClick={() => onDelete(farm)}
        title="Delete"
        className={`${buttonClass} text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10`}
      >
        <Trash2 size={iconSize} />
        {compact && "Delete"}
      </button>
    </div>
  );
}

export default function FarmsPage() {
  const breakpoint = useBreakpoint();
  const [searchParams] = useSearchParams();
  const [farms, setFarms] = useState<ManagedFarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Prefilled when arriving from the Locations map's "View Farm Details" link (?search=<farm name>).
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<FarmStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<string | "All">("All");
  const [cityFilter, setCityFilter] = useState<string | "All">("All");

  const [editingFarm, setEditingFarm] = useState<ManagedFarm | null | "new">(null);
  const [assigningFarm, setAssigningFarm] = useState<ManagedFarm | null>(null);
  const [deletingFarm, setDeletingFarm] = useState<ManagedFarm | null>(null);
  const [statsFarm, setStatsFarm] = useState<ManagedFarm | null>(null);

  // Cross-farm data for the statistics drawer — fetched once, lazily, on the
  // first "View Statistics" click, then reused for every farm after that.
  const [statsSource, setStatsSource] = useState<{
    users: ManagedUser[];
    productionRecords: EggProductionRecord[];
    inventoryEvents: PoultryEvent[];
    mortalityRecords: MortalityRecord[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setFarms(await listManagedFarms());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load farms.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const typeOptions = useMemo(
    () => [...new Set(farms.map((f) => f.farmType).filter((t): t is string => Boolean(t)))].sort(),
    [farms]
  );
  const cityOptions = useMemo(
    () => [...new Set(farms.map((f) => f.city).filter((c): c is string => Boolean(c)))].sort(),
    [farms]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return farms.filter((f) => {
      if (statusFilter !== "All" && f.status !== statusFilter) return false;
      if (typeFilter !== "All" && f.farmType !== typeFilter) return false;
      if (cityFilter !== "All" && f.city !== cityFilter) return false;
      if (
        term &&
        !f.name.toLowerCase().includes(term) &&
        !(f.owner ?? "").toLowerCase().includes(term) &&
        !(f.city ?? "").toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [farms, search, statusFilter, typeFilter, cityFilter]);

  const handleToggleActive = async (farm: ManagedFarm) => {
    const next: FarmStatus = farm.status === "active" ? "inactive" : "active";
    setBusyId(farm.id);
    try {
      await setFarmStatus(farm.id, next);
      setFarms((prev) => prev.map((f) => (f.id === farm.id ? { ...f, status: next } : f)));
    } catch (err) {
      console.error("[FarmsPage] status change failed:", err);
      alert("Couldn't update that farm's status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveToggle = async (farm: ManagedFarm) => {
    const next: FarmStatus = farm.status === "archived" ? "active" : "archived";
    if (next === "archived" && !window.confirm(`Archive ${farm.name}? It'll be hidden from active lists — you can unarchive it later.`))
      return;
    setBusyId(farm.id);
    try {
      await setFarmStatus(farm.id, next);
      setFarms((prev) => prev.map((f) => (f.id === farm.id ? { ...f, status: next } : f)));
    } catch (err) {
      console.error("[FarmsPage] archive toggle failed:", err);
      alert("Couldn't update that farm.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingFarm) return;
    const id = deletingFarm.id;
    setBusyId(id);
    try {
      await deleteFarm(id);
      setFarms((prev) => prev.filter((f) => f.id !== id));
      setDeletingFarm(null);
    } catch (err) {
      console.error("[FarmsPage] delete failed:", err);
      alert("Couldn't delete that farm.");
    } finally {
      setBusyId(null);
    }
  };

  const handleViewStats = async (farm: ManagedFarm) => {
    setStatsFarm(farm);
    if (statsSource) return;
    setStatsLoading(true);
    try {
      const [users, productionRecords, inventoryEvents, mortalityRecords] = await Promise.all([
        listUsers(),
        listEggProductionRecords(),
        listInventoryEvents(),
        listMortalityRecords(),
      ]);
      setStatsSource({ users, productionRecords, inventoryEvents, mortalityRecords });
    } catch (err) {
      console.error("[FarmsPage] failed to load statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Farm Management</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Register and manage every farm on the platform.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingFarm("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Register Farm
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, owner, or location…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FarmStatus | "All")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        {typeOptions.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
          >
            <option value="All">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {cityOptions.length > 0 && (
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
          >
            <option value="All">All municipalities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading farms…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center text-sm text-[var(--color-muted)]">
          No farms match those filters.
        </div>
      ) : breakpoint === "mobile" ? (
        <div className="flex flex-col gap-3">
          {filtered.map((farm) => (
            <div key={farm.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--color-foreground)]">{farm.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">{farm.farmType ?? "Type not set"}</p>
                </div>
                <FarmStatusBadge status={farm.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
                <div>
                  <p className="text-[var(--color-muted)]">Owner</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{farm.owner ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)]">Capacity</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{farm.capacity?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--color-muted)]">Location</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{formatLocation(farm)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--color-muted)]">Contact</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[var(--color-foreground)]">
                    {farm.contactNumber ? <Phone size={11} /> : null} {farm.contactNumber ?? farm.email ?? "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--color-muted)]">Farm Admin(s)</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">
                    {farm.admins.length > 0 ? farm.admins.map((a) => a.name).join(", ") : "Unassigned"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--color-muted)]">Date Registered</p>
                  <p className="mt-0.5 text-[var(--color-foreground)]">{new Date(farm.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <FarmActions
                  farm={farm}
                  isBusy={busyId === farm.id}
                  compact
                  onViewStats={(f) => void handleViewStats(f)}
                  onAssignAdmin={setAssigningFarm}
                  onEdit={setEditingFarm}
                  onToggleActive={(f) => void handleToggleActive(f)}
                  onArchiveToggle={(f) => void handleArchiveToggle(f)}
                  onDelete={setDeletingFarm}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">Farm</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Capacity</th>
                  <th className="px-4 py-3 font-medium">Farm Admin(s)</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date Registered</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((farm) => (
                  <tr key={farm.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-foreground)]">{farm.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{farm.farmType ?? "Type not set"}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{farm.owner ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{formatLocation(farm)}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {farm.contactNumber && (
                        <p className="flex items-center gap-1">
                          <Phone size={11} /> {farm.contactNumber}
                        </p>
                      )}
                      {farm.email && (
                        <p className="flex items-center gap-1">
                          <Mail size={11} /> {farm.email}
                        </p>
                      )}
                      {!farm.contactNumber && !farm.email && "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{farm.capacity?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {farm.admins.length > 0 ? farm.admins.map((a) => a.name).join(", ") : "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <FarmStatusBadge status={farm.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(farm.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <FarmActions
                        farm={farm}
                        isBusy={busyId === farm.id}
                        onViewStats={(f) => void handleViewStats(f)}
                        onAssignAdmin={setAssigningFarm}
                        onEdit={setEditingFarm}
                        onToggleActive={(f) => void handleToggleActive(f)}
                        onArchiveToggle={(f) => void handleArchiveToggle(f)}
                        onDelete={setDeletingFarm}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingFarm !== null && (
        <FarmFormDrawer
          farm={editingFarm === "new" ? null : editingFarm}
          onClose={() => setEditingFarm(null)}
          onSaved={() => {
            setEditingFarm(null);
            void refresh();
          }}
        />
      )}

      {assigningFarm && (
        <FarmAdminAssignmentDrawer
          farm={assigningFarm}
          onClose={() => setAssigningFarm(null)}
          onSaved={() => {
            setAssigningFarm(null);
            void refresh();
          }}
        />
      )}

      {statsFarm && (
        <FarmStatsDrawer
          farm={statsFarm}
          isLoading={statsLoading || !statsSource}
          users={statsSource?.users ?? []}
          productionRecords={statsSource?.productionRecords ?? []}
          inventoryEvents={statsSource?.inventoryEvents ?? []}
          mortalityRecords={statsSource?.mortalityRecords ?? []}
          onClose={() => setStatsFarm(null)}
        />
      )}

      {deletingFarm && (
        <DeleteFarmDialog farm={deletingFarm} onCancel={() => setDeletingFarm(null)} onConfirm={() => void handleDeleteConfirmed()} />
      )}
    </div>
  );
}
