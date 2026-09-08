import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil, Plus, Search, Syringe, Trash2, Wheat, X } from "lucide-react";
import {
  approveFeedDistributionRecord,
  approveVitaminAdministrationRecord,
  deleteFeedBatch,
  deleteVitaminBatch,
  expiringVitamins,
  formatUnitSummary,
  lowStockFeeds,
  lowStockVitamins,
  rejectFeedDistributionRecord,
  rejectVitaminAdministrationRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import FeedBatchFormDrawer from "../feeds/FeedBatchFormDrawer";
import VitaminBatchFormDrawer from "../feeds/VitaminBatchFormDrawer";
import FeedDistributionFormDrawer from "../feeds/FeedDistributionFormDrawer";
import VitaminAdministrationFormDrawer from "../feeds/VitaminAdministrationFormDrawer";
import InventoryStatusBadge from "@poultryhub/shared/components/feeds/InventoryStatusBadge";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { FeedBatch, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";

type Tab = "feed" | "vitamins";
const todayIso = () => new Date().toISOString().slice(0, 10);

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

  const [feedSearch, setFeedSearch] = useState("");
  const [vitaminSearch, setVitaminSearch] = useState("");
  const [editingFeedBatch, setEditingFeedBatch] = useState<FeedBatch | null | "new">(null);
  const [editingVitaminBatch, setEditingVitaminBatch] = useState<VitaminBatch | null | "new">(null);
  const [correctingFeedRecord, setCorrectingFeedRecord] = useState<FeedDistributionRecord | null>(null);
  const [correctingVitaminRecord, setCorrectingVitaminRecord] = useState<VitaminAdministrationRecord | null>(null);

  const today = todayIso();
  const feedToday = useMemo(
    () => feedDistribution.filter((r) => r.status === "approved" && r.distributionDate === today).reduce((s, r) => s + r.quantityUsed, 0),
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

  const filteredVitamins = useMemo(() => {
    const term = vitaminSearch.trim().toLowerCase();
    if (!term) return vitaminBatches;
    return vitaminBatches.filter((v) => v.vitaminName.toLowerCase().includes(term) || (v.batchNumber ?? "").toLowerCase().includes(term));
  }, [vitaminBatches, vitaminSearch]);

  const handleDeleteFeedBatch = async (batch: FeedBatch) => {
    if (!window.confirm(`Delete ${batch.feedName} (${batch.batchNumber ?? "no batch #"})?`)) return;
    setBusyId(batch.id);
    try {
      await deleteFeedBatch(batch.id);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] delete feed batch failed:", err);
      alert("Couldn't delete this batch — it may already have distribution history recorded against it.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteVitaminBatch = async (batch: VitaminBatch) => {
    if (!window.confirm(`Delete ${batch.vitaminName} (${batch.batchNumber ?? "no batch #"})?`)) return;
    setBusyId(batch.id);
    try {
      await deleteVitaminBatch(batch.id);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] delete vitamin batch failed:", err);
      alert("Couldn't delete this batch — it may already have administration history recorded against it.");
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
      alert(err instanceof Error ? err.message : "Couldn't approve that record.");
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
      alert("Couldn't reject that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveVitamin = async (record: VitaminAdministrationRecord) => {
    setBusyId(record.id);
    try {
      await approveVitaminAdministrationRecord(record.id);
      await refresh();
    } catch (err) {
      console.error("[FeedsVitaminsPanel] approve vitamin administration failed:", err);
      alert(err instanceof Error ? err.message : "Couldn't approve that record.");
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
      alert("Couldn't reject that record.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Wheat} label="Feed Stock" value={formatUnitSummary(feedBatches)} />
        <StatTile icon={Syringe} label="Vitamin Stock" value={formatUnitSummary(vitaminBatches)} />
        <StatTile icon={Wheat} label="Feed Used Today" value={feedToday} />
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
      </div>

      {tab === "feed" ? (
        <>
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
                        <th className="px-4 py-3 font-medium">Batch</th>
                        <th className="px-4 py-3 font-medium">Remaining</th>
                        <th className="px-4 py-3 font-medium">Min. Level</th>
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
                          <td className="px-4 py-3 text-[var(--color-muted)]">{f.batchNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{f.remainingStock.toLocaleString()} {f.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{f.minimumStockLevel.toLocaleString()} {f.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{f.expirationDate ? new Date(f.expirationDate).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-3">
                            <InventoryStatusBadge remainingStock={f.remainingStock} minimumStockLevel={f.minimumStockLevel} />
                          </td>
                          <td className="px-4 py-3">
                            {busyId === f.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setEditingFeedBatch(f)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => void handleDeleteFeedBatch(f)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
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
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Feed Distribution Records</h2>
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
                        <th className="px-4 py-3 font-medium">Chickens</th>
                        <th className="px-4 py-3 font-medium">Recorded By</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedDistribution.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${r.distributionDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.feedName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{r.quantityUsed.toLocaleString()} {r.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.numberOfChickens.toLocaleString()}</td>
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
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {filteredVitamins.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No vitamin batches match that search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Vitamin</th>
                        <th className="px-4 py-3 font-medium">Batch</th>
                        <th className="px-4 py-3 font-medium">Remaining</th>
                        <th className="px-4 py-3 font-medium">Min. Level</th>
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
                            <p className="text-xs text-[var(--color-muted)]">{v.category ?? "Uncategorized"}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{v.batchNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{v.remainingStock.toLocaleString()} {v.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{v.minimumStockLevel.toLocaleString()} {v.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(v.expirationDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <InventoryStatusBadge remainingStock={v.remainingStock} minimumStockLevel={v.minimumStockLevel} />
                          </td>
                          <td className="px-4 py-3">
                            {busyId === v.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setEditingVitaminBatch(v)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => void handleDeleteVitaminBatch(v)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
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
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Vitamin Administration Records</h2>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {vitaminAdministration.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No administration records yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Vitamin</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 font-medium">Recorded By</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitaminAdministration.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${r.administrationDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.vitaminName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{r.quantityUsed.toLocaleString()} {r.unit}</td>
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

      {correctingFeedRecord && (
        <FeedDistributionFormDrawer
          record={correctingFeedRecord}
          fixedFarmId={farmId}
          feedBatches={feedBatches}
          onClose={() => setCorrectingFeedRecord(null)}
          onSaved={() => {
            setCorrectingFeedRecord(null);
            void refresh();
          }}
        />
      )}

      {correctingVitaminRecord && (
        <VitaminAdministrationFormDrawer
          record={correctingVitaminRecord}
          fixedFarmId={farmId}
          vitaminBatches={vitaminBatches}
          onClose={() => setCorrectingVitaminRecord(null)}
          onSaved={() => {
            setCorrectingVitaminRecord(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
