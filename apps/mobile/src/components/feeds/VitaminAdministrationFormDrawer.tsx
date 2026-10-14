import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Minus, Plus, X } from "lucide-react";
import {
  createApprovedVitaminAdministrationRecord,
  createVitaminAdministrationRecord,
  resubmitVitaminAdministrationRecord,
  updateVitaminAdministrationRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import {
  formatUnitLabel,
  type VitaminAdministrationInput,
  type VitaminAdministrationRecord,
  type VitaminBatch,
} from "@poultryhub/shared/types/feedVitamin";
import type { PoultryHouse } from "@poultryhub/shared/types/poultryHouse";
import MobileSelect from "../ui/MobileSelect";
import PoultryHouseSelect from "../production/PoultryHouseSelect";
import StaffAssignedHouseField, { type AssignedHouseState } from "./StaffAssignedHouseField";

interface VitaminAdministrationFormDrawerProps {
  /** null = create mode */
  record: VitaminAdministrationRecord | null;
  fixedFarmId: string;
  vitaminBatches: VitaminBatch[];
  useResubmitFlow?: boolean;
  /**
   * Farm Admin/Manager — pick (and inline-register) any of the farm's
   * houses/pens. Staff never gets a choice: the field is forced to their own
   * assignedPoultryHouseId, shown read-only — same as FeedDistributionFormDrawer,
   * and enforced by RLS (migration 0045), not just the UI.
   */
  canManageHouses?: boolean;
  /** Staff only (ignored when canManageHouses is true) — the signed-in Staff member's own assignment, from their profile. */
  assignedPoultryHouseId?: string | null;
  /** Farm Admin/Manager recording their own usage — create mode only, saves pre-approved instead of pending. */
  createApproved?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: VitaminAdministrationRecord | null, fixedFarmId: string, defaultBatch: VitaminBatch | undefined): VitaminAdministrationInput {
  if (record) {
    return {
      farmId: record.farmId,
      vitaminId: record.vitaminId,
      housePen: record.housePen,
      houseId: record.houseId,
      // Dosage and Purpose are no longer collected; saving clears them.
      dosage: null,
      quantityUsed: record.quantityUsed,
      unit: record.unit,
      administrationDate: record.administrationDate,
      purpose: null,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    vitaminId: defaultBatch?.id ?? "",
    housePen: "",
    houseId: null,
    dosage: null,
    quantityUsed: 1,
    unit: defaultBatch?.unit ?? "",
    administrationDate: new Date().toISOString().slice(0, 10),
    purpose: null,
    remarks: null,
  };
}

export default function VitaminAdministrationFormDrawer({
  record,
  fixedFarmId,
  vitaminBatches,
  useResubmitFlow = false,
  canManageHouses = false,
  assignedPoultryHouseId = null,
  createApproved = false,
  onClose,
  onSaved,
}: VitaminAdministrationFormDrawerProps) {
  const isEdit = record !== null;
  const [input, setInput] = useState<VitaminAdministrationInput>(() => toInputState(record, fixedFarmId, vitaminBatches[0]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedHouseState, setAssignedHouseState] = useState<AssignedHouseState>("loading");

  const selectedBatch = useMemo(() => vitaminBatches.find((v) => v.id === input.vitaminId), [vitaminBatches, input.vitaminId]);
  // Official stock only counts APPROVED usage, so an already-approved record
  // being edited has its own quantity sitting outside remainingStock — add it
  // back, or a re-save of an unchanged record would look like overdrawing.
  const availableForThisRecord = selectedBatch
    ? selectedBatch.remainingStock + (record?.status === "approved" && record.vitaminId === selectedBatch.id ? record.quantityUsed : 0)
    : 0;

  const handleVitaminChange = (vitaminId: string) => {
    const batch = vitaminBatches.find((v) => v.id === vitaminId);
    setInput((prev) => ({ ...prev, vitaminId, unit: batch?.unit ?? prev.unit, quantityUsed: 1 }));
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
    if (!input.vitaminId) {
      setError("Select a vitamin batch.");
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
    if (!Number.isInteger(input.quantityUsed) || input.quantityUsed < 1) {
      setError("Quantity used must be a whole number of at least 1.");
      return;
    }
    // First stock check (submission). The database checks again at approval,
    // since other usage may be approved while this one is still pending.
    if (selectedBatch && input.quantityUsed > availableForThisRecord) {
      setError(
        `Insufficient vitamin stock. Only ${availableForThisRecord.toLocaleString()} ${formatUnitLabel(selectedBatch.unit, availableForThisRecord)} ` +
          `${availableForThisRecord === 1 ? "is" : "are"} available.`
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitVitaminAdministrationRecord(record.id, input);
        } else {
          await updateVitaminAdministrationRecord(record.id, input);
        }
      } else if (createApproved) {
        await createApprovedVitaminAdministrationRecord(input);
      } else {
        await createVitaminAdministrationRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[VitaminAdministrationFormDrawer] save failed:", err);
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
            {isEdit ? "Edit Vitamin Administration" : "Record Vitamin Administration"}
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
              <label htmlFor="va-vitamin" className="text-sm font-medium text-[var(--color-foreground)]">
                Vitamin
              </label>
              <MobileSelect
                id="va-vitamin"
                value={input.vitaminId}
                onChange={handleVitaminChange}
                placeholder="Select a vitamin batch…"
                sheetTitle="Select Vitamin"
                searchable={vitaminBatches.length > 6}
                searchPlaceholder="Search vitamins…"
                options={vitaminBatches.map((v) => ({
                  value: v.id,
                  label: `${v.vitaminName} (${v.remainingStock.toLocaleString()} ${formatUnitLabel(v.unit, v.remainingStock)} left${v.batchNumber ? ` · ${v.batchNumber}` : ""})`,
                }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="va-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Date
                </label>
                <input
                  id="va-date"
                  type="date"
                  value={input.administrationDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, administrationDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="va-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                  Poultry House / Pen
                </label>
                {canManageHouses ? (
                  <PoultryHouseSelect
                    id="va-house-pen"
                    farmId={input.farmId}
                    // Older records may only have the name; PoultryHouseSelect resolves either.
                    value={input.houseId ?? input.housePen}
                    canManage
                    onChange={(house) => {
                      setInput((prev) => ({ ...prev, houseId: house?.id ?? null, housePen: house?.name ?? "" }));
                      setError(null);
                    }}
                  />
                ) : (
                  <StaffAssignedHouseField
                    id="va-house-pen"
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
                Quantity Used {selectedBatch ? `(${formatUnitLabel(selectedBatch.unit)})` : ""}
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
                  Available: {availableForThisRecord.toLocaleString()} {formatUnitLabel(selectedBatch.unit, availableForThisRecord)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="va-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks
              </label>
              <textarea
                id="va-remarks"
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
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Record Administration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
