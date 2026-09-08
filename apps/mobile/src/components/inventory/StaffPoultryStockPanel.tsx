import { useMemo, useState } from "react";
import { Bird, Egg, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { currentStockByType, deleteInventoryEvent } from "@poultryhub/shared/services/poultryInventoryService";
import PoultryEventFormDrawer from "./PoultryEventFormDrawer";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { PoultryEvent, PoultryEventType } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

const ALLOWED_EVENT_TYPES: PoultryEventType[] = ["arrival", "transfer", "count_update"];
const EVENT_TYPE_LABELS: Record<PoultryEventType, string> = {
  arrival: "New Arrival",
  transfer: "Transfer",
  sale: "Sale",
  mortality: "Mortality",
  count_update: "Count Update",
};

interface StaffPoultryStockPanelProps {
  farmId: string;
  userId: string;
  events: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  canDelete: boolean;
  refresh: () => Promise<void>;
}

export default function StaffPoultryStockPanel({ farmId, userId, events, mortalityRecords, canDelete, refresh }: StaffPoultryStockPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<PoultryEvent | null | "new">(null);

  const stock = useMemo(() => currentStockByType(events, mortalityRecords), [events, mortalityRecords]);
  const totalChickens = stock.Layer + stock.Chick + stock.Grower + stock.Breeder;
  const myEvents = useMemo(() => events.filter((e) => e.recordedById === userId), [events, userId]);

  const handleDelete = async (event: PoultryEvent) => {
    if (!window.confirm("Delete this record? This can't be undone.")) return;
    setBusyId(event.id);
    try {
      await deleteInventoryEvent(event.id);
      await refresh();
    } catch (err) {
      console.error("[StaffPoultryStockPanel] delete failed:", err);
      alert("Couldn't delete that record.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditingEvent("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Add Record
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={Bird} label="Total Chickens" value={totalChickens} />
        <StatTile icon={Egg} label="Layers" value={stock.Layer} />
        <StatTile icon={Bird} label="Chicks" value={stock.Chick} />
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">My Records</h2>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {myEvents.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No records yet — add the first one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Bird Type</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">From/To</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myEvents.map((event) => (
                    <tr key={event.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">
                        {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{event.birdType}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{EVENT_TYPE_LABELS[event.eventType]}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{event.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {[event.fromHousePen, event.toHousePen].filter(Boolean).join(" → ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {busyId === event.id ? (
                          <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingEvent(event)}
                              title="Edit"
                              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                            >
                              <Pencil size={14} />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(event)}
                                title="Delete"
                                className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingEvent !== null && (
        <PoultryEventFormDrawer
          event={editingEvent === "new" ? null : editingEvent}
          fixedFarmId={farmId}
          allowedEventTypes={ALLOWED_EVENT_TYPES}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
