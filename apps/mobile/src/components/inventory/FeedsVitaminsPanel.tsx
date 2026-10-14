import { useMemo, useState } from "react";
import { AlertTriangle, Check, History, Loader2, Pencil, Plus, Search, Syringe, Trash2, Wheat, X } from "lucide-react";
import {
  approveFeedDistributionRecord,
  approveVitaminAdministrationRecord,
  archiveFeedBatch,
  archiveVitaminBatch,
  deleteVitaminAdministrationRecord,
  expiringVitamins,
  lowStockFeeds,
  lowStockVitamins,
  rejectFeedDistributionRecord,
  rejectVitaminAdministrationRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import FeedBatchFormDrawer from "../feeds/FeedBatchFormDrawer";
import VitaminBatchFormDrawer from "../feeds/VitaminBatchFormDrawer";
import FeedDistributionFormDrawer from "../feeds/FeedDistributionFormDrawer";
import VitaminAdministrationFormDrawer from "../feeds/VitaminAdministrationFormDrawer";
import ArchiveStockConfirmModal from "../feeds/ArchiveStockConfirmModal";
import FeedConsumptionSettingsCard from "../feeds/FeedConsumptionSettingsCard";
import InventoryHistoryPanel from "./InventoryHistoryPanel";
import InventoryStatusBadge from "@poultryhub/shared/components/feeds/InventoryStatusBadge";
import ExpiryStatusBadge from "@poultryhub/shared/components/feeds/ExpiryStatusBadge";
import ConfirmDialog from "@poultryhub/shared/components/layout/ConfirmDialog";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import {
  feedStockStatus,
  formatFeedPackaging,
  formatFeedStock,
  formatFeedStockTotal,
  formatFeedUsage,
  formatFeedUsageTotal,
  localIsoDate,
  formatUnitLabel,
  vitaminExpiryStatus,
  vitaminStockStatus,
  type FeedBatch,
  type FeedDistributionRecord,
  type VitaminAdministrationRecord,
  type VitaminBatch,
} from "@poultryhub/shared/types/feedVitamin";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import { useRecordHighlight } from "@poultryhub/shared/hooks/useRecordHighlight";
import { useFeedConsumptionUnit } from "@poultryhub/shared/hooks/useFeedConsumptionUnit";
import { formatUnitSummary } from "@poultryhub/shared/services/feedVitaminService";

type Tab = "feed" | "vitamins" | "history";
const todayIso = () => localIsoDate();

interface FeedsVitaminsPanelProps {
  farmId: string;
  feedBatches: FeedBatch[];
  vitaminBatches: VitaminBatch[];
  feedDistribution: FeedDistributionRecord[];
  vitaminAdministration: VitaminAdministrationRecord[];
  refresh: () => Promise<void>;
  initialTab?: Tab;
}

export default function FeedsVitaminsPanel({
  farmId,
  feedBatches,
  vitaminBatches,
  feedDistribution,
  vitaminAdministration,
  refresh,
  initialTab = "feed",
}: FeedsVitaminsPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  // The farm-wide display unit (Feed Consumption Settings) — same source Staff and the dashboards read.
  const { unit: feedUnit, error: feedUnitError, reload: reloadFeedUnit } = useFeedConsumptionUnit(farmId);

  const [feedSearch, setFeedSearch] = useState("");
  const [vitaminSearch, setVitaminSearch] = useState("");
  const [editingFeedBatch, setEditingFeedBatch] = useState<FeedBatch | null | "new">(null);
  const [editingVitaminBatch, setEditingVitaminBatch] = useState<VitaminBatch | null | "new">(null);
  const [correctingFeedRecord, setCorrectingFeedRecord] = useState<FeedDistributionRecord | null | "new">(null);
  const [correctingVitaminRecord, setCorrectingVitaminRecord] = useState<VitaminAdministrationRecord | null | "new">(null);
  const [archivingFeedBatch, setArchivingFeedBatch] = useState<FeedBatch | null>(null);
  const [archivingVitaminBatch, setArchivingVitaminBatch] = useState<VitaminBatch | null>(null);
  const [deletingVitaminRecord, setDeletingVitaminRecord] = useState<VitaminAdministrationRecord | null>(null);

  // Notification deep links (?record=<id>) — the panel only mounts once its
  // records have loaded, so they're ready immediately.
  const highlightedId = useRecordHighlight(
    useMemo(() => [...feedDistribution, ...vitaminAdministration].map((r) => r.id), [feedDistribution, vitaminAdministration]),
    true
  );
  const rowClass = (id: string) =>
    `border-b border-[var(--color-border)] transition-colors last:border-0 ${id === highlightedId ? "bg-[var(--color-primary)]/10" : ""}`;

  const availableFeedBatches = useMemo(() => feedBatches.filter((f) => f.remainingStock > 0), [feedBatches]);
  const availableVitaminBatches = useMemo(() => vitaminBatches.filter((v) => v.remainingStock > 0), [vitaminBatches]);

  const today = todayIso();
  // Approved only — the same rule that deducts stock (pending/rejected never count).
  const feedTodayRecords = useMemo(
    () => feedDistribution.filter((r) => r.status === "approved" && r.distributionDate === today),
    [feedDistribution, today]
  );
  const vitaminToday = useMemo(
    () => vitaminAdministration.filter((r) => r.status === "approved" && r.administrationDate === today).reduce((s, r) => s + r.quantityUsed, 0),
    [vitaminAdministration, today]
  );
  const lowFeedCount = useMemo(() => lowStockFeeds(feedBatches).length, [feedBatches]);
  const lowVitaminCount = useMemo(() => lowStockVitamins(vitaminBatches).length, [vitaminBatches]);
  const expiringCount = useMemo(() => expiringVitamins(vitaminBatches).length, [vitaminBatches]);

  const filteredFeed = useMemo(() => {
    const term = feedSearch.trim().toLowerCase();
    if (!term) return feedBatches;
    return feedBatches.filter((f) => f.feedName.toLowerCase().includes(term) || (f.batchNumber ?? "").toLowerCase().includes(term));
  }, [feedBatches, feedSearch]);

  // Every purchase is its own batch (own expiry date), so a vitamin bought
  // twice shows as two rows — this is the combined remaining per vitamin.
  const vitaminTotals = useMemo(() => {
    const totals = new Map<string, { name: string; unit: string; remaining: number; batches: number }>();
    for (const v of vitaminBatches) {
      const key = `${v.vitaminName.trim().toLowerCase()}|${v.unit}`;
      const entry = totals.get(key) ?? { name: v.vitaminName, unit: v.unit, remaining: 0, batches: 0 };
      entry.remaining += v.remainingStock;
      entry.batches += 1;
      totals.set(key, entry);
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [vitaminBatches]);

  const filteredVitamins = useMemo(() => {
    const term = vitaminSearch.trim().toLowerCase();
    if (!term) return vitaminBatches;
    return vitaminBatches.filter((v) => v.vitaminName.toLowerCase().includes(term) || (v.batchNumber ?? "").toLowerCase().includes(term));
  }, [vitaminBatches, vitaminSearch]);

  const handleConfirmArchiveFeed = async () => {
    if (!archivingFeedBatch) return;
    setBusyId(archivingFeedBatch.id);
    try {
      await archiveFeedBatch(archivingFeedBatch.id);
      toast.success("Feed stock archived.");
      setArchivingFeedBatch(null);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] archive feed batch failed:", err);
      toast.error(getErrorMessage(err, "Couldn't archive this batch."));
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmArchiveVitamin = async () => {
    if (!archivingVitaminBatch) return;
    setBusyId(archivingVitaminBatch.id);
    try {
      await archiveVitaminBatch(archivingVitaminBatch.id);
      toast.success("Vitamin stock archived.");
      setArchivingVitaminBatch(null);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] archive vitamin batch failed:", err);
      toast.error(getErrorMessage(err, "Couldn't archive this batch."));
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveFeed = async (record: FeedDistributionRecord) => {
    setBusyId(record.id);
    try {
      await approveFeedDistributionRecord(record.id);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] approve feed distribution failed:", err);
      alert(getErrorMessage(err, "Couldn't approve that record."));
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectFeed = async (record: FeedDistributionRecord) => {
    const comment = window.prompt("Reason for rejecting this record (shown to the staff member who recorded it):");
    if (!comment || !comment.trim()) return;
    setBusyId(record.id);
    try {
      await rejectFeedDistributionRecord(record.id, comment.trim());
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] reject feed distribution failed:", err);
      alert(getErrorMessage(err, "Couldn't reject that record."));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveVitamin = async (record: VitaminAdministrationRecord) => {
    setBusyId(record.id);
    try {
      await approveVitaminAdministrationRecord(record.id);
      toast.success(`Approved — ${record.quantityUsed.toLocaleString()} ${formatUnitLabel(record.unit, record.quantityUsed)} deducted from ${record.vitaminName}.`);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] approve vitamin administration failed:", err);
      alert(getErrorMessage(err, "Couldn't approve that record."));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDeleteVitaminRecord = async () => {
    const record = deletingVitaminRecord;
    if (!record) return;
    setBusyId(record.id);
    try {
      await deleteVitaminAdministrationRecord(record.id);
      toast.success(
        record.status === "approved"
          ? `Record deleted — ${record.quantityUsed.toLocaleString()} ${formatUnitLabel(record.unit, record.quantityUsed)} returned to ${record.vitaminName}.`
          : "Record deleted."
      );
      setDeletingVitaminRecord(null);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] delete vitamin administration failed:", err);
      toast.error(getErrorMessage(err, "Couldn't delete this record."));
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectVitamin = async (record: VitaminAdministrationRecord) => {
    const comment = window.prompt("Reason for rejecting this record (shown to the staff member who recorded it):");
    if (!comment || !comment.trim()) return;
    setBusyId(record.id);
    try {
      await rejectVitaminAdministrationRecord(record.id, comment.trim());
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] reject vitamin administration failed:", err);
      alert(getErrorMessage(err, "Couldn't reject that record."));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {feedUnitError && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
          {feedUnitError}
          <button type="button" onClick={reloadFeedUnit} className="text-xs font-semibold text-[var(--color-primary)]">
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Wheat} label="Feed Stock" value={feedUnit ? formatFeedStockTotal(feedBatches, feedUnit) : feedUnitError ? "Unavailable" : "…"} />
        <StatTile icon={Syringe} label="Vitamin Stock" value={formatUnitSummary(vitaminBatches)} />
        <StatTile icon={Wheat} label="Feed Used Today" value={feedUnit ? formatFeedUsageTotal(feedTodayRecords, feedUnit) : feedUnitError ? "Unavailable" : "…"} />
        <StatTile icon={Syringe} label="Vitamin Used Today" value={vitaminToday} />
        <StatTile icon={AlertTriangle} label="Low Stock Alerts" value={lowFeedCount + lowVitaminCount} />
        <StatTile icon={AlertTriangle} label="Expiring Vitamins" value={expiringCount} />
      </div>

      <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium" style={{ width: "fit-content" }}>
        <button
          type="button"
          onClick={() => setTab("feed")}
          className={`rounded-md px-3 py-1.5 transition-colors ${tab === "feed" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          Feed Inventory
        </button>
        <button
          type="button"
          onClick={() => setTab("vitamins")}
          className={`rounded-md px-3 py-1.5 transition-colors ${tab === "vitamins" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          Vitamins Inventory
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${tab === "history" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          <History size={13} /> History
        </button>
      </div>

      {tab === "history" ? (
        <InventoryHistoryPanel onRestored={() => void refresh()} />
      ) : tab === "feed" ? (
        <>
          <FeedConsumptionSettingsCard farmId={farmId} />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Feed Batches</h2>
              <button
                type="button"
                onClick={() => setEditingFeedBatch("new")}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
              >
                <Plus size={15} /> Add Feed Stock
              </button>
            </div>
            <div className="relative mt-3 max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="search"
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                placeholder="Search feed or batch…"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {filteredFeed.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No feed batches match that search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Feed</th>
                        <th className="px-4 py-3 font-medium">Brand</th>
                        <th className="px-4 py-3 font-medium">Batch</th>
                        <th className="px-4 py-3 font-medium">Remaining</th>
                        <th className="px-4 py-3 font-medium">Expiration</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFeed.map((f) => (
                        <tr key={f.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--color-foreground)]">{f.feedName}</p>
                            <p className="text-xs text-[var(--color-muted)]">{f.category ?? "Uncategorized"}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{f.brand ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{f.batchNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">
                            {formatFeedStock(f.remainingStock, f.packageSize, feedUnit ?? "sack")}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{f.expirationDate ? new Date(f.expirationDate).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-3">
                            <InventoryStatusBadge status={feedStockStatus(f.remainingStock)} />
                          </td>
                          <td className="px-4 py-3">
                            {busyId === f.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setEditingFeedBatch(f)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => setArchivingFeedBatch(f)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
                                  <Trash2 size={14} />
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

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Feed Distribution Records</h2>
              <button
                type="button"
                onClick={() => setCorrectingFeedRecord("new")}
                disabled={availableFeedBatches.length === 0}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus size={15} /> Record Distribution
              </button>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {feedDistribution.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No distribution records yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Feed</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 font-medium">Recorded By</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedDistribution.map((r) => (
                        <tr key={r.id} data-record-id={r.id} className={rowClass(r.id)}>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${r.distributionDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.feedName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{formatFeedUsage(r, feedUnit ?? r.enteredUnit)}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordedByName ?? "—"}</td>
                          <td className="px-4 py-3">
                            <ProductionStatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3">
                            {busyId === r.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                {r.status === "pending" && (
                                  <>
                                    <button type="button" onClick={() => void handleApproveFeed(r)} title="Approve" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/10">
                                      <Check size={13} /> Approve
                                    </button>
                                    <button type="button" onClick={() => void handleRejectFeed(r)} title="Reject" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
                                      <X size={13} /> Reject
                                    </button>
                                  </>
                                )}
                                <button type="button" onClick={() => setCorrectingFeedRecord(r)} title="Correct" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
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
        </>
      ) : (
        <>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Vitamin Batches</h2>
              <button
                type="button"
                onClick={() => setEditingVitaminBatch("new")}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
              >
                <Plus size={15} /> Add Vitamin Stock
              </button>
            </div>
            <div className="relative mt-3 max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="search"
                value={vitaminSearch}
                onChange={(e) => setVitaminSearch(e.target.value)}
                placeholder="Search vitamin or batch…"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>
            {vitaminTotals.some((t) => t.batches > 1) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {vitaminTotals.map((t) => (
                  <span key={`${t.name}|${t.unit}`} className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-[var(--color-muted)]">
                    {t.name}: <span className="font-semibold text-[var(--color-foreground)]">{t.remaining.toLocaleString()} {formatUnitLabel(t.unit, t.remaining)}</span>
                    {t.batches > 1 ? ` · ${t.batches} batches` : ""}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {filteredVitamins.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No vitamin batches match that search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Vitamin</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Unit</th>
                        <th className="px-4 py-3 font-medium">Package Size</th>
                        <th className="px-4 py-3 font-medium">Remaining</th>
                        <th className="px-4 py-3 font-medium">Expiration</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVitamins.map((v) => (
                        <tr key={v.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--color-foreground)]">{v.vitaminName}</p>
                            <p className="text-xs text-[var(--color-muted)]">Purchased {new Date(`${v.purchaseDate.slice(0, 10)}T00:00:00`).toLocaleDateString()}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{v.category ?? "Uncategorized"}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{formatUnitLabel(v.unit)}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{v.packageSize ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{v.remainingStock.toLocaleString()} {formatUnitLabel(v.unit, v.remainingStock)}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">
                            {v.expirationDate ? (
                              <div className="flex flex-col items-start gap-1">
                                <span>{new Date(`${v.expirationDate.slice(0, 10)}T00:00:00`).toLocaleDateString()}</span>
                                <ExpiryStatusBadge status={vitaminExpiryStatus(v.expirationDate) ?? "normal"} />
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <InventoryStatusBadge status={vitaminStockStatus(v.remainingStock)} />
                          </td>
                          <td className="px-4 py-3">
                            {busyId === v.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setEditingVitaminBatch(v)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => setArchivingVitaminBatch(v)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
                                  <Trash2 size={14} />
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

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Vitamin Administration Records</h2>
              <button
                type="button"
                onClick={() => setCorrectingVitaminRecord("new")}
                disabled={availableVitaminBatches.length === 0}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus size={15} /> Record Administration
              </button>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {vitaminAdministration.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No administration records yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Vitamin</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Quantity Used</th>
                        <th className="px-4 py-3 font-medium">Stock</th>
                        <th className="px-4 py-3 font-medium">Recorded By</th>
                        <th className="px-4 py-3 font-medium">Remarks</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitaminAdministration.map((r) => (
                        <tr key={r.id} data-record-id={r.id} className={rowClass(r.id)}>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${r.administrationDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.vitaminName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{r.quantityUsed.toLocaleString()} {formatUnitLabel(r.unit, r.quantityUsed)}</td>
                          <td className="px-4 py-3 text-xs">
                            {r.status === "approved" && r.stockBefore !== null && r.stockAfter !== null ? (
                              // Recorded by the database at the moment of approval (migration 0042) — not computed here.
                              <span className="text-[var(--color-foreground)]">
                                {r.stockBefore.toLocaleString()} → <span className="font-semibold">{r.stockAfter.toLocaleString()}</span>{" "}
                                {formatUnitLabel(r.unit, r.stockAfter)}
                              </span>
                            ) : r.status === "pending" ? (
                              <span className="text-[var(--color-muted)]">Not deducted yet</span>
                            ) : r.status === "rejected" ? (
                              <span className="text-[var(--color-muted)]">Unchanged</span>
                            ) : (
                              <span className="text-[var(--color-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordedByName ?? "—"}</td>
                          <td className="max-w-[200px] px-4 py-3 text-[var(--color-muted)]">{r.remarks ?? "—"}</td>
                          <td className="px-4 py-3">
                            <ProductionStatusBadge status={r.status} />
                            {r.status !== "pending" && r.reviewedByName && (
                              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                                by {r.reviewedByName}
                                {r.reviewedAt ? ` · ${new Date(r.reviewedAt).toLocaleString()}` : ""}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {busyId === r.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                {r.status === "pending" && (
                                  <>
                                    <button type="button" onClick={() => void handleApproveVitamin(r)} title="Approve" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/10">
                                      <Check size={13} /> Approve
                                    </button>
                                    <button type="button" onClick={() => void handleRejectVitamin(r)} title="Reject" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
                                      <X size={13} /> Reject
                                    </button>
                                  </>
                                )}
                                <button type="button" onClick={() => setCorrectingVitaminRecord(r)} title="Correct" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => setDeletingVitaminRecord(r)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
                                  <Trash2 size={14} />
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
        </>
      )}

      {editingFeedBatch !== null && (
        <FeedBatchFormDrawer
          batch={editingFeedBatch === "new" ? null : editingFeedBatch}
          fixedFarmId={farmId}
          onClose={() => setEditingFeedBatch(null)}
          onSaved={() => {
            setEditingFeedBatch(null);
            void refresh();
          }}
        />
      )}

      {editingVitaminBatch !== null && (
        <VitaminBatchFormDrawer
          batch={editingVitaminBatch === "new" ? null : editingVitaminBatch}
          fixedFarmId={farmId}
          onClose={() => setEditingVitaminBatch(null)}
          onSaved={() => {
            setEditingVitaminBatch(null);
            void refresh();
          }}
        />
      )}

      {correctingFeedRecord !== null && (
        <FeedDistributionFormDrawer
          record={correctingFeedRecord === "new" ? null : correctingFeedRecord}
          fixedFarmId={farmId}
          feedBatches={
            correctingFeedRecord === "new"
              ? availableFeedBatches
              : availableFeedBatches.some((f) => f.id === correctingFeedRecord.feedId)
                ? availableFeedBatches
                : [...availableFeedBatches, ...feedBatches.filter((f) => f.id === correctingFeedRecord.feedId)]
          }
          createApproved={correctingFeedRecord === "new"}
          canManageHouses
          onClose={() => setCorrectingFeedRecord(null)}
          onSaved={() => {
            setCorrectingFeedRecord(null);
            void refresh();
          }}
        />
      )}

      {correctingVitaminRecord !== null && (
        <VitaminAdministrationFormDrawer
          record={correctingVitaminRecord === "new" ? null : correctingVitaminRecord}
          fixedFarmId={farmId}
          vitaminBatches={
            correctingVitaminRecord === "new"
              ? availableVitaminBatches
              : availableVitaminBatches.some((v) => v.id === correctingVitaminRecord.vitaminId)
                ? availableVitaminBatches
                : [...availableVitaminBatches, ...vitaminBatches.filter((v) => v.id === correctingVitaminRecord.vitaminId)]
          }
          createApproved={correctingVitaminRecord === "new"}
          canManageHouses
          onClose={() => setCorrectingVitaminRecord(null)}
          onSaved={() => {
            setCorrectingVitaminRecord(null);
            void refresh();
          }}
        />
      )}

      {archivingFeedBatch && (
        <ArchiveStockConfirmModal
          title="Delete Feed Stock?"
          itemLabel={archivingFeedBatch.feedName}
          quantityLabel={`${archivingFeedBatch.remainingStock.toLocaleString()} × ${formatFeedPackaging(archivingFeedBatch.packageSize)} remaining`}
          hasUsage={archivingFeedBatch.remainingStock < archivingFeedBatch.quantity}
          busy={busyId === archivingFeedBatch.id}
          onCancel={() => setArchivingFeedBatch(null)}
          onConfirm={() => void handleConfirmArchiveFeed()}
        />
      )}

      {archivingVitaminBatch && (
        <ArchiveStockConfirmModal
          title="Delete Vitamin Stock?"
          itemLabel={archivingVitaminBatch.vitaminName}
          quantityLabel={`${archivingVitaminBatch.remainingStock.toLocaleString()} ${formatUnitLabel(archivingVitaminBatch.unit, archivingVitaminBatch.remainingStock)} remaining`}
          hasUsage={archivingVitaminBatch.remainingStock < archivingVitaminBatch.quantity}
          busy={busyId === archivingVitaminBatch.id}
          onCancel={() => setArchivingVitaminBatch(null)}
          onConfirm={() => void handleConfirmArchiveVitamin()}
        />
      )}

      {deletingVitaminRecord && (
        <ConfirmDialog
          title="Delete Vitamin Record?"
          message={
            deletingVitaminRecord.status === "approved"
              ? `${deletingVitaminRecord.quantityUsed.toLocaleString()} ${formatUnitLabel(deletingVitaminRecord.unit, deletingVitaminRecord.quantityUsed)} will be returned to ${deletingVitaminRecord.vitaminName} stock.`
              : "This record was never deducted from stock, so stock stays the same."
          }
          confirmLabel={busyId === deletingVitaminRecord.id ? "Deleting…" : "Delete"}
          onCancel={() => setDeletingVitaminRecord(null)}
          onConfirm={() => {
            if (busyId !== deletingVitaminRecord.id) void handleConfirmDeleteVitaminRecord();
          }}
        />
      )}
    </div>
  );
}
