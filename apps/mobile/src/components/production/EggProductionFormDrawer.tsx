import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import {
  createEggProductionRecord,
  resubmitEggProductionRecord,
  updateEggProductionRecord,
} from "@poultryhub/shared/services/eggProductionService";
import FarmSelect from "@poultryhub/shared/components/production/FarmSelect";
import Button from "@poultryhub/shared/components/ui/Button";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { EGGS_PER_TRAY, traysForGoodEggs, type EggProductionInput, type EggProductionRecord, type Farm } from "@poultryhub/shared/types/eggProduction";
import PoultryHouseSelect from "./PoultryHouseSelect";
import StaffPoultryHouseField, { type StaffPoultryHouseFieldState } from "./StaffPoultryHouseField";

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
  /** Farm Admin/Manager only — lets them register a new poultry house/pen inline, and pick any of the farm's houses (not just one). When false, the House/Pen field is Staff's own restricted, single-assignment field instead — see assignedPoultryHouseId. */
  canManageHouses?: boolean;
  /** Staff only (ignored when canManageHouses is true) — the signed-in Staff member's own assignment, from their profile. */
  assignedPoultryHouseId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(record: EggProductionRecord | null, fixedFarmId?: string): EggProductionInput {
  if (record) {
    return {
      farmId: record.farmId,
      productionDate: record.productionDate,
      housePen: record.housePen,
      poultryHouseId: record.poultryHouseId,
      numberOfTrays: record.numberOfTrays,
      eggsCollected: record.eggsCollected,
      goodEggs: record.goodEggs,
      peeweeEggs: record.peeweeEggs,
      smallEggs: record.smallEggs,
      mediumEggs: record.mediumEggs,
      largeEggs: record.largeEggs,
      xLargeEggs: record.xLargeEggs,
      jumboEggs: record.jumboEggs,
      damagedCrackedEggs: record.damagedCrackedEggs,
      eggsSold: record.eggsSold,
      notes: record.notes,
    };
  }
  return {
    farmId: fixedFarmId ?? "",
    productionDate: new Date().toISOString().slice(0, 10),
    housePen: "",
    poultryHouseId: null,
    numberOfTrays: 0,
    eggsCollected: 0,
    goodEggs: 0,
    peeweeEggs: 0,
    smallEggs: 0,
    mediumEggs: 0,
    largeEggs: 0,
    xLargeEggs: 0,
    jumboEggs: 0,
    damagedCrackedEggs: 0,
    eggsSold: 0,
    notes: null,
  };
}

// type="text" + inputMode="numeric" instead of type="number": a number
// input always shows the browser's native up/down spinner, which the spec
// explicitly says to remove. Non-digit characters (letters, symbols, "-",
// ".") are stripped as they're typed, so there's nothing left to validate
// after the fact — negative/decimal/non-numeric values are structurally
// impossible, not just rejected on submit. A value of exactly 0 displays as
// blank (with the placeholder showing through) rather than "0", same as an
// untouched field — the two are meant to be visually indistinguishable.
const numberField = (
  label: string,
  key: keyof EggProductionInput,
  value: EggProductionInput,
  onChange: (next: EggProductionInput) => void
) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-[var(--color-foreground)]">{label}</label>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="Enter quantity"
      value={value[key] === 0 ? "" : String(value[key])}
      onChange={(e) => {
        const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
        onChange({ ...value, [key]: digitsOnly === "" ? 0 : Number(digitsOnly) });
      }}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
    />
  </div>
);

const readOnlyField = (label: string, value: number | string, caption: string) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-[var(--color-foreground)]">{label}</label>
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-foreground)]">
      {value}
    </div>
    <p className="text-[10px] text-[var(--color-muted)]">{caption}</p>
  </div>
);

export default function EggProductionFormDrawer({
  record,
  farms,
  fixedFarmId,
  useResubmitFlow = false,
  showSoldField = true,
  canManageHouses = false,
  assignedPoultryHouseId = null,
  onClose,
  onSaved,
}: EggProductionFormDrawerProps) {
  const isEdit = record !== null;
  const [farmList, setFarmList] = useState(farms);
  const [input, setInput] = useState<EggProductionInput>(() => toInputState(record, fixedFarmId));
  const [saving, setSaving] = useState(false);
  const reducedMotion = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  // Only meaningful for Staff (canManageHouses false) — lets the submit
  // validation below show the exact right message for "no houses configured
  // at all" vs. "houses exist but I'm not assigned one", instead of one
  // generic fallback for both.
  const [staffHouseFieldState, setStaffHouseFieldState] = useState<StaffPoultryHouseFieldState>("loading");
  const toast = useToast();

  // Every total here is derived, never typed in directly — Good Eggs Total
  // from the six sizes, Number of Trays from Good Eggs Total ÷ 30 eggs per
  // tray, NOT rounded (70 good eggs = 2.33 trays). Eggs Collected equals
  // Good Eggs Total only — Damaged/Cracked is tracked separately (a loss
  // count) and deliberately never added into it.
  const goodTotal =
    input.peeweeEggs + input.smallEggs + input.mediumEggs + input.largeEggs + input.xLargeEggs + input.jumboEggs;
  const eggsCollected = goodTotal;
  const numberOfTrays = traysForGoodEggs(goodTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation stays inline, next to the fields it's about — a toast here
    // would disappear before the user finishes reading it, and wouldn't
    // point at which field needs fixing.
    if (!input.farmId) {
      setError("Select a farm.");
      return;
    }
    if (!input.poultryHouseId) {
      setError(
        !canManageHouses && staffHouseFieldState === "no-houses"
          ? "No poultry houses/pens available. Please ask your Farm Admin to add one."
          : "Please select a poultry house or pen."
      );
      return;
    }
    setSaving(true);
    setError(null);
    const payload: EggProductionInput = { ...input, numberOfTrays, goodEggs: goodTotal, eggsCollected };
    try {
      if (isEdit) {
        if (useResubmitFlow) {
          await resubmitEggProductionRecord(record.id, payload);
        } else {
          await updateEggProductionRecord(record.id, payload);
        }
      } else {
        await createEggProductionRecord(payload);
      }
      toast.success(isEdit ? "Record updated." : "Record saved.");
      onSaved();
    } catch (err) {
      console.error("[EggProductionFormDrawer] save failed:", err);
      setError("Couldn't save this record. Please try again.");
      toast.error("Couldn't save this record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
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
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setInput((prev) => ({ ...prev, productionDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="egg-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                Poultry House / Pen
              </label>
              {canManageHouses ? (
                <PoultryHouseSelect
                  id="egg-house-pen"
                  farmId={input.farmId}
                  value={input.poultryHouseId ?? ""}
                  onChange={(house) => {
                    if (house) setInput((prev) => ({ ...prev, poultryHouseId: house.id, housePen: house.name }));
                  }}
                  canManage
                />
              ) : (
                <StaffPoultryHouseField
                  id="egg-house-pen"
                  farmId={input.farmId}
                  assignedPoultryHouseId={assignedPoultryHouseId}
                  onChange={(house) => setInput((prev) => ({ ...prev, poultryHouseId: house.id, housePen: house.name }))}
                  onStateChange={setStaffHouseFieldState}
                />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Egg Classification — Good Eggs
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {numberField("Peewee eggs", "peeweeEggs", input, setInput)}
                {numberField("Small eggs", "smallEggs", input, setInput)}
                {numberField("Medium eggs", "mediumEggs", input, setInput)}
                {numberField("Large eggs", "largeEggs", input, setInput)}
                {numberField("X Large eggs", "xLargeEggs", input, setInput)}
                {numberField("Jumbo eggs", "jumboEggs", input, setInput)}
              </div>
              <div className="mt-3">{readOnlyField("Good eggs total", goodTotal, "Peewee + Small + Medium + Large + X Large + Jumbo")}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {readOnlyField("Number of trays", numberOfTrays.toFixed(2), "Based on 30 eggs per tray")}
              {readOnlyField("Eggs per tray", EGGS_PER_TRAY, "Standard: 30 eggs")}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {numberField("Damaged / Cracked eggs", "damagedCrackedEggs", input, setInput)}
              {showSoldField && numberField("Eggs sold", "eggsSold", input, setInput)}
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Classification Summary</p>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted)]">Good Eggs</span>
                  <span className="font-medium text-[var(--color-foreground)]">{goodTotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted)]">Damaged / Cracked (not counted)</span>
                  <span className="font-medium text-[var(--color-foreground)]">{input.damagedCrackedEggs}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1">
                  <span className="font-semibold text-[var(--color-foreground)]">Eggs Collected</span>
                  <span className="font-semibold text-[var(--color-foreground)]">{eggsCollected}</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[var(--color-success)]">✓ Matches Good Eggs</p>
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
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              loadingText={isEdit ? (useResubmitFlow ? "Resubmitting…" : "Updating…") : "Saving…"}
            >
              {isEdit ? (useResubmitFlow ? "Resubmit" : "Save changes") : "Add record"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
