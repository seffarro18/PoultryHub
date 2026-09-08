import { useMemo, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  createFeedDistributionRecord,
  resubmitFeedDistributionRecord,
  updateFeedDistributionRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import type { FeedBatch, FeedDistributionInput, FeedDistributionRecord } from "@poultryhub/shared/types/feedVitamin";

interface FeedDistributionFormDrawerProps {
  /** null = create mode */
  record: FeedDistributionRecord | null;
  fixedFarmId: string;
  /** Batches Staff/Farm Admin can pick from — the record's own current batch is always included even if depleted, so editing an existing record doesn't lose its selection. */
  feedBatches: FeedBatch[];
  /** Staff correcting their own rejected/pending record — saves via resubmit (flips rejected -> pending, clears the reviewer's comment). */
  useResubmitFlow?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: FeedDistributionRecord | null, fixedFarmId: string, defaultFeedId: string): FeedDistributionInput {
  if (record) {
    return {
      farmId: record.farmId,
      feedId: record.feedId,
      housePen: record.housePen,
      quantityUsed: record.quantityUsed,
      unit: record.unit,
      numberOfChickens: record.numberOfChickens,
      distributionDate: record.distributionDate,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    feedId: defaultFeedId,
    housePen: "",
    quantityUsed: 0,
    unit: "",
    numberOfChickens: 0,
    distributionDate: new Date().toISOString().slice(0, 10),
    remarks: null,
  };
}

export default function FeedDistributionFormDrawer({
  record,
  fixedFarmId,
  feedBatches,
  useResubmitFlow = false,
  onClose,
  onSaved,
}: FeedDistributionFormDrawerProps) {
  const isEdit = record !== null;
  const [input, setInput] = useState<FeedDistributionInput>(() =>
    toInputState(record, fixedFarmId, feedBatches[0]?.id ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBatch = useMemo(() => feedBatches.find((f) => f.id === input.feedId), [feedBatches, input.feedId]);

  const handleFeedChange = (feedId: string) => {
    const batch = feedBatches.find((f) => f.id === feedId);
    setInput((prev) => ({ ...prev, feedId, unit: batch?.unit ?? prev.unit }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.feedId) {
      setError("Select a feed batch.");
      return;
    }
    if (!input.housePen.trim()) {
      setError("Poultry House/Pen is required.");
      return;
    }
    if (input.quantityUsed <= 0) {
      setError("Quantity used must be greater than zero.");
      return;
    }
    if (input.numberOfChickens <= 0) {
      setError("Number of chickens fed must be greater than zero.");
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
      } else {
        await createFeedDistributionRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[FeedDistributionFormDrawer] save failed:", err);
      setError("Couldn't save this record. Please try again.");
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
                    {f.feedName} ({f.remainingStock.toLocaleString()} {f.unit} left{f.batchNumber ? ` · ${f.batchNumber}` : ""})
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
                <input
                  id="fd-house-pen"
                  value={input.housePen}
                  onChange={(e) => setInput((prev) => ({ ...prev, housePen: e.target.value }))}
                  placeholder="e.g. House 3"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fd-quantity" className="text-sm font-medium text-[var(--color-foreground)]">
                  Quantity Used {selectedBatch ? `(${selectedBatch.unit})` : ""}
                </label>
                <input
                  id="fd-quantity"
                  type="number"
                  min={0}
                  value={input.quantityUsed}
                  onChange={(e) => setInput((prev) => ({ ...prev, quantityUsed: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fd-chickens" className="text-sm font-medium text-[var(--color-foreground)]">
                  Number of Chickens Fed
                </label>
                <input
                  id="fd-chickens"
                  type="number"
                  min={0}
                  value={input.numberOfChickens}
                  onChange={(e) => setInput((prev) => ({ ...prev, numberOfChickens: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
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
              disabled={saving}
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
