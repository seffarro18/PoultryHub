import { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  createApprovedMortalityRecord,
  createMortalityRecord,
  getMortalityPhotoSignedUrl,
  resubmitMortalityRecord,
  updateMortalityRecord,
  uploadMortalityPhoto,
} from "@poultryhub/shared/services/mortalityRecordService";
import { BIRD_TYPES } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord, MortalityRecordInput } from "@poultryhub/shared/types/mortality";
import PhotoField from "../PhotoField";

interface MortalityRecordFormDrawerProps {
  /** null = create mode */
  record: MortalityRecord | null;
  fixedFarmId: string;
  /** Farm Admin/Manager creating directly — saves pre-approved instead of pending. Ignored in edit mode. */
  preApproved?: boolean;
  /** Staff correcting their own rejected/pending record — saves via resubmit (flips rejected -> pending, clears the reviewer's comment). */
  useResubmitFlow?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: MortalityRecord | null, fixedFarmId: string): MortalityRecordInput {
  if (record) {
    return {
      farmId: record.farmId,
      housePen: record.housePen,
      recordDate: record.recordDate,
      birdType: record.birdType,
      deadBirds: record.deadBirds,
      causeOfDeath: record.causeOfDeath,
      disposalMethod: record.disposalMethod,
      veterinarianConfirmation: record.veterinarianConfirmation,
      photoUrl: record.photoUrl,
      remarks: record.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    housePen: "",
    recordDate: new Date().toISOString().slice(0, 10),
    birdType: "Layer",
    deadBirds: 0,
    causeOfDeath: "",
    disposalMethod: null,
    veterinarianConfirmation: null,
    photoUrl: null,
    remarks: null,
  };
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

export default function MortalityRecordFormDrawer({
  record,
  fixedFarmId,
  preApproved = false,
  useResubmitFlow = false,
  onClose,
  onSaved,
}: MortalityRecordFormDrawerProps) {
  const isEdit = record !== null;
  const [input, setInput] = useState<MortalityRecordInput>(() => toInputState(record, fixedFarmId));
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.photoUrl) {
      setPhotoPreviewUrl(null);
      return;
    }
    let cancelled = false;
    getMortalityPhotoSignedUrl(input.photoUrl)
      .then((url) => {
        if (!cancelled) setPhotoPreviewUrl(url);
      })
      .catch((err) => console.error("[MortalityRecordFormDrawer] failed to load photo preview:", err));
    return () => {
      cancelled = true;
    };
    // Only re-runs when the stored photo path changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.photoUrl]);

  const handlePhotoSelected = async (file: File) => {
    setUploadingPhoto(true);
    setError(null);
    try {
      const path = await uploadMortalityPhoto(file, input.farmId);
      setInput((prev) => ({ ...prev, photoUrl: path }));
    } catch (err) {
      console.error("[MortalityRecordFormDrawer] photo upload failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.housePen.trim()) {
      setError("Poultry House/Pen is required.");
      return;
    }
    if (!input.causeOfDeath.trim()) {
      setError("Cause of death is required.");
      return;
    }
    if (input.deadBirds <= 0) {
      setError("Number of dead birds must be greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitMortalityRecord(record.id, input);
        } else {
          await updateMortalityRecord(record.id, input);
        }
      } else if (preApproved) {
        await createApprovedMortalityRecord(input);
      } else {
        await createMortalityRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[MortalityRecordFormDrawer] save failed:", err);
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
            {isEdit ? "Edit Mortality Record" : "Record Mortality"}
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
                <label htmlFor="mr-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Date
                </label>
                <input
                  id="mr-date"
                  type="date"
                  value={input.recordDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, recordDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mr-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                  Poultry House / Pen
                </label>
                <input
                  id="mr-house-pen"
                  value={input.housePen}
                  onChange={(e) => setInput((prev) => ({ ...prev, housePen: e.target.value }))}
                  placeholder="e.g. House 3"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mr-bird-type" className="text-sm font-medium text-[var(--color-foreground)]">
                  Poultry Type
                </label>
                <select
                  id="mr-bird-type"
                  value={input.birdType ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, birdType: (e.target.value || null) as MortalityRecordInput["birdType"] }))}
                  className={inputClass}
                >
                  {BIRD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mr-dead-birds" className="text-sm font-medium text-[var(--color-foreground)]">
                  Number of Dead Birds
                </label>
                <input
                  id="mr-dead-birds"
                  type="number"
                  min={0}
                  value={input.deadBirds}
                  onChange={(e) => setInput((prev) => ({ ...prev, deadBirds: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mr-cause" className="text-sm font-medium text-[var(--color-foreground)]">
                  Cause of Death
                </label>
                <input
                  id="mr-cause"
                  value={input.causeOfDeath}
                  onChange={(e) => setInput((prev) => ({ ...prev, causeOfDeath: e.target.value }))}
                  placeholder="e.g. Heat stress"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mr-disposal" className="text-sm font-medium text-[var(--color-foreground)]">
                  Disposal Method
                </label>
                <input
                  id="mr-disposal"
                  value={input.disposalMethod ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, disposalMethod: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mr-vet-confirm" className="text-sm font-medium text-[var(--color-foreground)]">
                  Veterinarian Confirmation
                </label>
                <input
                  id="mr-vet-confirm"
                  value={input.veterinarianConfirmation ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, veterinarianConfirmation: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--color-foreground)]">Supporting Photo</span>
              <PhotoField previewUrl={photoPreviewUrl} uploading={uploadingPhoto} onPhotoSelected={(file) => void handlePhotoSelected(file)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="mr-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks
              </label>
              <textarea
                id="mr-remarks"
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
              disabled={saving || uploadingPhoto}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Record mortality"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
