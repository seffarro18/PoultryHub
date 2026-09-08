import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Bird, Egg, Loader2, Search } from "lucide-react";
import { listInventoryEvents, currentStockByType, mortalityAlerts } from "@poultryhub/shared/services/poultryInventoryService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import PoultryStockBreakdownChart from "@poultryhub/shared/components/inventory/PoultryStockBreakdownChart";
import PoultryTrendChart from "../components/inventory/PoultryTrendChart";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

const EVENT_TYPE_LABELS: Record<PoultryEvent["eventType"], string> = {
  arrival: "New Arrival",
  transfer: "Transfer",
  sale: "Sale",
  mortality: "Mortality",
  count_update: "Count Update",
};

export default function PoultryInventoryPage() {
  const [events, setEvents] = useState<PoultryEvent[]>([]);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listInventoryEvents(), listMortalityRecords()])
      .then(([rows, mortality]) => {
        if (!cancelled) {
          setEvents(rows);
          setMortalityRecords(mortality);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load inventory data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stock = useMemo(() => currentStockByType(events, mortalityRecords), [events, mortalityRecords]);
  const alerts = useMemo(() => mortalityAlerts(events, mortalityRecords), [events, mortalityRecords]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((e) => e.farmName.toLowerCase().includes(term) || e.birdType.toLowerCase().includes(term));
  }, [events, search]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Poultry Inventory</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Cross-farm stock oversight — read-only. Adding and correcting records happens in each farm's own portal.
        </p>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading inventory…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Egg} label="Layers" value={stock.Layer} />
            <StatTile icon={Bird} label="Chicks" value={stock.Chick} />
            <StatTile icon={Bird} label="Growers" value={stock.Grower} />
            <StatTile icon={Bird} label="Breeders" value={stock.Breeder} />
          </div>

          {alerts.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-danger)]">
                <AlertTriangle size={16} /> Mortality Alerts
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {alerts.map((alert) => (
                  <li key={alert.farmId} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-foreground)]">{alert.farmName}</span>
                    <span className="text-[var(--color-danger)]">
                      {alert.mortality7d.toLocaleString()} deaths in 7 days ({alert.ratePercent.toFixed(1)}% of stock)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PoultryTrendChart events={events} mortalityRecords={mortalityRecords} />
            <PoultryStockBreakdownChart events={events} mortalityRecords={mortalityRecords} />
          </div>

          <div>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Inventory Table</h2>

            <div className="relative mt-3 max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by farm or bird type…"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {filteredEvents.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No events match that search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Farm</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Bird Type</th>
                        <th className="px-4 py-3 font-medium">Event</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 font-medium">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((event) => (
                        <tr key={event.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{event.farmName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">
                            {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{event.birdType}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{EVENT_TYPE_LABELS[event.eventType]}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{event.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{event.recordedByName ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
