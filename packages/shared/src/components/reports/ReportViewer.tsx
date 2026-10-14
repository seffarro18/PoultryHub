import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Info, Loader2, Printer, RotateCcw } from "lucide-react";
import ErrorState from "../ui/ErrorState";
import ReportTable, { formatCell } from "./ReportTable";
import { loadReportData, scopeToFarm, type ReportData } from "../../services/reportDataService";
import { downloadReportCsv } from "../../lib/exportCsv";
import { getErrorMessage } from "../../lib/errorMessage";
import type { ReportDefinition } from "../../lib/reportCatalog";
import {
  RANGE_PRESET_LABEL,
  deviceTimeZone,
  formatDateTime,
  formatRange,
  localIsoDate,
  previousRange,
  resolveRange,
  type DateRange,
  type RangePreset,
} from "../../lib/reportPeriods";
import { statusLabel } from "../../lib/reportUtils";
import {
  FILTER_LABEL,
  REPORT_CATEGORY_LABEL,
  type FilterKey,
  type FilterValues,
  type ReportContext,
  type ReportOutput,
  type ReportRole,
  type ReportRow,
  type ReportTable as ReportTableData,
} from "../../types/report";

export interface SelectRenderProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

interface ReportViewerProps {
  report: ReportDefinition;
  role: ReportRole;
  userId: string | null;
  /** Farm users: their own farm's name. Super Admin: resolved from `farms`. */
  farmName: string | null;
  /** Super Admin only — enables the farm selector. */
  farms?: { id: string; name: string }[];
  onBack: () => void;
  /** Opens another report with the same period (keeps the query string). */
  onOpenReport: (reportId: string, search: string) => void;
  /** Lets an app use its own dropdown (mobile: MobileSelect). Defaults to a native select. */
  SelectComponent?: ComponentType<SelectRenderProps>;
}

const PRESETS: RangePreset[] = ["today", "yesterday", "last7", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "all", "custom"];
const ALL_FARMS = "";

function NativeSelect({ id, label, value, onChange, options }: SelectRenderProps) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const TONE_COLOR: Record<string, string> = {
  positive: "var(--color-success)",
  negative: "var(--color-danger)",
  warning: "var(--color-warning)",
};

export default function ReportViewer({ report, role, userId, farmName, farms, onBack, onOpenReport, SelectComponent }: ReportViewerProps) {
  const [params, setParams] = useSearchParams();
  const today = localIsoDate();
  const preset = (params.get("preset") as RangePreset | null) ?? report.defaultPreset;
  const custom: DateRange | null = params.get("from") && params.get("to") ? { from: params.get("from")!, to: params.get("to")! } : null;
  const range = useMemo(() => resolveRange(preset, custom, today), [preset, custom?.from, custom?.to, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const farmId = farms ? (params.get("farm") ?? ALL_FARMS) : null;
  const filters: FilterValues = useMemo(() => {
    const values: FilterValues = {};
    for (const key of report.filters) {
      const v = params.get(`f.${key}`);
      if (v) values[key] = v;
    }
    return values;
  }, [params, report.filters]);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>(new Date().toISOString());

  // Only the audit dataset is queried by date on the server; everything else
  // is loaded once and filtered locally, so changing the period doesn't refetch.
  const usesAudit = report.datasets(role).includes("audit");
  const loadKey = `${report.id}|${usesAudit ? `${range.from}|${range.to}` : ""}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadReportData(report.datasets(role), range);
      setData(loaded);
      setGeneratedAt(new Date().toISOString());
    } catch (err) {
      console.error(`[ReportViewer] ${report.id} failed to load:`, err);
      setData(null);
      setError(getErrorMessage(err, "Couldn't load this report's data."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const scoped = useMemo(() => (data ? scopeToFarm(data, farmId || null) : null), [data, farmId]);
  const multiFarm = Boolean(farms && !farmId && farms.length > 1);
  const ctx: ReportContext = useMemo(
    () => ({ range, preset, previous: previousRange(preset, range), filters, today, multiFarm, role, userId }),
    [range, preset, filters, today, multiFarm, role, userId]
  );

  const { output, buildError } = useMemo((): { output: ReportOutput | null; buildError: string | null } => {
    if (!scoped) return { output: null, buildError: null };
    try {
      return { output: report.build(scoped, ctx), buildError: null };
    } catch (err) {
      console.error(`[ReportViewer] ${report.id} failed to build:`, err);
      return { output: null, buildError: getErrorMessage(err, "This report couldn't be calculated.") };
    }
  }, [scoped, ctx, report]);

  const options = useMemo(() => (scoped ? report.options(scoped, { role }) : {}), [scoped, report, role]);
  const scopeName = farms ? (farmId ? (farms.find((f) => f.id === farmId)?.name ?? "Selected farm") : "All farms") : (farmName ?? "Your farm");
  const appliedFilters = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${FILTER_LABEL[k as FilterKey]}: ${k === "status" ? statusLabel(v) : v}`);

  const visibleColumns = (table: ReportTableData) => table.columns.filter((c) => c.key !== "farm" || multiFarm);

  const exportTable = (table: ReportTableData, rows: ReportRow[]) => {
    const columns = visibleColumns(table);
    const stamp = localIsoDate();
    downloadReportCsv(
      `${report.id}-${table.id}-${range.from === "0000-01-01" ? "all" : range.from}-to-${range.to}-${stamp}.csv`,
      [
        ["Report", `${report.title} — ${table.title}`],
        ["Farm", scopeName],
        ["Period", `${range.from === "0000-01-01" ? "All time" : range.from} to ${range.to}`],
        ["Filters", appliedFilters.join("; ") || "None"],
        ["Generated", formatDateTime(generatedAt)],
        ["Time zone", deviceTimeZone()],
      ],
      columns.map((c) => (c.suffix ? `${c.label} (${c.suffix})` : c.label)),
      rows.map((row) =>
        columns.map((c) => {
          const v = row[c.key];
          if (v === null || v === undefined) return "";
          // Raw numbers (no thousands separators/₱) so spreadsheets can total them.
          if (typeof v === "number") return v;
          if (c.format === "datetime") return formatCell(v, c);
          return v;
        })
      )
    );
  };

  const mainTable = output?.tables.find((t) => !t.compact) ?? output?.tables[0];
  const Select = SelectComponent ?? NativeSelect;

  return (
    <div className="report-root flex flex-col gap-4">
      {/* Print-only letterhead */}
      <div className="hidden border-b border-black pb-2 print:block">
        <p className="text-lg font-bold">PoultryHub</p>
        <p className="text-base font-semibold">{report.title}</p>
        <p className="text-xs">
          {scopeName} · {formatRange(range)} · Generated {formatDateTime(generatedAt)} ({deviceTimeZone()})
        </p>
        <p className="text-xs">Filters: {appliedFilters.join("; ") || "None"}</p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:opacity-80">
            <ArrowLeft size={13} /> All reports
          </button>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{REPORT_CATEGORY_LABEL[report.category]}</p>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">{report.title}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{report.description}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {scopeName} · {formatRange(range)} · Generated {formatDateTime(generatedAt)}
          </p>
          {appliedFilters.length > 0 && <p className="mt-0.5 text-xs text-[var(--color-muted)]">Filters: {appliedFilters.join(" · ")}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!mainTable}
            onClick={() => mainTable && exportTable(mainTable, mainTable.rows)}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            disabled={!output}
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {farms && (
            <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
              Farm
              <Select {...{
                id: "report-farm",
                label: "Farm",
                value: farmId ?? ALL_FARMS,
                onChange: (v) => setParam("farm", v || null),
                options: [{ value: ALL_FARMS, label: "All farms (combined)" }, ...farms.map((f) => ({ value: f.id, label: f.name }))],
              }} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            Period
            <Select {...{
              id: "report-period",
              label: "Period",
              value: preset,
              onChange: (v) => {
                const next = new URLSearchParams(params);
                next.set("preset", v);
                if (v === "custom" && !next.get("from")) {
                  next.set("from", range.from === "0000-01-01" ? today : range.from);
                  next.set("to", range.to);
                }
                setParams(next, { replace: true });
              },
              options: PRESETS.map((p) => ({ value: p, label: RANGE_PRESET_LABEL[p] })),
            }} />
          </label>
          {preset === "custom" && (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
                From
                <input
                  type="date"
                  value={custom?.from ?? range.from}
                  max={custom?.to ?? today}
                  onChange={(e) => setParam("from", e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
                To
                <input
                  type="date"
                  value={custom?.to ?? range.to}
                  min={custom?.from}
                  onChange={(e) => setParam("to", e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </label>
            </>
          )}
          {report.filters.map((key) => {
            const values = options[key] ?? [];
            return (
              <label key={key} className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
                {FILTER_LABEL[key]}
                <Select {...{
                  id: `report-filter-${key}`,
                  label: FILTER_LABEL[key],
                  value: filters[key] ?? "",
                  onChange: (v) => setParam(`f.${key}`, v || null),
                  options: [{ value: "", label: "All" }, ...values.map((v) => ({ value: v, label: key === "status" ? statusLabel(v) : v }))],
                }} />
              </label>
            );
          })}
        </div>
        {appliedFilters.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              for (const key of report.filters) next.delete(`f.${key}`);
              setParams(next, { replace: true });
            }}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:opacity-80"
          >
            <RotateCcw size={12} /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading report data…
        </div>
      ) : error || buildError ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <ErrorState message={error ?? buildError ?? ""} onRetry={() => void load()} />
        </div>
      ) : output ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
            {output.summary.map((card) => (
              <div key={card.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:break-inside-avoid print:rounded-md print:p-2">
                <p className="text-xs font-medium text-[var(--color-muted)]">{card.label}</p>
                <p className="mt-1 font-display text-lg font-semibold" style={{ color: card.tone && card.tone !== "default" ? TONE_COLOR[card.tone] : "var(--color-foreground)" }}>
                  {card.value}
                </p>
                {card.hint && <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{card.hint}</p>}
              </div>
            ))}
          </div>

          {output.notes.length > 0 && (
            <div className="flex gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-4 py-3 text-xs text-[var(--color-foreground)] print:bg-transparent">
              <Info size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <ul className="flex flex-col gap-1">
                {output.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {output.tables.map((table) => (
            <ReportTable
              key={`${report.id}-${table.id}`}
              table={table}
              visibleColumns={visibleColumns(table)}
              onExport={(rows) => exportTable(table, rows)}
              drillDown={(id) => onOpenReport(id, params.toString())}
            />
          ))}

          <p className="text-[11px] text-[var(--color-muted)]">
            Source: {report.sources}. Dates use the device calendar ({deviceTimeZone()}).
          </p>
        </>
      ) : null}
    </div>
  );
}
