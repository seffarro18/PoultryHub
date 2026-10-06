import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { createInventoryEvent, currentStockByHouse, updateInventoryEvent } from "@poultryhub/shared/services/poultryInventoryService";
import { listLayerBreeds } from "@poultryhub/shared/services/layerBreedService";
import { filterIntegerText, parseNumericText, stripLeadingZeros } from "@poultryhub/shared/lib/numericInput";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import type { PoultryEvent, PoultryEventInput, PoultryEventType } from "@poultryhub/shared/types/poultryInventory";
import type { EggColor } from "@poultryhub/shared/types/layerBreed";
import type { PoultryHouse } from "@poultryhub/shared/types/poultryHouse";
import EggColorBadge from "@poultryhub/shared/components/inventory/EggColorBadge";
import LayerBreedSelect from "./LayerBreedSelect";
import PoultryHouseSelect from "../production/PoultryHouseSelect";

const EVENT_TYPE_LABELS: Record<PoultryEventType, string> = {
  arrival: "New Arrival",
  transfer: "Transfer Between Pens",
  sale: "Sale",
  culling: "Culling",
  mortality: "Mortality",
  count_update: "Count Update",
};

/**
 * Event Type -> Status is a strict 1:1 mapping (every event type has
 * exactly one valid status) — the database enforces this too (a CHECK
 * constraint, 0038_poultry_event_status_mapping.sql), so Status is always
 * fully determined by Event Type and the field is shown disabled, never a
 * free choice the Farm Admin could set to a mismatched value.
 */
const DEFAULT_STATUS_BY_EVENT_TYPE: Partial<Record<PoultryEventType, string>> = {
  arrival: "Active",
  transfer: "Transferred",
  sale: "Sold",
  culling: "Culled",
  count_update: "Active",
};

interface PoultryEventFormDrawerProps {
  /** null = create mode */
  event: PoultryEvent | null;
  fixedFarmId: string;
  /** Staff only sees arrival/transfer/count_update — matches what the RLS insert policy would accept anyway. */
  allowedEventTypes: PoultryEventType[];
  /** Every one of the farm's existing events — used only to derive per-house stock (currentStockByHouse) for Transfer/Sale validation and Count Update's "current count" display. Never written to directly. */
  events: PoultryEvent[];
  /** Farm Admin/Manager only — lets them register a new poultry house/pen or Layer Breed/Strain inline, same restriction as EggProductionFormDrawer's own canManageHouses. */
  canManageHouses?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * PoultryHub is a layer-chicken-only system — every new record is simply a
 * Layer. Editing an existing record (possibly a Chick/Grower/Breeder stage
 * logged before this restriction) keeps its own stored birdType untouched;
 * only new records are hardcoded. There's no UI control for this at all
 * anymore, by design.
 */
function toInputState(event: PoultryEvent | null, fixedFarmId: string, defaultEventType: PoultryEventType): PoultryEventInput {
  if (event) {
    return {
      farmId: event.farmId,
      eventDate: event.eventDate,
      birdType: event.birdType,
      eventType: event.eventType,
      quantity: event.quantity,
      fromHousePen: event.fromHousePen,
      fromHousePenId: event.fromHousePenId,
      toHousePen: event.toHousePen,
      toHousePenId: event.toHousePenId,
      notes: event.notes,
      breed: event.breed,
      ageLabel: event.ageLabel,
      source: event.source,
      status: event.status,
    };
  }
  return {
    farmId: fixedFarmId,
    eventDate: new Date().toISOString().slice(0, 10),
    birdType: "Layer",
    eventType: defaultEventType,
    quantity: 0,
    fromHousePen: null,
    fromHousePenId: null,
    toHousePen: null,
    toHousePenId: null,
    notes: null,
    breed: null,
    ageLabel: null,
    source: null,
    status: DEFAULT_STATUS_BY_EVENT_TYPE[defaultEventType] ?? "Active",
  };
}

export default function PoultryEventFormDrawer({
  event,
  fixedFarmId,
  allowedEventTypes,
  events,
  canManageHouses = false,
  onClose,
  onSaved,
}: PoultryEventFormDrawerProps) {
  const isEdit = event !== null;
  const toast = useToast();

  // Per-house stock, excluding this very event's own prior effect when
  // editing — so re-saving an existing count_update/transfer/sale validates
  // against "what the house would have without this record", not a figure
  // that already includes it (which would make editing a record look like
  // it's always invalid).
  const stockByHouse = currentStockByHouse(isEdit ? events.filter((e) => e.id !== event.id) : events);

  // Count Update stores a delta but shows/accepts an absolute count — when
  // editing, reconstruct that absolute value once here (stock excluding
  // this event + its stored delta) so both `input.quantity` and the text
  // field start in agreement; otherwise re-saving without touching the
  // Quantity field would silently re-derive a wrong delta from a stale raw
  // value.
  const initialQuantity =
    event && event.eventType === "count_update" && event.toHousePenId
      ? (stockByHouse[event.toHousePenId] ?? 0) + event.quantity
      : (event?.quantity ?? 0);

  const [input, setInput] = useState<PoultryEventInput>(() => ({
    ...toInputState(event, fixedFarmId, allowedEventTypes[0]),
    quantity: initialQuantity,
  }));
  const [quantityText, setQuantityText] = useState(() => (initialQuantity !== 0 ? String(initialQuantity) : ""));
  // The selected Layer Breed/Strain's egg color, for the badge next to it — input.breed only
  // stores the chosen strain's name (plain text, same as always), not its color.
  const [breedEggColor, setBreedEggColor] = useState<EggColor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing a record that already has a breed — resolve its egg color once so
  // the badge shows immediately, not only after the user re-picks something.
  useEffect(() => {
    if (!event?.breed) return;
    let cancelled = false;
    listLayerBreeds()
      .then((breeds) => {
        if (!cancelled) setBreedEggColor(breeds.find((b) => b.name === event.breed)?.eggColor ?? null);
      })
      .catch((err) => console.error("[PoultryEventFormDrawer] failed to resolve breed egg color:", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFromPen = input.eventType === "transfer" || input.eventType === "sale" || input.eventType === "culling";
  const showToPen = input.eventType === "arrival" || input.eventType === "transfer" || input.eventType === "count_update";
  const showBreedAge = input.eventType === "arrival" || input.eventType === "transfer";
  const showSource = input.eventType === "arrival";
  const isCountUpdate = input.eventType === "count_update";

  const fromPenLabel = input.eventType === "transfer" ? "From House/Pen" : "House/Pen";
  const toPenLabel = input.eventType === "arrival" ? "To House/Pen" : input.eventType === "count_update" ? "House/Pen" : "To House/Pen";

  // Count Update's Quantity field is the CORRECTED absolute count for the
  // selected house, not a delta — this is what the system stores as a
  // delta under the hood (so currentStockByHouse/currentStockByType/
  // currentStockByFarm, which all sum `quantity` directly, don't need to
  // change), but what the Farm Admin types and sees is just "the real
  // count right now", matching this feature's own worked example
  // ("Previous: 100, New: 95").
  const countUpdateHouseId = input.toHousePenId;
  const currentCountAtHouse = countUpdateHouseId ? (stockByHouse[countUpdateHouseId] ?? 0) : null;

  const handleEventTypeChange = (type: PoultryEventType) => {
    setInput((prev) => ({
      ...prev,
      eventType: type,
      status: DEFAULT_STATUS_BY_EVENT_TYPE[type] ?? prev.status,
      quantity: 0,
      // Clear anything the new event type wouldn't show, so a stale value
      // from a previously-selected type can't sneak into the payload.
      fromHousePenId: null,
      fromHousePen: null,
      toHousePenId: null,
      toHousePen: null,
      breed: null,
      ageLabel: null,
      source: null,
    }));
    setQuantityText("");
    setError(null);
  };

  const handleFromHouseChange = (house: PoultryHouse | null) => {
    setInput((prev) => ({ ...prev, fromHousePen: house?.name ?? null, fromHousePenId: house?.id ?? null }));
    setError(null);
  };

  const handleToHouseChange = (house: PoultryHouse | null) => {
    setInput((prev) => ({ ...prev, toHousePen: house?.name ?? null, toHousePenId: house?.id ?? null }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (showFromPen && !input.fromHousePenId) {
      setError(`Please select a ${fromPenLabel.toLowerCase()}.`);
      return;
    }
    if (showToPen && !input.toHousePenId) {
      setError(`Please select a ${toPenLabel.toLowerCase()}.`);
      return;
    }
    if (input.eventType === "transfer" && input.fromHousePenId && input.fromHousePenId === input.toHousePenId) {
      setError("From House/Pen and To House/Pen can't be the same.");
      return;
    }
    if (input.eventType === "arrival" && !input.breed) {
      setError("Please select a layer breed/strain.");
      return;
    }

    let payloadQuantity = input.quantity;

    if (isCountUpdate) {
      if (input.quantity < 0) {
        setError("Count can't be negative.");
        return;
      }
      const previous = currentCountAtHouse ?? 0;
      const delta = input.quantity - previous;
      if (delta === 0) {
        setError("That matches the current count — nothing to update.");
        return;
      }
      payloadQuantity = delta;
    } else {
      if (input.quantity <= 0) {
        setError("Quantity must be greater than 0.");
        return;
      }
      const sourceHouseId = showFromPen ? input.fromHousePenId : null;
      if (sourceHouseId) {
        const available = stockByHouse[sourceHouseId] ?? 0;
        if (input.quantity > available) {
          setError(`Insufficient stock. Only ${available.toLocaleString()} bird${available === 1 ? "" : "s"} available in ${fromPenLabel === "House/Pen" ? "this house/pen" : "the source house/pen"}.`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);
    const payload: PoultryEventInput = { ...input, quantity: payloadQuantity };
    try {
      if (isEdit) {
        await updateInventoryEvent(event.id, payload);
        toast.success("Record updated.");
      } else {
        await createInventoryEvent(payload);
        toast.success("Inventory record added successfully.");
      }
      onSaved();
    } catch (err) {
      console.error("[PoultryEventFormDrawer] save failed:", err);
      setError("Unable to save inventory record. Please try again.");
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
            {isEdit ? "Edit Inventory Event" : "Record Inventory Event"}
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
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}

            {/* 1. Event Type */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-type" className="text-sm font-medium text-[var(--color-foreground)]">
                Event Type
              </label>
              <select
                id="event-type"
                value={input.eventType}
                onChange={(e) => handleEventTypeChange(e.target.value as PoultryEventType)}
                disabled={isEdit}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
              >
                {allowedEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {EVENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Date, 3. Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="event-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={input.eventDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, eventDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quantity" className="text-sm font-medium text-[var(--color-foreground)]">
                  {isCountUpdate ? "Corrected Count" : "Quantity"}
                </label>
                <input
                  id="quantity"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter quantity"
                  value={quantityText}
                  onChange={(e) => {
                    const filtered = stripLeadingZeros(filterIntegerText(e.target.value));
                    setQuantityText(filtered);
                    setInput((prev) => ({ ...prev, quantity: parseNumericText(filtered) }));
                    setError(null);
                  }}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
                {isCountUpdate && countUpdateHouseId && (
                  <p className="text-xs text-[var(--color-muted)]">Current count: {(currentCountAtHouse ?? 0).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* 4. House/Pen(s) */}
            {(showFromPen || showToPen) && (
              <div className="grid grid-cols-2 gap-3">
                {showFromPen && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="from-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                      {fromPenLabel}
                    </label>
                    <PoultryHouseSelect
                      id="from-pen"
                      farmId={input.farmId}
                      value={input.fromHousePenId ?? ""}
                      onChange={handleFromHouseChange}
                      canManage={canManageHouses}
                    />
                    {input.fromHousePenId && (
                      <p className="text-xs text-[var(--color-muted)]">
                        Available: {(stockByHouse[input.fromHousePenId] ?? 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {showToPen && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="to-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                      {toPenLabel}
                    </label>
                    <PoultryHouseSelect
                      id="to-pen"
                      farmId={input.farmId}
                      value={input.toHousePenId ?? ""}
                      onChange={handleToHouseChange}
                      canManage={canManageHouses}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 5. Layer Breed / Strain, 6. Age */}
            {showBreedAge && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="breed" className="text-sm font-medium text-[var(--color-foreground)]">
                      Layer Breed / Strain
                    </label>
                    {breedEggColor && <EggColorBadge eggColor={breedEggColor} />}
                  </div>
                  <LayerBreedSelect
                    id="breed"
                    farmId={input.farmId}
                    value={input.breed ?? ""}
                    onChange={(breed) => {
                      setInput((prev) => ({ ...prev, breed: breed?.name ?? null }));
                      setBreedEggColor(breed?.eggColor ?? null);
                      setError(null);
                    }}
                    canManage={canManageHouses}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="age-label" className="text-sm font-medium text-[var(--color-foreground)]">
                    Age
                  </label>
                  <input
                    id="age-label"
                    value={input.ageLabel ?? ""}
                    onChange={(e) => setInput((prev) => ({ ...prev, ageLabel: e.target.value || null }))}
                    placeholder="e.g. 6 weeks"
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                  />
                </div>
              </div>
            )}

            {/* 7. Source, 8. Status */}
            <div className="grid grid-cols-2 gap-3">
              {showSource && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="source" className="text-sm font-medium text-[var(--color-foreground)]">
                    Source
                  </label>
                  <input
                    id="source"
                    value={input.source ?? ""}
                    onChange={(e) => setInput((prev) => ({ ...prev, source: e.target.value || null }))}
                    placeholder="e.g. Hatchery name"
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="stock-status" className="text-sm font-medium text-[var(--color-foreground)]">
                  Status
                </label>
                <select
                  id="stock-status"
                  value={input.status ?? "Active"}
                  disabled
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm text-[var(--color-muted)] outline-none disabled:opacity-100"
                >
                  <option value="Active">Active</option>
                  <option value="Sold">Sold</option>
                  <option value="Culled">Culled</option>
                  <option value="Transferred">Transferred</option>
                </select>
              </div>
            </div>

            {/* 9. Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-sm font-medium text-[var(--color-foreground)]">
                Notes
              </label>
              <textarea
                id="notes"
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
              {isEdit ? "Save changes" : "Record Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
