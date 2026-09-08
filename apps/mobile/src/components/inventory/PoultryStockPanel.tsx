import { useMemo, useState } from "react";
import { Bird, Egg, Loader2, Pencil, Plus, Search, Trash2, TrendingDown, UserPlus } from "lucide-react";
import { currentStockByType, deleteInventoryEvent, setStaffCanDeleteInventory } from "@poultryhub/shared/services/poultryInventoryService";
import PoultryEventFormDrawer from "./PoultryEventFormDrawer";
import PoultryStockBreakdownChart from "@poultryhub/shared/components/inventory/PoultryStockBreakdownChart";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { BIRD_TYPES, type BirdType, type PoultryEvent, type PoultryEventType } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

const ALL_EVENT_TYPES: PoultryEventType[] = ["arrival", "transfer", "sale", "count_update"];
const EVENT_TYPE_LABELS: Record<PoultryEventType, string> = {
  arrival: "New Arrival",
  transfer: "Transfer",
  sale: "Sale",
  mortality: "Mortality",
  count_update: "Count Update",
};

function isThisMonth(dateStr: string, today: Date): boolean {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

interface PoultryStockPanelProps {
  farmId: string;
  isFarmAdmin: boolean;
  events: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  staffCanDelete: boolean;
  onStaffCanDeleteChange: (allowed: boolean) => void;
  refresh: () => Promise<void>;
}

export default function PoultryStockPanel({
  farmId,
  isFarmAdmin,
  events,
  mortalityRecords,
  staffCanDelete,
  onStaffCanDeleteChange,
  refresh,
}: PoultryStockPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<BirdType | "All">("All");
  const [editingEvent, setEditingEvent] = useState<PoultryEvent | null | "new">(null);
  const [togglingPermission, setTogglingPermission] = useState(false);

  const stock = useMemo(() => currentStockByType(events, mortalityRecords), [events, mortalityRecords]);
  const totalChickens = stock.Layer + stock.Chick + stock.Grower + stock.Breeder;

  const { monthlyMortality, monthlyArrivals } = useMemo(() => {
    const today = new Date();
    let mortality = 0;
    let arrivals = 0;
    for (const record of mortalityRecords) {
      if (record.status === "approved" && isThisMonth(record.recordDate, today)) mortality += record.deadBirds;
    }
    for (const event of events) {
      if (event.eventType === "arrival" && isThisMonth(event.eventDate, today)) arrivals += event.quantity;
    }
    return { monthlyMortality: mortality, monthlyArrivals: arrivals };
  }, [events, mortalityRecords]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter !== "All" && e.birdType !== typeFilter) return false;
      if (
        term &&
        !(e.fromHousePen ?? "").toLowerCase().includes(term) &&
        !(e.toHousePen ?? "").toLowerCase().includes(term) &&
        !(e.recordedByName ?? "").toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [events, search, typeFilter]);

  const handleDelete = async (event: PoultryEvent) => {
    if (!window.confirm(`Delete this ${EVENT_TYPE_LABELS[event.eventType].toLowerCase()} record? This can't be undone.`)) return;
    setBusyId(event.id);
    try {
      await deleteInventoryEvent(event.id);
      await refresh();
    } catch (err) {
      console.error("[PoultryStockPanel] delete failed:", err);
      alert("Couldn't delete that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStaffPermission = async () => {
    const next = !staffCanDelete;
    setTogglingPermission(true);
    try {
      await setStaffCanDeleteInventory(farmId, next);
      onStaffCanDeleteChange(next);
    } catch (err) {
      console.error("[PoultryStockPanel] toggle staff permission failed:", err);
      alert("Couldn't update that setting.");
    } finally {
      setTogglingPermission(false);
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Bird} label="Total Chickens" value={totalChickens} />
        <StatTile icon={Egg} label="Active Layers" value={stock.Layer} />
        <StatTile icon={Bird} label="Chicks" value={stock.Chick} />
        <StatTile icon={TrendingDown} label="Mortality (this month)" value={monthlyMortality} />
        <StatTile icon={UserPlus} label="New Arrivals (this month)" value={monthlyArrivals} />
      </div>

      <PoultryStockBreakdownChart events={events} mortalityRecords={mortalityRecords} />

      {isFarmAdmin && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-foreground)]">Allow staff to delete their own records</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Off by default — staff can always add/edit, but never delete unless you turn this on.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleToggleStaffPermission()}
            disabled={togglingPermission}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              staffCanDelete ? "bg-[var(--color-primary)]" : "bg-[var(--color-muted-bg)]"
            }`}
            aria-pressed={staffCanDelete}
            aria-label="Allow staff to delete their own inventory records"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                staffCanDelete ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      )}

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Records</h2>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search house/pen or recorded by…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as BirdType | "All")}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
          >
            <option value="All">All bird types</option>
            {BIRD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}s
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">
              {events.length === 0 ? "No records yet — add the first one." : "No records match those filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Bird Type</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Breed</th>
                    <th className="px-4 py-3 font-medium">Age</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">From/To</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => (
                    <tr key={event.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">
                        {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{event.birdType}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{EVENT_TYPE_LABELS[event.eventType]}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{event.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{event.breed ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{event.ageLabel ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{event.source ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {[event.fromHousePen, event.toHousePen].filter(Boolean).join(" → ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{event.recordedByName ?? "—"}</td>
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
                            <button
                              type="button"
                              onClick={() => void handleDelete(event)}
                              title="Delete"
                              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                            >
                              <Trash2 size={14} />
                            </button>
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
          allowedEventTypes={ALL_EVENT_TYPES}
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
