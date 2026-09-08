import { useMemo, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  createVitaminAdministrationRecord,
  resubmitVitaminAdministrationRecord,
  updateVitaminAdministrationRecord,
} from "@poultryhub/shared/services/feedVitaminService";
import type { VitaminAdministrationInput, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";

interface VitaminAdministrationFormDrawerProps {
  /** null = create mode */
  record: VitaminAdministrationRecord | null;
  fixedFarmId: string;
  vitaminBatches: VitaminBatch[];
  useResubmitFlow?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(
  record: VitaminAdministrationRecord | null,
  fixedFarmId: string,
  defaultVitaminId: string
): VitaminAdministrationInput {
  if (record) {
    return {
      farmId: record.farmId,
      vitaminId: record.vitaminId,
      housePen: record.housePen,
      dosage: record.dosage,
      quantityUsed: record.quantityUsed,
      unit: record.unit,
      administrationDate: record.administrationDate,
      purpose: record.purpose,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    vitaminId: defaultVitaminId,
    housePen: "",
    dosage: null,
    quantityUsed: 0,
    unit: "",
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
  onClose,
  onSaved,
}: VitaminAdministrationFormDrawerProps) {
  const isEdit = record !== null;
  const [input, setInput] = useState<VitaminAdministrationInput>(() =>
    toInputState(record, fixedFarmId, vitaminBatches[0]?.id ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBatch = useMemo(() => vitaminBatches.find((v) => v.id === input.vitaminId), [vitaminBatches, input.vitaminId]);

  const handleVitaminChange = (vitaminId: string) => {
    const batch = vitaminBatches.find((v) => v.id === vitaminId);
    setInput((prev) => ({ ...prev, vitaminId, unit: batch?.unit ?? prev.unit }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.vitaminId) {
      setError("Select a vitamin batch.");
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
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitVitaminAdministrationRecord(record.id, input);
        } else {
          await updateVitaminAdministrationRecord(record.id, input);
        }
      } else {
        await createVitaminAdministrationRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[VitaminAdministrationFormDrawer] save failed:", err);
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
              <select
                id="va-vitamin"
                value={input.vitaminId}
                onChange={(e) => handleVitaminChange(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              >
                <option value="" disabled>
                  Select a vitamin batch…
                </option>
                {vitaminBatches.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vitaminName} ({v.remainingStock.toLocaleString()} {v.unit} left{v.batchNumber ? ` · ${v.batchNumber}` : ""})
                  </option>
                ))}
              </select>
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
                <input
                  id="va-house-pen"
                  value={input.housePen}
                  onChange={(e) => setInput((prev) => ({ ...prev, housePen: e.target.value }))}
                  placeholder="e.g. House 3"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="va-dosage" className="text-sm font-medium text-[var(--color-foreground)]">
                  Dosage
                </label>
                <input
                  id="va-dosage"
                  value={input.dosage ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, dosage: e.target.value || null }))}
                  placeholder="e.g. 5ml per liter"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="va-quantity" className="text-sm font-medium text-[var(--color-foreground)]">
                  Quantity Used {selectedBatch ? `(${selectedBatch.unit})` : ""}
                </label>
                <input
                  id="va-quantity"
                  type="number"
                  min={0}
                  value={input.quantityUsed}
                  onChange={(e) => setInput((prev) => ({ ...prev, quantityUsed: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="va-purpose" className="text-sm font-medium text-[var(--color-foreground)]">
                Purpose
              </label>
              <input
                id="va-purpose"
                value={input.purpose ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, purpose: e.target.value || null }))}
                placeholder="e.g. Immune boost"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
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
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Record administration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
