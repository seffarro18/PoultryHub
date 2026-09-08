import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Check, Download, Egg, Pencil, Search, ShieldAlert, X } from "lucide-react";
import {
  approveEggProductionRecord,
  listEggProductionRecords,
  rejectEggProductionRecord,
} from "@poultryhub/shared/services/eggProductionService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import EggProductionFormDrawer from "../components/production/EggProductionFormDrawer";
import RejectRecordDialog from "../components/production/RejectRecordDialog";
import PageBackButton from "../components/PageBackButton";
import EggProductionTrendChart from "../components/production/EggProductionTrendChart";
import EggQualityBreakdownChart from "../components/production/EggQualityBreakdownChart";
import EggReportsSection from "@poultryhub/shared/components/production/EggReportsSection";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import Button from "@poultryhub/shared/components/ui/Button";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import EmptyState from "@poultryhub/shared/components/ui/EmptyState";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { remainingEggs, type EggProductionRecord, type ProductionStatus } from "@poultryhub/shared/types/eggProduction";
import { useAuth } from "@poultryhub/shared/context/AuthContext";

type Tab = "pending" | "approved" | "rejected" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-foreground)]">{value.toLocaleString()}</p>
    </div>
  );
}

export default function FarmEggProductionPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState<EggProductionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [correctingRecord, setCorrectingRecord] = useState<EggProductionRecord | null>(null);
  const [rejectingRecord, setRejectingRecord] = useState<EggProductionRecord | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRecords(await listEggProductionRecords());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load production records.");
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
      toast.success("Record approved.");
    } catch (err) {
      console.error("[FarmEggProductionPage] approve failed:", err);
      toast.error("Couldn't approve that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmReject = async (reason: string) => {
    const record = rejectingRecord;
    if (!record) return;
    setBusyId(record.id);
    try {
      await rejectEggProductionRecord(record.id, reason);
      setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: "rejected", reviewNotes: reason } : r)));
      toast.success("Record rejected.");
      setRejectingRecord(null);
    } catch (err) {
      console.error("[FarmEggProductionPage] reject failed:", err);
      toast.error("Couldn't reject that record.");
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
        <div className="flex items-center gap-3">
          <PageBackButton />
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Egg Production</h1>
        </div>
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
          <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
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

        <div className="mt-3">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ErrorState message={loadError} onRetry={refresh} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <EmptyState
                icon={Egg}
                title="No records match those filters"
                description="Try a different tab or search term."
              />
            </div>
          ) : (
            <StaggerGroup className="flex flex-col gap-3">
              {filtered.map((record) => (
                <StaggerItem key={record.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">
                        {new Date(`${record.productionDate}T00:00:00`).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">{record.housePen}</p>
                    </div>
                    <ProductionStatusBadge status={record.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Collected" value={record.eggsCollected} />
                    <Stat label="Good" value={record.goodEggs} />
                    <Stat label="Cracked" value={record.crackedEggs} />
                    <Stat label="Damaged" value={record.damagedEggs} />
                  </div>

                  <p className="mt-3 text-xs text-[var(--color-muted)]">
                    Recorded by {record.recordedByName ?? "—"}
                  </p>

                  {record.status === "rejected" && record.reviewNotes && (
                    <p className="mt-2 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                      {record.reviewNotes}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
                    {record.status === "pending" && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          icon={Check}
                          loading={busyId === record.id}
                          loadingText="Approving…"
                          onClick={() => void handleApprove(record)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          icon={X}
                          disabled={busyId === record.id}
                          onClick={() => setRejectingRecord(record)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      disabled={busyId === record.id}
                      onClick={() => setCorrectingRecord(record)}
                      className="ml-auto"
                    >
                      Correct
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </div>
      </div>

      <AnimatePresence>
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
      </AnimatePresence>

      <AnimatePresence>
        {rejectingRecord && (
          <RejectRecordDialog
            confirming={busyId === rejectingRecord.id}
            onCancel={() => setRejectingRecord(null)}
            onConfirm={(reason) => void handleConfirmReject(reason)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
