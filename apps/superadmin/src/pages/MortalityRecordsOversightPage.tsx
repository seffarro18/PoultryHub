import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, FileSpreadsheet, Loader2, Monitor, Printer, Search, Skull } from "lucide-react";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { currentStockByFarm, listInventoryEvents } from "@poultryhub/shared/services/poultryInventoryService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import MortalityAnalytics from "../components/health/MortalityAnalytics";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";
import type { FarmStockTotal } from "@poultryhub/shared/services/poultryInventoryService";

const todayIso = () => new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function MortalityRecordsOversightPage() {
  const breakpoint = useBreakpoint();
  const [records, setRecords] = useState<MortalityRecord[]>([]);
  const [stockTotals, setStockTotals] = useState<FarmStockTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMortalityRecords(), listInventoryEvents()])
      .then(([mortalityRecords, events]) => {
        if (cancelled) return;
        setRecords(mortalityRecords);
        setStockTotals(currentStockByFarm(events, mortalityRecords));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load mortality records.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recentApproved = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return records.filter((r) => r.status === "approved" && new Date(`${r.recordDate}T00:00:00`).getTime() >= cutoff);
  }, [records]);

  const totalMortality = useMemo(() => recentApproved.reduce((sum, r) => sum + r.deadBirds, 0), [recentApproved]);
  const totalStock = useMemo(() => stockTotals.reduce((sum, f) => sum + f.totalStock, 0), [stockTotals]);
  const mortalityRate = totalStock > 0 ? Math.round((totalMortality / totalStock) * 1000) / 10 : 0;
  const farmsReporting = useMemo(() => new Set(recentApproved.map((r) => r.farmId)).size, [recentApproved]);
  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter(
      (r) => r.farmName.toLowerCase().includes(term) || r.housePen.toLowerCase().includes(term) || r.causeOfDeath.toLowerCase().includes(term)
    );
  }, [records, search]);

  const today = todayIso();

  const handleExportMortalityReport = () => {
    downloadCsv(
      `mortality-report-${today}.csv`,
      records.map((r) => ({
        Farm: r.farmName,
        "House/Pen": r.housePen,
        "Dead Birds": r.deadBirds,
        "Cause of Death": r.causeOfDeath,
        "Disposal Method": r.disposalMethod ?? "",
        "Date Recorded": r.recordDate,
        "Recorded By": r.recordedByName ?? "",
        Status: r.status,
      }))
    );
  };

  if (breakpoint !== "desktop") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Monitor size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Best viewed on a larger screen</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Mortality Records supervision is designed for desktop. Please switch to a larger screen.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading mortality records…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Mortality Records</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            System-wide mortality supervision — read-only. Recording and reviewing happens in each farm's own portal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Skull} label="Total Mortality (30d)" value={totalMortality} />
        <StatTile icon={Skull} label="Mortality Rate" value={`${mortalityRate}%`} />
        <StatTile icon={Skull} label="Farms Reporting (30d)" value={farmsReporting} />
        <StatTile icon={Skull} label="Pending Reviews" value={pendingCount} />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Mortality Monitoring</h2>
          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farm, house/pen, or cause…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {filtered.length === 0 ? (
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
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.farmName}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.deadBirds}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.causeOfDeath}</td>
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
        <MortalityAnalytics records={records} stockTotals={stockTotals} />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportMortalityReport} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Mortality Report (CSV/Excel)
          </button>
          <button type="button" onClick={handleExportMortalityReport} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <FileSpreadsheet size={13} /> Monthly Mortality Analytics (CSV/Excel)
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
