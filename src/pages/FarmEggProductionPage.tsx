import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Download, Loader2, Pencil, Search, ShieldAlert, X } from "lucide-react";
import {
  approveEggProductionRecord,
  listEggProductionRecords,
  rejectEggProductionRecord,
} from "../services/eggProductionService";
import { downloadCsv } from "../lib/exportCsv";
import EggProductionFormDrawer from "../components/production/EggProductionFormDrawer";
import EggProductionTrendChart from "../components/production/EggProductionTrendChart";
import EggQualityBreakdownChart from "../components/production/EggQualityBreakdownChart";
import EggReportsSection from "../components/production/EggReportsSection";
import ProductionStatusBadge from "../components/production/ProductionStatusBadge";
import { remainingEggs, type EggProductionRecord, type ProductionStatus } from "../types/eggProduction";
import { useAuth } from "../context/AuthContext";

type Tab = "pending" | "approved" | "rejected" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function FarmEggProductionPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<EggProductionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [correctingRecord, setCorrectingRecord] = useState<EggProductionRecord | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRecords(await listEggProductionRecords());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load production records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) void refresh();
    else setIsLoading(false);
  }, [user?.farmId]);

  const approvedRecords = useMemo(() => records.filter((r) => r.status === "approved"), [records]);

  const counts = useMemo(
    () => ({
      pending: records.filter((r) => r.status === "pending").length,
      approved: approvedRecords.length,
      rejected: records.filter((r) => r.status === "rejected").length,
      all: records.length,
    }),
    [records, approvedRecords]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (tab !== "all" && r.status !== (tab as ProductionStatus)) return false;
      if (term && !r.housePen.toLowerCase().includes(term) && !(r.recordedByName ?? "").toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [records, tab, search]);

  const handleApprove = async (record: EggProductionRecord) => {
    setBusyId(record.id);
    try {
      await approveEggProductionRecord(record.id);
      setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: "approved", reviewNotes: null } : r)));
    } catch (err) {
      console.error("[FarmEggProductionPage] approve failed:", err);
      alert("Couldn't approve that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (record: EggProductionRecord) => {
    const comment = window.prompt("Reason for rejecting this record (shown to the staff member who recorded it):");
    if (!comment || !comment.trim()) return;
    setBusyId(record.id);
    try {
      await rejectEggProductionRecord(record.id, comment.trim());
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: "rejected", reviewNotes: comment.trim() } : r))
      );
    } catch (err) {
      console.error("[FarmEggProductionPage] reject failed:", err);
      alert("Couldn't reject that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    downloadCsv(
      `egg-production-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        Date: r.productionDate,
        "House/Pen": r.housePen,
        Layers: r.layerCount,
        Collected: r.eggsCollected,
        Good: r.goodEggs,
        "Broken/Cracked": r.crackedEggs,
        Damaged: r.damagedEggs,
        Sold: r.eggsSold,
        Remaining: remainingEggs(r),
        Status: r.status,
        "Recorded By": r.recordedByName ?? "",
        "Reviewed By": r.reviewedByName ?? "",
      }))
    );
  };

  if (!user?.farmId) {
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
            Ask your Super Admin to assign your account to a farm before you can review production records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Egg Production</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Review, approve, and correct records submitted by staff.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EggProductionTrendChart records={approvedRecords} />
        <EggQualityBreakdownChart records={approvedRecords} />
      </div>

      <EggReportsSection records={approvedRecords} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Records</h2>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  tab === t.key
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {t.label} ({counts[t.key]})
              </button>
            ))}
          </div>

          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search house/pen or staff…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
              <Loader2 size={16} className="spinner" /> Loading records…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <AlertCircle size={20} className="text-[var(--color-danger)]" />
              <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No records match those filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Collected</th>
                    <th className="px-4 py-3 font-medium">Good</th>
                    <th className="px-4 py-3 font-medium">Broken/Cracked</th>
                    <th className="px-4 py-3 font-medium">Damaged</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">
                        {new Date(`${record.productionDate}T00:00:00`).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{record.eggsCollected.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.goodEggs.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.crackedEggs.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.damagedEggs.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.recordedByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ProductionStatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-3">
                        {busyId === record.id ? (
                          <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                        ) : (
                          <div className="flex items-center gap-1">
                            {record.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleApprove(record)}
                                  title="Approve"
                                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                                >
                                  <Check size={13} /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReject(record)}
                                  title="Reject"
                                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                >
                                  <X size={13} /> Reject
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setCorrectingRecord(record)}
                              title="Correct"
                              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                            >
                              <Pencil size={14} />
                            </button>
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
      </div>

      {correctingRecord && (
        <EggProductionFormDrawer
          record={correctingRecord}
          farms={[]}
          fixedFarmId={user.farmId}
          onClose={() => setCorrectingRecord(null)}
          onSaved={() => {
            setCorrectingRecord(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
