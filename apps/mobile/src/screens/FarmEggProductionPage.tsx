import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Check, Download, Egg, Pencil, Search, ShieldAlert, X } from "lucide-react";
import {
  approveEggProductionRecord,
  listEggProductionRecords,
  rejectEggProductionRecord,
} from "@poultryhub/shared/services/eggProductionService";
import { currentStockByType, listInventoryEvents } from "@poultryhub/shared/services/poultryInventoryService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { getProductionSettings } from "@poultryhub/shared/services/eggPricingService";
import { listLayerBreeds } from "@poultryhub/shared/services/layerBreedService";
import type { EggColor } from "@poultryhub/shared/types/layerBreed";
import EggColorBadge from "@poultryhub/shared/components/inventory/EggColorBadge";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import EggProductionFormDrawer from "../components/production/EggProductionFormDrawer";
import RejectRecordDialog from "../components/production/RejectRecordDialog";
import ProductionSettingsFormDrawer from "../components/production/ProductionSettingsFormDrawer";
import PageBackButton from "../components/PageBackButton";
import EggProductionTrendChart from "../components/production/EggProductionTrendChart";
import EggQualityBreakdownChart from "../components/production/EggQualityBreakdownChart";
import { useEggProductionRealtime } from "../hooks/useEggProductionRealtime";
import EggReportsSection from "@poultryhub/shared/components/production/EggReportsSection";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import Button from "@poultryhub/shared/components/ui/Button";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import EmptyState from "@poultryhub/shared/components/ui/EmptyState";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import {
  EGGS_PER_TRAY,
  remainingEggs,
  type EggProductionRecord,
  type ProductionStatus,
} from "@poultryhub/shared/types/eggProduction";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

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

  // Expected Daily Egg Production — a farm-level estimate (Active Layers x a
  // configurable rate), entirely separate from each record's own
  // numberOfTrays (good eggs / 30 eggs per tray). Active Layers is sourced
  // from Poultry Inventory's real tracked stock, so this page also fetches
  // events/mortality records it otherwise wouldn't need.
  const [activeLayers, setActiveLayers] = useState(0);
  const [expectedRate, setExpectedRate] = useState(70);
  const [editingRate, setEditingRate] = useState(false);
  // Layer Breed/Strain(s) this farm has actually recorded arrivals of (Poultry
  // Inventory), with egg color — shown alongside Active Layers so the related
  // flock's breed is visible right where its stock count already is.
  const [layerBreeds, setLayerBreeds] = useState<{ name: string; eggColor: EggColor }[]>([]);

  const refreshProductionSettings = async () => {
    try {
      const [events, mortalityRecords, settings, breedCatalog] = await Promise.all([
        listInventoryEvents(),
        listMortalityRecords(),
        getProductionSettings(),
        listLayerBreeds(),
      ]);
      setActiveLayers(currentStockByType(events, mortalityRecords).Layer ?? 0);
      if (settings) setExpectedRate(settings.expectedProductionRate);

      const breedNames = new Set(
        events.filter((e) => e.birdType === "Layer" && e.eventType === "arrival" && e.breed).map((e) => e.breed as string)
      );
      setLayerBreeds(
        [...breedNames].map((name) => ({
          name,
          eggColor: breedCatalog.find((b) => b.name === name)?.eggColor ?? "Other",
        }))
      );
    } catch (err) {
      console.error("[FarmEggProductionPage] failed to load expected production data:", err);
    }
  };

  const refresh = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      setRecords(await listEggProductionRecords());
    } catch (err) {
      console.error("[FarmEggProductionPage] failed to load records:", err);
      setLoadError(getErrorMessage(err, "Unable to load egg production records."));
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) {
      void refresh();
      void refreshProductionSettings();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.farmId]);

  // Staff submits → INSERT lands in egg_production → this refetches (no
  // spinner flash) so the record shows up under Pending immediately, without
  // the Farm Admin needing to reload the page. Approve/reject writes from
  // this same page loop back through here too, but the local setRecords in
  // handleApprove/handleConfirmReject already applied instantly, so the
  // debounced refetch just reconciles.
  useEggProductionRealtime(user?.farmId, () => void refresh(false));

  const approvedRecords = useMemo(() => records.filter((r) => r.status === "approved"), [records]);

  const expectedEggsToday = Math.round(activeLayers * (expectedRate / 100));
  const actualCollectedToday = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return approvedRecords.filter((r) => r.productionDate === todayKey).reduce((sum, r) => sum + r.eggsCollected, 0);
  }, [approvedRecords]);
  const productionDifference = actualCollectedToday - expectedEggsToday;

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
      if (!term) return true;
      const dateLabel = new Date(`${r.productionDate}T00:00:00`).toLocaleDateString().toLowerCase();
      return (
        r.housePen.toLowerCase().includes(term) ||
        (r.recordedByName ?? "").toLowerCase().includes(term) ||
        r.productionDate.toLowerCase().includes(term) ||
        dateLabel.includes(term)
      );
    });
  }, [records, tab, search]);

  const emptyState = useMemo(() => {
    if (search.trim()) {
      return { title: "No records match those filters", description: "Try a different tab or search term." };
    }
    if (records.length === 0) {
      return { title: "No egg production records yet.", description: "Staff submissions will appear here for review." };
    }
    if (tab === "pending") {
      return { title: "No pending records.", description: "New Staff submissions will appear here." };
    }
    return { title: `No ${tab === "all" ? "" : tab} records.`, description: "Try a different tab." };
  }, [search, records.length, tab]);

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
        Trays: Number(r.numberOfTrays.toFixed(2)),
        "Eggs/Tray": EGGS_PER_TRAY,
        Collected: r.eggsCollected,
        Good: r.goodEggs,
        Peewee: r.peeweeEggs,
        Small: r.smallEggs,
        Medium: r.mediumEggs,
        Large: r.largeEggs,
        "X Large": r.xLargeEggs,
        Jumbo: r.jumboEggs,
        "Damaged/Cracked": r.damagedCrackedEggs,
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
              <ErrorState message={loadError} onRetry={() => void refresh()} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <EmptyState icon={Egg} title={emptyState.title} description={emptyState.description} />
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
                    <Stat label="Damaged/Cracked" value={record.damagedCrackedEggs} />
                    <Stat label="Trays" value={record.numberOfTrays} />
                  </div>

                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Peewee {record.peeweeEggs} · Small {record.smallEggs} · Medium {record.mediumEggs} · Large {record.largeEggs} · X Large{" "}
                    {record.xLargeEggs} · Jumbo {record.jumboEggs}
                  </p>

                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Recorded by {record.recordedByName ?? "—"} · Submitted {new Date(record.createdAt).toLocaleString()}
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

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Expected Daily Egg Production</h2>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditingRate(true)}>
            Edit Production Rate
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          An estimate only — actual production always comes from the records above, not this figure.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Active Layers" value={activeLayers} />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Expected Rate</p>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{expectedRate}%</p>
          </div>
          <Stat label="Expected Eggs/Day" value={expectedEggsToday} />
        </div>

        {layerBreeds.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Layer Breed / Strain</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {layerBreeds.map((b) => (
                <span key={b.name} className="flex items-center gap-1.5 text-sm text-[var(--color-foreground)]">
                  {b.name}
                  <EggColorBadge eggColor={b.eggColor} />
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-3">
          <Stat label="Expected Today" value={expectedEggsToday} />
          <Stat label="Actual Collected" value={actualCollectedToday} />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Difference</p>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              {productionDifference === 0
                ? "On target"
                : productionDifference > 0
                  ? `${productionDifference} eggs above expected`
                  : `${Math.abs(productionDifference)} eggs below expected`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EggProductionTrendChart records={approvedRecords} />
        <EggQualityBreakdownChart records={approvedRecords} />
      </div>

      <EggReportsSection records={approvedRecords} />

      <AnimatePresence>
        {correctingRecord && (
          <EggProductionFormDrawer
            record={correctingRecord}
            farms={[]}
            fixedFarmId={user.farmId}
            canManageHouses
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

      <AnimatePresence>
        {editingRate && (
          <ProductionSettingsFormDrawer
            farmId={user.farmId}
            currentRate={expectedRate}
            onClose={() => setEditingRate(false)}
            onSaved={() => {
              setEditingRate(false);
              void refreshProductionSettings();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
