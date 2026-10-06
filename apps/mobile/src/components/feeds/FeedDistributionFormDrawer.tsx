import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Minus, Plus, X } from "lucide-react";
import {
  createApprovedFeedDistributionRecord,
  createFeedDistributionRecord,
  resubmitFeedDistributionRecord,
  updateFeedDistributionRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import PoultryHouseSelect from "../production/PoultryHouseSelect";
import StaffAssignedHouseField, { type AssignedHouseState } from "./StaffAssignedHouseField";
import { formatFeedPackaging, type FeedBatch, type FeedDistributionInput, type FeedDistributionRecord } from "@poultryhub/shared/types/feedVitamin";
import type { PoultryHouse } from "@poultryhub/shared/types/poultryHouse";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

interface FeedDistributionFormDrawerProps {
  /** null = create mode */
  record: FeedDistributionRecord | null;
  fixedFarmId: string;
  /** Batches Staff/Farm Admin can pick from — the record's own current batch is always included even if depleted, so editing an existing record doesn't lose its selection. */
  feedBatches: FeedBatch[];
  /** Staff correcting their own rejected/pending record — saves via resubmit (flips rejected -> pending, clears the reviewer's comment). */
  useResubmitFlow?: boolean;
  /** Farm Admin/Manager recording their own usage — create mode only, saves pre-approved instead of pending (they already hold review authority). */
  createApproved?: boolean;
  /**
   * Farm Admin/Manager only — lets them pick (and inline-register) any of
   * the farm's houses/pens, same restriction as PoultryEventFormDrawer's own
   * canManageHouses. Staff never gets a choice here at all: when this is
   * false, the field is forced to their own assignedPoultryHouseId, shown as
   * read-only text — not a disabled dropdown, not free text.
   */
  canManageHouses?: boolean;
  /** Staff only (ignored when canManageHouses is true) — the signed-in Staff member's own assignment, from their profile. */
  assignedPoultryHouseId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: FeedDistributionRecord | null, fixedFarmId: string, defaultFeedId: string): FeedDistributionInput {
  if (record) {
    return {
      farmId: record.farmId,
      feedId: record.feedId,
      housePen: record.housePen,
      houseId: record.houseId,
      quantityUsed: record.quantityUsed,
      unit: record.unit,
      distributionDate: record.distributionDate,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    feedId: defaultFeedId,
    housePen: "",
    houseId: null,
    quantityUsed: 1,
    unit: "",
    distributionDate: new Date().toISOString().slice(0, 10),
    remarks: null,
  };
}

export default function FeedDistributionFormDrawer({
  record,
  fixedFarmId,
  feedBatches,
  useResubmitFlow = false,
  createApproved = false,
  canManageHouses = false,
  assignedPoultryHouseId = null,
  onClose,
  onSaved,
}: FeedDistributionFormDrawerProps) {
  const isEdit = record !== null;
  const [input, setInput] = useState<FeedDistributionInput>(() =>
    toInputState(record, fixedFarmId, feedBatches[0]?.id ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedHouseState, setAssignedHouseState] = useState<AssignedHouseState>("loading");

  const selectedBatch = useMemo(() => feedBatches.find((f) => f.id === input.feedId), [feedBatches, input.feedId]);
  // When editing an already-approved record, its own quantity_used was
  // already deducted from remainingStock — so the real ceiling on a
  // correction is what's left PLUS what this record already took, not the
  // batch's current remainingStock alone (which would make 2->3 look like
  // "not enough stock" even when it's actually fine).
  const availableForThisRecord =
    (selectedBatch?.remainingStock ?? 0) + (isEdit && record.feedId === input.feedId && record.status === "approved" ? record.quantityUsed : 0);

  const handleFeedChange = (feedId: string) => {
    const batch = feedBatches.find((f) => f.id === feedId);
    setInput((prev) => ({ ...prev, feedId, unit: batch?.unit ?? prev.unit, quantityUsed: 1 }));
    setError(null);
  };

  const handleAssignedHouseResolved = (house: PoultryHouse | null) => {
    setInput((prev) => ({ ...prev, houseId: house?.id ?? null, housePen: house?.name ?? "" }));
  };

  const adjustQuantity = (delta: number) => {
    setInput((prev) => ({ ...prev, quantityUsed: Math.max(1, Math.min(availableForThisRecord || 1, prev.quantityUsed + delta)) }));
    setError(null);
  };

  const staffBlocked = !canManageHouses && assignedHouseState !== "resolved";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.feedId) {
      setError("Select a feed batch.");
      return;
    }
    if (!canManageHouses && assignedHouseState === "unassigned") {
      setError("No poultry house/pen assigned. Please contact your Farm Admin.");
      return;
    }
    if (!input.houseId) {
      setError("Poultry House/Pen is required.");
      return;
    }
    if (input.quantityUsed <= 0) {
      setError("Quantity used must be greater than zero.");
      return;
    }
    if (selectedBatch && input.quantityUsed > availableForThisRecord) {
      setError(`Insufficient feed stock. Only ${availableForThisRecord.toLocaleString()} ${selectedBatch.unit} available.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitFeedDistributionRecord(record.id, input);
        } else {
          await updateFeedDistributionRecord(record.id, input);
        }
      } else if (createApproved) {
        await createApprovedFeedDistributionRecord(input);
      } else {
        await createFeedDistributionRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[FeedDistributionFormDrawer] save failed:", err);
      setError(getErrorMessage(err, "Couldn't save this record. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Feed Distribution" : "Record Feed Distribution"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {record?.status === "rejected" && record.reviewNotes && (
              <div className="flex items-start gap-2.5 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2.5 text-sm text-[var(--color-danger)]">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Rejected{record.reviewedByName ? ` by ${record.reviewedByName}` : ""}</p>
                  <p className="mt-0.5">{record.reviewNotes}</p>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fd-feed" className="text-sm font-medium text-[var(--color-foreground)]">
                Feed
              </label>
              <select
                id="fd-feed"
                value={input.feedId}
                onChange={(e) => handleFeedChange(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              >
                <option value="" disabled>
                  Select a feed batch…
                </option>
                {feedBatches.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.feedName} — {formatFeedPackaging(f.packageSize)} ({f.remainingStock.toLocaleString()} {f.unit} left{f.batchNumber ? ` · ${f.batchNumber}` : ""})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fd-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Date
                </label>
                <input
                  id="fd-date"
                  type="date"
                  value={input.distributionDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, distributionDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fd-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                  Poultry House / Pen
                </label>
                {canManageHouses ? (
                  <PoultryHouseSelect
                    id="fd-house-pen"
                    farmId={input.farmId}
                    value={input.houseId ?? ""}
                    canManage
                    onChange={(house) => {
                      setInput((prev) => ({ ...prev, houseId: house?.id ?? null, housePen: house?.name ?? "" }));
                      setError(null);
                    }}
                  />
                ) : (
                  <StaffAssignedHouseField
                    id="fd-house-pen"
                    farmId={input.farmId}
                    assignedPoultryHouseId={assignedPoultryHouseId}
                    onResolved={handleAssignedHouseResolved}
                    onStateChange={setAssignedHouseState}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-foreground)]">
                Quantity Used {selectedBatch ? `(${selectedBatch.unit})` : ""}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => adjustQuantity(-1)}
                  disabled={input.quantityUsed <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:opacity-40"
                >
                  <Minus size={15} />
                </button>
                <span className="w-10 text-center text-base font-semibold text-[var(--color-foreground)]">{input.quantityUsed}</span>
                <button
                  type="button"
                  onClick={() => adjustQuantity(1)}
                  disabled={!selectedBatch || input.quantityUsed >= availableForThisRecord}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>
              </div>
              {selectedBatch && (
                <p className="text-xs text-[var(--color-muted)]">
                  Available: {availableForThisRecord.toLocaleString()} {selectedBatch.unit}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fd-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks
              </label>
              <textarea
                id="fd-remarks"
                value={input.remarks ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, remarks: e.target.value || null }))}
                rows={2}
                placeholder="Optional"
                className="resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || staffBlocked}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Record distribution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
