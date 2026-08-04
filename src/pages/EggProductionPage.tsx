import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ClipboardList, Download, Egg, Loader2, Search, TrendingDown, TrendingUp, Warehouse } from "lucide-react";
import { aggregateByFarm, listEggProductionRecords, listFarms } from "../services/eggProductionService";
import { downloadCsv } from "../lib/exportCsv";
import EggReportsSection from "../components/production/EggReportsSection";
import FarmComparisonChart from "../components/production/FarmComparisonChart";
import StatTile from "../components/production/StatTile";
import { remainingEggs, type EggProductionRecord, type Farm } from "../types/eggProduction";

const LOW_HIGH_PERFORMER_THRESHOLD = 5;

export default function EggProductionPage() {
  const [records, setRecords] = useState<EggProductionRecord[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listEggProductionRecords(), listFarms()])
      .then(([recordRows, farmRows]) => {
        if (!cancelled) {
          setRecords(recordRows);
          setFarms(farmRows);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load production data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const approvedRecords = useMemo(() => records.filter((r) => r.status === "approved"), [records]);
  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);
  const totalCollected = useMemo(() => approvedRecords.reduce((sum, r) => sum + r.eggsCollected, 0), [approvedRecords]);
  const farmTotals = useMemo(() => aggregateByFarm(approvedRecords), [approvedRecords]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return approvedRecords;
    return approvedRecords.filter((r) => r.farmName.toLowerCase().includes(term));
  }, [approvedRecords, search]);

  const showTopLow = farmTotals.length > LOW_HIGH_PERFORMER_THRESHOLD;
  const topFarms = farmTotals.slice(0, 3);
  const lowFarms = farmTotals.slice(-3).reverse();

  const handleExport = () => {
    downloadCsv(
      `production-oversight-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRecords.map((r) => ({
        Farm: r.farmName,
        Date: r.productionDate,
        "House/Pen": r.housePen,
        Collected: r.eggsCollected,
        Good: r.goodEggs,
        "Broken/Cracked": r.crackedEggs,
        Damaged: r.damagedEggs,
        Sold: r.eggsSold,
        Remaining: remainingEggs(r),
      }))
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Egg Production</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Cross-farm production oversight — read-only. Daily entry and approval happen in each farm's own portal.
        </p>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading production data…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile icon={Egg} label="Total Egg Production" value={totalCollected} />
            <StatTile icon={Warehouse} label="Total Farms" value={farms.length} />
            <StatTile icon={ClipboardList} label="Pending Review (all farms)" value={pendingCount} />
          </div>

          <FarmComparisonChart data={farmTotals} />

          {showTopLow && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
                  <TrendingUp size={16} className="text-[var(--color-success)]" /> Top Performing Farms
                </div>
                <ol className="flex flex-col gap-2 text-sm">
                  {topFarms.map((f, i) => (
                    <li key={f.farmId} className="flex items-center justify-between text-[var(--color-foreground)]">
                      <span className="text-[var(--color-muted)]">
                        {i + 1}. {f.farmName}
                      </span>
                      <span className="font-medium">{f.totalCollected.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
                  <TrendingDown size={16} className="text-[var(--color-danger)]" /> Low Performing Farms
                </div>
                <ol className="flex flex-col gap-2 text-sm">
                  {lowFarms.map((f, i) => (
                    <li key={f.farmId} className="flex items-center justify-between text-[var(--color-foreground)]">
                      <span className="text-[var(--color-muted)]">
                        {i + 1}. {f.farmName}
                      </span>
                      <span className="font-medium">{f.totalCollected.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <EggReportsSection records={approvedRecords} includeYearly />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
                Production by Farm
              </h2>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>

            <div className="relative mt-3 max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by farm…"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {filteredRecords.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No approved records match that search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Farm</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">House/Pen</th>
                        <th className="px-4 py-3 font-medium">Collected</th>
                        <th className="px-4 py-3 font-medium">Good</th>
                        <th className="px-4 py-3 font-medium">Broken/Cracked</th>
                        <th className="px-4 py-3 font-medium">Damaged</th>
                        <th className="px-4 py-3 font-medium">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{record.farmName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">
                            {new Date(`${record.productionDate}T00:00:00`).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{record.eggsCollected.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.goodEggs.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.crackedEggs.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{record.damagedEggs.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{remainingEggs(record).toLocaleString()}</td>
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
