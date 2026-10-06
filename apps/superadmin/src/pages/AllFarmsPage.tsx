import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpDown, Building2, ChevronLeft, ChevronRight, Eye, Loader2, Search } from "lucide-react";
import { fetchAllFarmsData, type AllFarmsBulkData } from "@poultryhub/shared/services/farmMonitoringService";
import FarmStatusBadge from "@poultryhub/shared/components/farms/FarmStatusBadge";
import Button from "@poultryhub/shared/components/ui/Button";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import { useDashboardRealtime } from "../hooks/useDashboardRealtime";
import { formatFullAddress, formatAdmins } from "../lib/farmDisplay";
import { buildFarmDetailPath } from "../config/navigation";
import type { FarmStatus, ManagedFarm } from "@poultryhub/shared/types/farm";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

type SortKey = "name" | "registered";
const STATUS_FILTERS: (FarmStatus | "All")[] = ["All", "active", "inactive"];
const PAGE_SIZE = 10;

export default function AllFarmsPage() {
  const breakpoint = useBreakpoint();
  const [data, setData] = useState<AllFarmsBulkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FarmStatus | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      setData(await fetchAllFarmsData());
    } catch (err) {
      setLoadError(getErrorMessage(err, "Unable to load farms."));
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  // Keeps Staff counts (and the farm list itself) current — this page no
  // longer shows production/inventory KPIs (those live on the selected
  // farm's own detail page now), but staff assignment/farm registration can
  // still change while this list is open.
  useDashboardRealtime(true, () => void refresh(false));

  const staffCountByFarm = useMemo(() => {
    const counts = new Map<string, number>();
    if (!data) return counts;
    for (const u of data.users) {
      if (!u.farmId || u.role !== "Staff") continue;
      counts.set(u.farmId, (counts.get(u.farmId) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  // Archived farms are excluded from monitoring — the status filter below only offers Active/Inactive, matching that.
  const rows = useMemo<ManagedFarm[]>(() => (data ? data.farms.filter((farm) => farm.status !== "archived") : []), [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = rows.filter((farm) => {
      if (statusFilter !== "All" && farm.status !== statusFilter) return false;
      if (!term) return true;
      return (
        farm.name.toLowerCase().includes(term) ||
        (farm.owner ?? "").toLowerCase().includes(term) ||
        formatFullAddress(farm).toLowerCase().includes(term)
      );
    });
    result = [...result].sort((a, b) => {
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDesc ? -cmp : cmp;
    });
    return result;
  }, [rows, search, statusFilter, sortKey, sortDesc]);

  // Any filter/sort/search change can shrink the result set below the
  // current page — snap back to page 1 instead of showing an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortKey, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Building2 size={20} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">All Farms</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Select a farm to monitor its production, inventory, sales, and staff — read-only.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-muted-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
          <Eye size={12} /> Read-only Super Admin View
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search farm name, owner, or location…"
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
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          <option value="name">Sort by name</option>
          <option value="registered">Sort by registration date</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          title={sortDesc ? "Descending" : "Ascending"}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <ArrowUpDown size={14} /> {sortDesc ? "Desc" : "Asc"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading farms…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center text-sm text-[var(--color-muted)]">
          No farms match those filters.
        </div>
      ) : breakpoint === "mobile" ? (
        <div className="flex flex-col gap-3">
          {paginated.map((farm) => (
            <div key={farm.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--color-foreground)]">{farm.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">Owner: {farm.owner ?? "—"}</p>
                </div>
                <FarmStatusBadge status={farm.status} />
              </div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">{formatFullAddress(farm)}</p>

              <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
                <Stat label="Farm Admin" value={formatAdmins(farm)} />
                <Stat label="Staff" value={staffCountByFarm.get(farm.id) ?? 0} />
                <Stat label="Registered" value={new Date(farm.createdAt).toLocaleDateString()} />
              </div>

              <Link
                to={buildFarmDetailPath(farm.id)}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
              >
                <Eye size={14} /> View Farm
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">Farm</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Farm Admin</th>
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((farm) => (
                  <tr key={farm.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{farm.name}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{farm.owner ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{formatFullAddress(farm)}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{formatAdmins(farm)}</td>
                    <td className="px-4 py-3 text-[var(--color-foreground)]">{(staffCountByFarm.get(farm.id) ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(farm.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <FarmStatusBadge status={farm.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={buildFarmDetailPath(farm.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        style={{ width: "fit-content" }}
                      >
                        <Eye size={13} /> View Farm
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3">
            <p className="text-xs text-[var(--color-muted)]">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} farms
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] px-2 text-xs font-semibold text-white">
                  {currentPage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="truncate font-semibold text-[var(--color-foreground)]">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}
