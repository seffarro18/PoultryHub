import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RotateCcw, X } from "lucide-react";
import { getProductionSettings } from "@poultryhub/shared/services/eggPricingService";
import { filterDecimalText } from "@poultryhub/shared/lib/numericInput";
import {
  createApprovedFeedDistributionRecord,
  createFeedDistributionRecord,
  resubmitFeedDistributionRecord,
  updateFeedDistributionRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import PoultryHouseSelect from "../production/PoultryHouseSelect";
import StaffAssignedHouseField, { type AssignedHouseState } from "./StaffAssignedHouseField";
import MobileSelect from "../ui/MobileSelect";
import {
  feedSackKg,
  fmtFeedNumber,
  fmtSacks,
  formatFeedPackaging,
  localIsoDate,
  sackQuantityChoices,
  type FeedBatch,
  type FeedConsumptionUnit,
  type FeedDistributionInput,
  type FeedDistributionRecord,
} from "@poultryhub/shared/types/feedVitamin";
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

function toInputState(record: FeedDistributionRecord | null, fixedFarmId: string, defaultFeed: FeedBatch | undefined): FeedDistributionInput {
  if (record) {
    return {
      farmId: record.farmId,
      feedId: record.feedId,
      housePen: record.housePen,
      houseId: record.houseId,
      enteredQuantity: record.enteredQuantity,
      enteredUnit: record.enteredUnit,
      quantityUsed: record.quantityUsed,
      unit: record.unit,
      distributionDate: record.distributionDate,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    feedId: defaultFeed?.id ?? "",
    housePen: "",
    houseId: null,
    // No default quantity — the person must type one.
    enteredQuantity: 0,
    enteredUnit: "sack",
    quantityUsed: 0,
    unit: defaultFeed?.unit ?? "",
    distributionDate: localIsoDate(),
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
    toInputState(record, fixedFarmId, feedBatches[0])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedHouseState, setAssignedHouseState] = useState<AssignedHouseState>("loading");
  // The quantity field starts blank (never pre-filled with 1); editing shows what was originally entered.
  const [quantityText, setQuantityText] = useState(() => (record ? fmtFeedNumber(record.enteredQuantity).replace(/,/g, "") : ""));

  // Sack or kg: an existing record keeps the unit it was entered in; a new
  // one follows the farm's Feed Consumption setting (production_settings).
  const [mode, setMode] = useState<FeedConsumptionUnit | null>(record ? record.enteredUnit : null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [modeKey, setModeKey] = useState(0);
  useEffect(() => {
    if (record) return;
    let cancelled = false;
    setModeError(null);
    getProductionSettings()
      .then((settings) => {
        if (!cancelled) setMode(settings?.feedConsumptionUnit ?? "sack");
      })
      .catch((err) => {
        console.error("[FeedDistributionFormDrawer] failed to load feed consumption setting:", err);
        if (!cancelled) setModeError(getErrorMessage(err, "Couldn't load your farm's feed consumption setting."));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey]);

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
    setInput((prev) => ({ ...prev, feedId, unit: batch?.unit ?? prev.unit }));
    setError(null);
  };

  // Each batch's own sack size — never an assumed 25 or 50 kg.
  const kgPerSack = feedSackKg(selectedBatch?.packageSize ?? null);
  const quantity = quantityText.trim() === "" ? null : Number(quantityText);
  const kgUnavailable = mode === "kg" && !kgPerSack;
  /** The entry converted to sacks — the amount stock actually moves by (the database repeats this conversion authoritatively). */
  const requestedSacks = quantity === null || !mode ? null : mode === "kg" ? (kgPerSack ? quantity / kgPerSack : null) : quantity;
  const availableInMode = mode === "kg" ? (kgPerSack ? availableForThisRecord * kgPerSack : null) : availableForThisRecord;
  const fmtInMode = (value: number) => (mode === "kg" ? `${fmtFeedNumber(value)} kg` : fmtSacks(value));
  // Sack mode: pick from ½-sack choices up to what's available — never typed.
  const sackChoices = useMemo(() => sackQuantityChoices(availableForThisRecord), [availableForThisRecord]);
  const quantityProblem =
    quantity === null
      ? null
      : !Number.isFinite(quantity) || quantity <= 0
        ? "Enter a quantity greater than zero."
        : mode === "kg" && !Number.isInteger(quantity)
          ? "Enter whole kilograms only — decimals like 1000.5 aren't allowed."
          : mode === "sack" && !Number.isInteger(quantity * 2)
            ? "Choose a sack quantity from the list."
            : requestedSacks !== null && requestedSacks > availableForThisRecord + 1e-9 && availableInMode !== null
              ? `Insufficient feed stock. Available: ${fmtInMode(availableInMode)}. Requested: ${fmtInMode(quantity)}.`
              : null;
  const quantityValid = quantity !== null && quantityProblem === null && !kgUnavailable && requestedSacks !== null;

  /** Switching unit always clears the quantity — a number typed as kg must never be read as sacks. */
  const handleUnitChange = (next: string) => {
    if (next !== "kg" && next !== "sack") return;
    setMode(next);
    setQuantityText("");
    setError(null);
  };

  const handleAssignedHouseResolved = (house: PoultryHouse | null) => {
    setInput((prev) => ({ ...prev, houseId: house?.id ?? null, housePen: house?.name ?? "" }));
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
    if (!mode) {
      setError("Your farm's feed consumption setting hasn't loaded yet.");
      return;
    }
    if (kgUnavailable) {
      setError("This feed batch has no sack size recorded, so it can't be used in kilograms.");
      return;
    }
    if (!quantityValid || quantity === null || requestedSacks === null) {
      setError(quantityProblem ?? "Enter the quantity used.");
      return;
    }
    const payload: FeedDistributionInput = {
      ...input,
      enteredQuantity: quantity,
      enteredUnit: mode,
      quantityUsed: Math.round(requestedSacks * 1e6) / 1e6,
    };
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitFeedDistributionRecord(record.id, payload);
        } else {
          await updateFeedDistributionRecord(record.id, payload);
        }
      } else if (createApproved) {
        await createApprovedFeedDistributionRecord(payload);
      } else {
        await createFeedDistributionRecord(payload);
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
              <MobileSelect
                id="fd-feed"
                value={input.feedId}
                onChange={handleFeedChange}
                placeholder="Select a feed batch…"
                sheetTitle="Select Feed"
                searchable={feedBatches.length > 6}
                searchPlaceholder="Search feed…"
                options={feedBatches.map((f) => ({
                  value: f.id,
                  label: `${f.feedName} — ${formatFeedPackaging(f.packageSize)} (${fmtSacks(f.remainingStock)} left${f.batchNumber ? ` · ${f.batchNumber}` : ""})`,
                }))}
              />
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
              <label htmlFor="fd-unit" className="text-sm font-medium text-[var(--color-foreground)]">
                Quantity Unit
              </label>
              {modeError ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {modeError}
                  <button type="button" onClick={() => setModeKey((k) => k + 1)} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
                    <RotateCcw size={12} /> Retry
                  </button>
                </div>
              ) : !mode ? (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)]">
                  <Loader2 size={14} className="spinner" /> Loading…
                </div>
              ) : (
                <MobileSelect
                  id="fd-unit"
                  value={mode}
                  onChange={handleUnitChange}
                  sheetTitle="Quantity Unit"
                  options={[
                    { value: "kg", label: "Kilogram (kg)" },
                    { value: "sack", label: "Sack" },
                  ]}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fd-quantity" className="text-sm font-medium text-[var(--color-foreground)]">
                Quantity Used {mode === "kg" ? "(kg)" : mode === "sack" ? "(Sack)" : ""}
              </label>
              {!mode ? null : mode === "kg" ? (
                <input
                  id="fd-quantity"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter kilograms"
                  value={quantityText}
                  onChange={(e) => {
                    setQuantityText(filterDecimalText(e.target.value));
                    setError(null);
                  }}
                  aria-invalid={Boolean(quantityProblem)}
                  className={`w-full min-w-0 rounded-lg border bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)] ${
                    quantityProblem ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"
                  }`}
                />
              ) : (
                <MobileSelect
                  id="fd-quantity"
                  value={quantityText}
                  onChange={(value) => {
                    setQuantityText(value);
                    setError(null);
                  }}
                  placeholder="Select sack quantity"
                  sheetTitle="Sack Quantity"
                  disabled={!selectedBatch || sackChoices.length === 0}
                  error={Boolean(quantityProblem)}
                  options={[
                    // An existing entry that isn't on today's list (e.g. stock has since dropped) stays visible so the form never silently changes it.
                    ...(quantity !== null && Number.isFinite(quantity) && !sackChoices.includes(quantity)
                      ? [{ value: quantityText, label: fmtSacks(quantity), disabled: true }]
                      : []),
                    ...sackChoices.map((n) => ({ value: String(n), label: fmtSacks(n) })),
                  ]}
                />
              )}
              {mode === "sack" && selectedBatch && sackChoices.length === 0 && (
                <p className="text-xs text-[var(--color-danger)]">Less than ½ sack is left in this batch — record it in kilograms instead.</p>
              )}
              {quantityProblem && <p className="text-xs text-[var(--color-danger)]">{quantityProblem}</p>}
              {kgUnavailable && <p className="text-xs text-[var(--color-danger)]">This batch has no sack size recorded, so it can't be measured in kilograms.</p>}
              {selectedBatch && mode && (
                <div className="text-xs text-[var(--color-muted)]">
                  {mode === "kg" ? (
                    <>
                      <p>Available: {availableInMode === null ? "—" : `${fmtFeedNumber(availableInMode)} kg`}</p>
                      <p>
                        Sack Size: {kgPerSack ? `${fmtFeedNumber(kgPerSack)} kg` : "not recorded"}
                        {kgPerSack ? ` · Equivalent Stock: ${fmtSacks(availableForThisRecord)}` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p>Available: {fmtSacks(availableForThisRecord)}</p>
                      <p>
                        Sack Size: {kgPerSack ? `${fmtFeedNumber(kgPerSack)} kg` : "not recorded"}
                        {kgPerSack ? ` · Equivalent Weight: ${fmtFeedNumber(availableForThisRecord * kgPerSack)} kg` : ""}
                      </p>
                    </>
                  )}
                  {quantityValid && requestedSacks !== null && kgPerSack && (
                    <p className="mt-0.5 text-[var(--color-foreground)]">
                      Uses {mode === "kg" ? fmtSacks(requestedSacks) : `${fmtFeedNumber(requestedSacks * kgPerSack)} kg`}
                    </p>
                  )}
                </div>
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
              disabled={saving || staffBlocked || !quantityValid}
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
