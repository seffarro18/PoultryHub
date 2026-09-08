import { useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  createApprovedHealthRecord,
  createHealthRecord,
  resubmitHealthRecord,
  updateHealthRecord,
} from "@poultryhub/shared/services/healthRecordService";
import type { HealthRecord, HealthRecordInput } from "@poultryhub/shared/types/health";

interface HealthRecordFormDrawerProps {
  /** null = create mode */
  record: HealthRecord | null;
  fixedFarmId: string;
  /** Farm Admin/Manager creating directly — saves pre-approved instead of pending. Ignored in edit mode. */
  preApproved?: boolean;
  /** Staff correcting their own rejected/pending record — saves via resubmit (flips rejected -> pending, clears the reviewer's comment). */
  useResubmitFlow?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: HealthRecord | null, fixedFarmId: string): HealthRecordInput {
  if (record) {
    return {
      farmId: record.farmId,
      housePen: record.housePen,
      recordDate: record.recordDate,
      diseaseCondition: record.diseaseCondition,
      symptoms: record.symptoms,
      affectedBirds: record.affectedBirds,
      medication: record.medication,
      treatment: record.treatment,
      vaccination: record.vaccination,
      veterinarian: record.veterinarian,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    housePen: "",
    recordDate: new Date().toISOString().slice(0, 10),
    diseaseCondition: "",
    symptoms: null,
    affectedBirds: 0,
    medication: null,
    treatment: null,
    vaccination: null,
    veterinarian: null,
    remarks: null,
  };
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

export default function HealthRecordFormDrawer({
  record,
  fixedFarmId,
  preApproved = false,
  useResubmitFlow = false,
  onClose,
  onSaved,
}: HealthRecordFormDrawerProps) {
  const isEdit = record !== null;
  const [input, setInput] = useState<HealthRecordInput>(() => toInputState(record, fixedFarmId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.housePen.trim()) {
      setError("Poultry House/Pen is required.");
      return;
    }
    if (!input.diseaseCondition.trim()) {
      setError("Disease/Condition is required.");
      return;
    }
    if (input.affectedBirds <= 0) {
      setError("Number of affected birds must be greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitHealthRecord(record.id, input);
        } else {
          await updateHealthRecord(record.id, input);
        }
      } else if (preApproved) {
        await createApprovedHealthRecord(input);
      } else {
        await createHealthRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[HealthRecordFormDrawer] save failed:", err);
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
            {isEdit ? "Edit Health Record" : "Record Health Observation"}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Date
                </label>
                <input
                  id="hr-date"
                  type="date"
                  value={input.recordDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, recordDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                  Poultry House / Pen
                </label>
                <input
                  id="hr-house-pen"
                  value={input.housePen}
                  onChange={(e) => setInput((prev) => ({ ...prev, housePen: e.target.value }))}
                  placeholder="e.g. House 3"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-disease" className="text-sm font-medium text-[var(--color-foreground)]">
                  Disease / Condition
                </label>
                <input
                  id="hr-disease"
                  value={input.diseaseCondition}
                  onChange={(e) => setInput((prev) => ({ ...prev, diseaseCondition: e.target.value }))}
                  placeholder="e.g. Newcastle Disease"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-affected" className="text-sm font-medium text-[var(--color-foreground)]">
                  Affected Birds
                </label>
                <input
                  id="hr-affected"
                  type="number"
                  min={0}
                  value={input.affectedBirds}
                  onChange={(e) => setInput((prev) => ({ ...prev, affectedBirds: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="hr-symptoms" className="text-sm font-medium text-[var(--color-foreground)]">
                Symptoms
              </label>
              <textarea
                id="hr-symptoms"
                value={input.symptoms ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, symptoms: e.target.value || null }))}
                rows={2}
                placeholder="Optional"
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-medication" className="text-sm font-medium text-[var(--color-foreground)]">
                  Medication
                </label>
                <input
                  id="hr-medication"
                  value={input.medication ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, medication: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-treatment" className="text-sm font-medium text-[var(--color-foreground)]">
                  Treatment
                </label>
                <input
                  id="hr-treatment"
                  value={input.treatment ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, treatment: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-vaccination" className="text-sm font-medium text-[var(--color-foreground)]">
                  Vaccination
                </label>
                <input
                  id="hr-vaccination"
                  value={input.vaccination ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, vaccination: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hr-vet" className="text-sm font-medium text-[var(--color-foreground)]">
                  Veterinarian
                </label>
                <input
                  id="hr-vet"
                  value={input.veterinarian ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, veterinarian: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="hr-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks
              </label>
              <textarea
                id="hr-remarks"
                value={input.remarks ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, remarks: e.target.value || null }))}
                rows={2}
                placeholder="Optional"
                className={`${inputClass} resize-none`}
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
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Record observation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
