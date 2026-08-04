import { useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  createEggProductionRecord,
  resubmitEggProductionRecord,
  updateEggProductionRecord,
} from "../../services/eggProductionService";
import FarmSelect from "./FarmSelect";
import type { EggProductionInput, EggProductionRecord, Farm } from "../../types/eggProduction";

interface EggProductionFormDrawerProps {
  /** null = create mode */
  record: EggProductionRecord | null;
  farms: Farm[];
  /** Farm portal: the farm is fixed to the logged-in user's own farm, so no picker is shown. */
  fixedFarmId?: string;
  /** Staff correcting their own rejected/pending record — saves via resubmit (flips rejected -> pending, clears the reviewer's comment) instead of a plain data correction. */
  useResubmitFlow?: boolean;
  /** Staff doesn't record sales — hidden there, shown when Farm Admin/Manager corrects a record. */
  showSoldField?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: EggProductionRecord | null, fixedFarmId?: string): EggProductionInput {
  if (record) {
    return {
      farmId: record.farmId,
      productionDate: record.productionDate,
      housePen: record.housePen,
      layerCount: record.layerCount,
      eggsCollected: record.eggsCollected,
      goodEggs: record.goodEggs,
      crackedEggs: record.crackedEggs,
      damagedEggs: record.damagedEggs,
      eggsSold: record.eggsSold,
      notes: record.notes,
    };
  }
  return {
    farmId: fixedFarmId ?? "",
    productionDate: new Date().toISOString().slice(0, 10),
    housePen: "",
    layerCount: 0,
    eggsCollected: 0,
    goodEggs: 0,
    crackedEggs: 0,
    damagedEggs: 0,
    eggsSold: 0,
    notes: null,
  };
}

const numberField = (
  label: string,
  key: keyof EggProductionInput,
  value: EggProductionInput,
  onChange: (next: EggProductionInput) => void
) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-[var(--color-foreground)]">{label}</label>
    <input
      type="number"
      min={0}
      value={value[key] as number}
      onChange={(e) => onChange({ ...value, [key]: Math.max(0, Number(e.target.value)) })}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
    />
  </div>
);

export default function EggProductionFormDrawer({
  record,
  farms,
  fixedFarmId,
  useResubmitFlow = false,
  showSoldField = true,
  onClose,
  onSaved,
}: EggProductionFormDrawerProps) {
  const isEdit = record !== null;
  const [farmList, setFarmList] = useState(farms);
  const [input, setInput] = useState<EggProductionInput>(() => toInputState(record, fixedFarmId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.farmId) {
      setError("Select a farm.");
      return;
    }
    if (!input.housePen.trim()) {
      setError("House/Pen is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitEggProductionRecord(record.id, input);
        } else {
          await updateEggProductionRecord(record.id, input);
        }
      } else {
        await createEggProductionRecord(input);
      }
      onSaved();
    } catch (err) {
      console.error("[EggProductionFormDrawer] save failed:", err);
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
            {isEdit ? "Edit Record" : "Add Egg Collection Record"}
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
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div className={fixedFarmId ? "" : "grid grid-cols-2 gap-3"}>
              {!fixedFarmId && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="egg-farm" className="text-sm font-medium text-[var(--color-foreground)]">
                    Farm
                  </label>
                  <FarmSelect
                    id="egg-farm"
                    value={input.farmId}
                    farms={farmList}
                    onChange={(farmId) => setInput((prev) => ({ ...prev, farmId }))}
                    onFarmCreated={(farm) =>
                      setFarmList((prev) => [...prev, farm].sort((a, b) => a.name.localeCompare(b.name)))
                    }
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="egg-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Production date
                </label>
                <input
                  id="egg-date"
                  type="date"
                  value={input.productionDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, productionDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="egg-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                Poultry House / Pen
              </label>
              <input
                id="egg-house-pen"
                value={input.housePen}
                onChange={(e) => setInput((prev) => ({ ...prev, housePen: e.target.value }))}
                placeholder="e.g. House 3"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {numberField("Number of layers", "layerCount", input, setInput)}
              {numberField("Eggs collected", "eggsCollected", input, setInput)}
              {numberField("Good eggs", "goodEggs", input, setInput)}
              {numberField("Broken/Cracked eggs", "crackedEggs", input, setInput)}
              {numberField("Damaged eggs", "damagedEggs", input, setInput)}
              {showSoldField && numberField("Eggs sold", "eggsSold", input, setInput)}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="egg-notes" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks
              </label>
              <textarea
                id="egg-notes"
                value={input.notes ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, notes: e.target.value || null }))}
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
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Add record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
