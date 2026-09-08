import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createInventoryEvent, updateInventoryEvent } from "@poultryhub/shared/services/poultryInventoryService";
import { BIRD_TYPES, type PoultryEvent, type PoultryEventInput, type PoultryEventType } from "@poultryhub/shared/types/poultryInventory";

const EVENT_TYPE_LABELS: Record<PoultryEventType, string> = {
  arrival: "New Arrival",
  transfer: "Transfer Between Pens",
  sale: "Sale",
  mortality: "Mortality",
  count_update: "Count Update",
};

interface PoultryEventFormDrawerProps {
  /** null = create mode */
  event: PoultryEvent | null;
  fixedFarmId: string;
  /** Staff only sees arrival/transfer/count_update — matches what the RLS insert policy would accept anyway. */
  allowedEventTypes: PoultryEventType[];
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(event: PoultryEvent | null, fixedFarmId: string, defaultEventType: PoultryEventType): PoultryEventInput {
  if (event) {
    return {
      farmId: event.farmId,
      eventDate: event.eventDate,
      birdType: event.birdType,
      eventType: event.eventType,
      quantity: event.quantity,
      fromHousePen: event.fromHousePen,
      toHousePen: event.toHousePen,
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
    toHousePen: null,
    notes: null,
    breed: null,
    ageLabel: null,
    source: null,
    status: null,
  };
}

export default function PoultryEventFormDrawer({
  event,
  fixedFarmId,
  allowedEventTypes,
  onClose,
  onSaved,
}: PoultryEventFormDrawerProps) {
  const isEdit = event !== null;
  const [input, setInput] = useState<PoultryEventInput>(() => toInputState(event, fixedFarmId, allowedEventTypes[0]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showFromPen = input.eventType === "transfer" || input.eventType === "sale" || input.eventType === "mortality";
  const showToPen = input.eventType === "arrival" || input.eventType === "transfer";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.quantity === 0) {
      setError("Quantity can't be zero.");
      return;
    }
    if (input.eventType !== "count_update" && input.quantity < 0) {
      setError("Only a count update can be negative.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateInventoryEvent(event.id, input);
      } else {
        await createInventoryEvent(input);
      }
      onSaved();
    } catch (err) {
      console.error("[PoultryEventFormDrawer] save failed:", err);
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="event-type" className="text-sm font-medium text-[var(--color-foreground)]">
                  Event Type
                </label>
                <select
                  id="event-type"
                  value={input.eventType}
                  onChange={(e) => setInput((prev) => ({ ...prev, eventType: e.target.value as PoultryEventType }))}
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bird-type" className="text-sm font-medium text-[var(--color-foreground)]">
                  Bird Type
                </label>
                <select
                  id="bird-type"
                  value={input.birdType}
                  onChange={(e) => setInput((prev) => ({ ...prev, birdType: e.target.value as PoultryEventInput["birdType"] }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                >
                  {BIRD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}s
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                  Quantity {input.eventType === "count_update" && "(+/-)"}
                </label>
                <input
                  id="quantity"
                  type="number"
                  value={input.quantity}
                  onChange={(e) => setInput((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {(showFromPen || showToPen) && (
              <div className="grid grid-cols-2 gap-3">
                {showFromPen && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="from-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                      From House/Pen
                    </label>
                    <input
                      id="from-pen"
                      value={input.fromHousePen ?? ""}
                      onChange={(e) => setInput((prev) => ({ ...prev, fromHousePen: e.target.value || null }))}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                    />
                  </div>
                )}
                {showToPen && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="to-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                      To House/Pen
                    </label>
                    <input
                      id="to-pen"
                      value={input.toHousePen ?? ""}
                      onChange={(e) => setInput((prev) => ({ ...prev, toHousePen: e.target.value || null }))}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                    />
                  </div>
                )}
              </div>
            )}

            {input.eventType === "arrival" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="breed" className="text-sm font-medium text-[var(--color-foreground)]">
                      Breed
                    </label>
                    <input
                      id="breed"
                      value={input.breed ?? ""}
                      onChange={(e) => setInput((prev) => ({ ...prev, breed: e.target.value || null }))}
                      placeholder="Optional"
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
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

                <div className="grid grid-cols-2 gap-3">
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
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="stock-status" className="text-sm font-medium text-[var(--color-foreground)]">
                      Status
                    </label>
                    <select
                      id="stock-status"
                      value={input.status ?? "Active"}
                      onChange={(e) => setInput((prev) => ({ ...prev, status: e.target.value }))}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                    >
                      <option value="Active">Active</option>
                      <option value="Sold">Sold</option>
                      <option value="Culled">Culled</option>
                      <option value="Transferred">Transferred</option>
                    </select>
                  </div>
                </div>
              </>
            )}

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
              {isEdit ? "Save changes" : "Add record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
