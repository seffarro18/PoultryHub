import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Bird, Download, HeartPulse, Loader2, Monitor, Printer, Search, ShieldCheck, Stethoscope, Syringe } from "lucide-react";
import { listHealthRecords, vaccinationFollowUpFarms } from "@poultryhub/shared/services/healthRecordService";
import { currentStockByFarm, listInventoryEvents } from "@poultryhub/shared/services/poultryInventoryService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import HealthAnalytics from "../components/health/HealthAnalytics";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import { treatmentStatus, vaccinationStatus, type HealthRecord } from "@poultryhub/shared/types/health";

const todayIso = () => new Date().toISOString().slice(0, 10);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function HealthRecordsOversightPage() {
  const breakpoint = useBreakpoint();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listHealthRecords(), listInventoryEvents(), listMortalityRecords()])
      .then(([healthRecords, events, mortalityRecords]) => {
        if (cancelled) return;
        setRecords(healthRecords);
        setTotalStock(currentStockByFarm(events, mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load health records.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recentApproved = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return records.filter((r) => r.status === "approved" && new Date(`${r.recordDate}T00:00:00`).getTime() >= cutoff);
  }, [records]);

  const sickPoultry = useMemo(() => recentApproved.reduce((sum, r) => sum + r.affectedBirds, 0), [recentApproved]);
  const healthyPoultry = Math.max(0, totalStock - sickPoultry);
  const activeFarmCount = useMemo(() => new Set(recentApproved.map((r) => r.farmId)).size, [recentApproved]);

  const approvedAll = useMemo(() => records.filter((r) => r.status === "approved"), [records]);
  const vaccinationRate = useMemo(() => {
    if (approvedAll.length === 0) return 0;
    const vaccinated = approvedAll.filter((r) => r.vaccination && r.vaccination.trim()).length;
    return Math.round((vaccinated / approvedAll.length) * 100);
  }, [approvedAll]);

  const followUp = useMemo(() => vaccinationFollowUpFarms(records), [records]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter(
      (r) =>
        r.farmName.toLowerCase().includes(term) ||
        r.housePen.toLowerCase().includes(term) ||
        r.diseaseCondition.toLowerCase().includes(term)
    );
  }, [records, search]);

  const today = todayIso();

  const handleExportHealthReport = () => {
    downloadCsv(
      `health-report-${today}.csv`,
      records.map((r) => ({
        Farm: r.farmName,
        "House/Pen": r.housePen,
        "Disease/Condition": r.diseaseCondition,
        "Affected Birds": r.affectedBirds,
        "Treatment Status": treatmentStatus(r),
        "Vaccination Status": vaccinationStatus(r),
        "Date Reported": r.recordDate,
        "Recorded By": r.recordedByName ?? "",
        Status: r.status,
      }))
    );
  };

  const handleExportDiseaseReport = () => {
    downloadCsv(
      `disease-report-${today}.csv`,
      approvedAll.map((r) => ({ Farm: r.farmName, "Disease/Condition": r.diseaseCondition, "Affected Birds": r.affectedBirds, Date: r.recordDate }))
    );
  };

  const handleExportVaccinationReport = () => {
    downloadCsv(
      `vaccination-report-${today}.csv`,
      approvedAll.map((r) => ({ Farm: r.farmName, "House/Pen": r.housePen, Vaccination: r.vaccination ?? "", Date: r.recordDate }))
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
            Health Records supervision is designed for desktop. Please switch to a larger screen.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading health records…
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
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Health Records</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            System-wide health supervision — read-only. Recording and reviewing happens in each farm's own portal.
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
        <StatTile icon={Bird} label="Total Healthy Poultry" value={healthyPoultry} />
        <StatTile icon={Stethoscope} label="Total Sick Poultry (7d)" value={sickPoultry} />
        <StatTile icon={AlertTriangle} label="Farms w/ Active Cases (7d)" value={activeFarmCount} />
        <StatTile icon={Syringe} label="Vaccination Compliance Rate" value={`${vaccinationRate}%`} />
      </div>

      {followUp.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--color-warning)]" />
            <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Alerts</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Farms with no vaccination recorded in over 60 days — a live indicator, not a stored notification.
          </p>
          <div className="mt-3 flex flex-col divide-y divide-[var(--color-border)]">
            {followUp.map((f) => (
              <div key={f.farmId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-[var(--color-foreground)]">{f.farmName}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {f.daysSinceLastVaccination === null ? "Never recorded" : `${f.daysSinceLastVaccination} days ago`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Health Monitoring</h2>
          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farm, house/pen, or disease…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No health records match that search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Farm</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Disease/Condition</th>
                    <th className="px-4 py-3 font-medium">Affected Birds</th>
                    <th className="px-4 py-3 font-medium">Treatment Status</th>
                    <th className="px-4 py-3 font-medium">Vaccination Status</th>
                    <th className="px-4 py-3 font-medium">Date Reported</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.farmName}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.diseaseCondition}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.affectedBirds}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{treatmentStatus(r)}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{vaccinationStatus(r)}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordDate}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordedByName ?? "—"}</td>
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
        <HealthAnalytics records={records} />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportHealthReport} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Health Report (CSV/Excel)
          </button>
          <button type="button" onClick={handleExportDiseaseReport} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <HeartPulse size={13} /> Disease Report (CSV/Excel)
          </button>
          <button type="button" onClick={handleExportVaccinationReport} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Syringe size={13} /> Vaccination Report (CSV/Excel)
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
