import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, AlertTriangle, Bird, Download, Egg, FileSpreadsheet, Loader2, Printer, Search, Skull } from "lucide-react";
import { currentStockByFarm, currentStockByType, listInventoryEvents, mortalityAlerts } from "@poultryhub/shared/services/poultryInventoryService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import PoultryStockBreakdownChart from "@poultryhub/shared/components/inventory/PoultryStockBreakdownChart";
import PoultryTrendChart from "../components/inventory/PoultryTrendChart";
import MortalityAnalytics from "../components/health/MortalityAnalytics";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

const EVENT_TYPE_LABELS: Record<PoultryEvent["eventType"], string> = {
  arrival: "New Arrival",
  transfer: "Transfer",
  sale: "Sale",
  culling: "Culling",
  mortality: "Mortality",
  count_update: "Count Update",
};

type Tab = "stock" | "mortality";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const todayIso = () => new Date().toISOString().slice(0, 10);

// /dashboard/production/mortality aliases into this same page (old persisted
// notification links still point there) — mirrors this app's other
// path-derived-tab pages.
function initialTabFromPath(pathname: string): Tab {
  return pathname.endsWith("/mortality") ? "mortality" : "stock";
}

export default function PoultryInventoryPage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => initialTabFromPath(location.pathname));

  const [events, setEvents] = useState<PoultryEvent[]>([]);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mortalitySearch, setMortalitySearch] = useState("");

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
        if (!cancelled) setLoadError(getErrorMessage(err, "Failed to load inventory data."));
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
  const stockTotals = useMemo(() => currentStockByFarm(events, mortalityRecords), [events, mortalityRecords]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((e) => e.farmName.toLowerCase().includes(term) || e.birdType.toLowerCase().includes(term));
  }, [events, search]);

  const recentApprovedMortality = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return mortalityRecords.filter((r) => r.status === "approved" && new Date(`${r.recordDate}T00:00:00`).getTime() >= cutoff);
  }, [mortalityRecords]);
  const totalMortality30d = useMemo(() => recentApprovedMortality.reduce((sum, r) => sum + r.deadBirds, 0), [recentApprovedMortality]);
  const totalStock = useMemo(() => stockTotals.reduce((sum, f) => sum + f.totalStock, 0), [stockTotals]);
  const mortalityRate30d = totalStock > 0 ? Math.round((totalMortality30d / totalStock) * 1000) / 10 : 0;
  const farmsReporting30d = useMemo(() => new Set(recentApprovedMortality.map((r) => r.farmId)).size, [recentApprovedMortality]);
  const pendingMortalityCount = useMemo(() => mortalityRecords.filter((r) => r.status === "pending").length, [mortalityRecords]);

  const filteredMortality = useMemo(() => {
    const term = mortalitySearch.trim().toLowerCase();
    if (!term) return mortalityRecords;
    return mortalityRecords.filter(
      (r) => r.farmName.toLowerCase().includes(term) || r.housePen.toLowerCase().includes(term) || (r.causeOfDeath ?? "").toLowerCase().includes(term)
    );
  }, [mortalityRecords, mortalitySearch]);

  const handleExportMortalityReport = () => {
    downloadCsv(
      `mortality-report-${todayIso()}.csv`,
      mortalityRecords.map((r) => ({
        Farm: r.farmName,
        "House/Pen": r.housePen,
        "Dead Birds": r.deadBirds,
        "Cause of Death": r.causeOfDeath ?? "",
        "Disposal Method": r.disposalMethod ?? "",
        "Date Recorded": r.recordDate,
        "Recorded By": r.recordedByName ?? "",
        Status: r.status,
      }))
    );
  };

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Poultry Inventory</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cross-farm stock oversight — read-only. Adding and correcting records happens in each farm's own portal.
          </p>
        </div>
        {tab === "mortality" && (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            <Printer size={14} /> Print / Save as PDF
          </button>
        )}
      </div>

      <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium print:hidden" style={{ width: "fit-content" }}>
        {(
          [
            ["stock", "Poultry Stock"],
            ["mortality", "Mortality"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              tab === value ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
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
      ) : tab === "stock" ? (
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
      ) : (
        <div className="flex flex-col gap-5 print:gap-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Skull} label="Total Mortality (30d)" value={totalMortality30d} />
            <StatTile icon={Skull} label="Mortality Rate" value={`${mortalityRate30d}%`} />
            <StatTile icon={Skull} label="Farms Reporting (30d)" value={farmsReporting30d} />
            <StatTile icon={Skull} label="Pending Reviews" value={pendingMortalityCount} />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Mortality Monitoring</h2>
              <div className="relative sm:max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                <input
                  type="search"
                  value={mortalitySearch}
                  onChange={(e) => setMortalitySearch(e.target.value)}
                  placeholder="Search farm, house/pen, or cause…"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {filteredMortality.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No mortality records match that search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Farm</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Deaths</th>
                        <th className="px-4 py-3 font-medium">Cause of Death</th>
                        <th className="px-4 py-3 font-medium">Date Recorded</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMortality.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{r.farmName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.deadBirds}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{r.causeOfDeath ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordDate}</td>
                          <td className="px-4 py-3">
                            <ProductionStatusBadge status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="print:hidden">
            <MortalityAnalytics records={mortalityRecords} stockTotals={stockTotals} />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
            <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportMortalityReport}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
              >
                <Download size={13} /> Mortality Report (CSV/Excel)
              </button>
              <button
                type="button"
                onClick={handleExportMortalityReport}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
              >
                <FileSpreadsheet size={13} /> Monthly Mortality Analytics (CSV/Excel)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
              >
                <Printer size={13} /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
