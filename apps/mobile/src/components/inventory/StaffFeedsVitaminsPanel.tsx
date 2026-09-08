import { useMemo, useState } from "react";
import { Pencil, Plus, Syringe, Wheat } from "lucide-react";
import FeedDistributionFormDrawer from "../feeds/FeedDistributionFormDrawer";
import VitaminAdministrationFormDrawer from "../feeds/VitaminAdministrationFormDrawer";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { FeedBatch, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";

type Tab = "feed" | "vitamins";
const todayIso = () => new Date().toISOString().slice(0, 10);

interface StaffFeedsVitaminsPanelProps {
  farmId: string;
  userId: string;
  feedBatches: FeedBatch[];
  vitaminBatches: VitaminBatch[];
  feedDistribution: FeedDistributionRecord[];
  vitaminAdministration: VitaminAdministrationRecord[];
  refresh: () => Promise<void>;
}

export default function StaffFeedsVitaminsPanel({
  farmId,
  userId,
  feedBatches,
  vitaminBatches,
  feedDistribution,
  vitaminAdministration,
  refresh,
}: StaffFeedsVitaminsPanelProps) {
  const [tab, setTab] = useState<Tab>("feed");
  const [editingFeedRecord, setEditingFeedRecord] = useState<FeedDistributionRecord | null | "new">(null);
  const [editingVitaminRecord, setEditingVitaminRecord] = useState<VitaminAdministrationRecord | null | "new">(null);

  const today = todayIso();
  const myFeedRecords = useMemo(() => feedDistribution.filter((r) => r.recordedById === userId), [feedDistribution, userId]);
  const myVitaminRecords = useMemo(() => vitaminAdministration.filter((r) => r.recordedById === userId), [vitaminAdministration, userId]);
  const availableFeedBatches = useMemo(() => feedBatches.filter((f) => f.remainingStock > 0), [feedBatches]);
  const availableVitaminBatches = useMemo(() => vitaminBatches.filter((v) => v.remainingStock > 0), [vitaminBatches]);
  const feedToday = useMemo(
    () => myFeedRecords.filter((r) => r.status === "approved" && r.distributionDate === today).reduce((s, r) => s + r.quantityUsed, 0),
    [myFeedRecords, today]
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
            <StatTile icon={Wheat} label="Fed Today" value={feedToday} />
            <StatTile icon={Wheat} label="Available Feed Batches" value={availableFeedBatches.length} />
          </div>

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
                        <th className="px-4 py-3 font-medium">Chickens</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myFeedRecords.map((record) => (
                        <tr key={record.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${record.distributionDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.feedName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{record.quantityUsed.toLocaleString()} {record.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.numberOfChickens.toLocaleString()}</td>
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
                        <th className="px-4 py-3 font-medium">Purpose</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myVitaminRecords.map((record) => (
                        <tr key={record.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${record.administrationDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.vitaminName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{record.quantityUsed.toLocaleString()} {record.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.purpose ?? "—"}</td>
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
