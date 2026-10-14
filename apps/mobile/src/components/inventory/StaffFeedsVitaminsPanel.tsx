import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Pencil, Plus, Syringe, Wheat } from "lucide-react";
import { useRecordHighlight } from "@poultryhub/shared/hooks/useRecordHighlight";
import { useFeedConsumptionUnit } from "@poultryhub/shared/hooks/useFeedConsumptionUnit";
import FeedDistributionFormDrawer from "../feeds/FeedDistributionFormDrawer";
import VitaminAdministrationFormDrawer from "../feeds/VitaminAdministrationFormDrawer";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import {
  formatFeedStockTotal,
  formatFeedUsage,
  formatFeedUsageTotal,
  localIsoDate,
  formatUnitLabel,
  type FeedBatch,
  type FeedDistributionRecord,
  type VitaminAdministrationRecord,
  type VitaminBatch,
} from "@poultryhub/shared/types/feedVitamin";

type Tab = "feed" | "vitamins";
const todayIso = () => localIsoDate();

interface StaffFeedsVitaminsPanelProps {
  farmId: string;
  userId: string;
  /** The signed-in Staff member's own assignment, from their profile — Record Feed Distribution forces house/pen to this, never a free choice. */
  assignedPoultryHouseId: string | null;
  feedBatches: FeedBatch[];
  vitaminBatches: VitaminBatch[];
  feedDistribution: FeedDistributionRecord[];
  vitaminAdministration: VitaminAdministrationRecord[];
  refresh: () => Promise<void>;
}

export default function StaffFeedsVitaminsPanel({
  farmId,
  userId,
  assignedPoultryHouseId,
  feedBatches,
  vitaminBatches,
  feedDistribution,
  vitaminAdministration,
  refresh,
}: StaffFeedsVitaminsPanelProps) {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(location.pathname.endsWith("/vitamins") ? "vitamins" : "feed");
  const [editingFeedRecord, setEditingFeedRecord] = useState<FeedDistributionRecord | null | "new">(null);
  const [editingVitaminRecord, setEditingVitaminRecord] = useState<VitaminAdministrationRecord | null | "new">(null);

  const today = todayIso();
  const myFeedRecords = useMemo(() => feedDistribution.filter((r) => r.recordedById === userId), [feedDistribution, userId]);
  const myVitaminRecords = useMemo(() => vitaminAdministration.filter((r) => r.recordedById === userId), [vitaminAdministration, userId]);
  const highlightedId = useRecordHighlight(
    useMemo(() => [...myFeedRecords, ...myVitaminRecords].map((r) => r.id), [myFeedRecords, myVitaminRecords]),
    true
  );
  const rowClass = (id: string) =>
    `border-b border-[var(--color-border)] transition-colors last:border-0 ${id === highlightedId ? "bg-[var(--color-primary)]/10" : ""}`;
  const availableFeedBatches = useMemo(() => feedBatches.filter((f) => f.remainingStock > 0), [feedBatches]);
  const availableVitaminBatches = useMemo(() => vitaminBatches.filter((v) => v.remainingStock > 0), [vitaminBatches]);
  // The Farm Admin's farm-wide unit (Feed Consumption Settings) — Staff read it, never set it.
  const { unit: feedUnit, error: feedUnitError, reload: reloadFeedUnit } = useFeedConsumptionUnit(farmId);
  // Farm-wide approved usage today — the same rule (and the same number) the
  // Farm Admin's "Feed Used Today" shows; pending/rejected never count.
  const feedTodayRecords = useMemo(
    () => feedDistribution.filter((r) => r.status === "approved" && r.distributionDate === today),
    [feedDistribution, today]
  );
  const vitaminToday = useMemo(
    () => myVitaminRecords.filter((r) => r.status === "approved" && r.administrationDate === today).reduce((s, r) => s + r.quantityUsed, 0),
    [myVitaminRecords, today]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium" style={{ width: "fit-content" }}>
        <button
          type="button"
          onClick={() => setTab("feed")}
          className={`rounded-md px-3 py-1.5 transition-colors ${tab === "feed" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={() => setTab("vitamins")}
          className={`rounded-md px-3 py-1.5 transition-colors ${tab === "vitamins" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          Vitamins
        </button>
      </div>

      {tab === "feed" ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditingFeedRecord("new")}
              disabled={availableFeedBatches.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={15} /> Record Distribution
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile icon={Wheat} label="Fed Today" value={feedUnit ? formatFeedUsageTotal(feedTodayRecords, feedUnit) : feedUnitError ? "Unavailable" : "…"} />
            <StatTile icon={Wheat} label="Feed Stock" value={feedUnit ? formatFeedStockTotal(feedBatches, feedUnit) : feedUnitError ? "Unavailable" : "…"} />
          </div>
          {feedUnitError && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
              {feedUnitError}
              <button type="button" onClick={reloadFeedUnit} className="text-xs font-semibold text-[var(--color-primary)]">
                Retry
              </button>
            </div>
          )}

          <div>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">My Feed Records</h2>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {myFeedRecords.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No records yet — record today's feeding to get started.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Feed</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myFeedRecords.map((record) => (
                        <tr key={record.id} data-record-id={record.id} className={rowClass(record.id)}>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${record.distributionDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.feedName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{formatFeedUsage(record, feedUnit ?? record.enteredUnit)}</td>
                          <td className="px-4 py-3">
                            <ProductionStatusBadge status={record.status} />
                            {record.status === "rejected" && record.reviewNotes && (
                              <p className="mt-1 max-w-[220px] text-xs text-[var(--color-danger)]">{record.reviewNotes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {record.status !== "approved" ? (
                              <button
                                type="button"
                                onClick={() => setEditingFeedRecord(record)}
                                title="Edit"
                                className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                              >
                                <Pencil size={14} />
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--color-muted)]">—</span>
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditingVitaminRecord("new")}
              disabled={availableVitaminBatches.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={15} /> Record Administration
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile icon={Syringe} label="Used Today" value={vitaminToday} />
            <StatTile icon={Syringe} label="Available Vitamin Batches" value={availableVitaminBatches.length} />
          </div>

          <div>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">My Vitamin Records</h2>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {myVitaminRecords.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No records yet — record today's dosing to get started.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Vitamin</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 font-medium">Remarks</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myVitaminRecords.map((record) => (
                        <tr key={record.id} data-record-id={record.id} className={rowClass(record.id)}>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${record.administrationDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.vitaminName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{record.quantityUsed.toLocaleString()} {formatUnitLabel(record.unit, record.quantityUsed)}</td>
                          <td className="max-w-[200px] px-4 py-3 text-[var(--color-muted)]">{record.remarks ?? "—"}</td>
                          <td className="px-4 py-3">
                            <ProductionStatusBadge status={record.status} />
                            {record.status === "rejected" && record.reviewNotes && (
                              <p className="mt-1 max-w-[220px] text-xs text-[var(--color-danger)]">{record.reviewNotes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {record.status !== "approved" ? (
                              <button
                                type="button"
                                onClick={() => setEditingVitaminRecord(record)}
                                title="Edit"
                                className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                              >
                                <Pencil size={14} />
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--color-muted)]">—</span>
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

      {editingFeedRecord !== null && (
        <FeedDistributionFormDrawer
          record={editingFeedRecord === "new" ? null : editingFeedRecord}
          fixedFarmId={farmId}
          feedBatches={
            editingFeedRecord !== "new" && editingFeedRecord && !availableFeedBatches.some((f) => f.id === editingFeedRecord.feedId)
              ? [...availableFeedBatches, ...feedBatches.filter((f) => f.id === editingFeedRecord.feedId)]
              : availableFeedBatches
          }
          useResubmitFlow={editingFeedRecord !== "new"}
          assignedPoultryHouseId={assignedPoultryHouseId}
          onClose={() => setEditingFeedRecord(null)}
          onSaved={() => {
            setEditingFeedRecord(null);
            void refresh();
          }}
        />
      )}

      {editingVitaminRecord !== null && (
        <VitaminAdministrationFormDrawer
          record={editingVitaminRecord === "new" ? null : editingVitaminRecord}
          fixedFarmId={farmId}
          vitaminBatches={
            editingVitaminRecord !== "new" && editingVitaminRecord && !availableVitaminBatches.some((v) => v.id === editingVitaminRecord.vitaminId)
              ? [...availableVitaminBatches, ...vitaminBatches.filter((v) => v.id === editingVitaminRecord.vitaminId)]
              : availableVitaminBatches
          }
          useResubmitFlow={editingVitaminRecord !== "new"}
          assignedPoultryHouseId={assignedPoultryHouseId}
          onClose={() => setEditingVitaminRecord(null)}
          onSaved={() => {
            setEditingVitaminRecord(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
