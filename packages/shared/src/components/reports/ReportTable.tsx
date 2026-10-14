import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import type { CellValue, ReportColumn, ReportRow, ReportTable as ReportTableData } from "../../types/report";
import { formatDate, formatDateTime } from "../../lib/reportPeriods";
import { fmtNumber, fmtPeso, fmtSigned } from "../../lib/reportUtils";

const PAGE_SIZE = 25;

const STATUS_COLOR: Record<string, string> = {
  Approved: "var(--color-success)",
  Completed: "var(--color-success)",
  Paid: "var(--color-success)",
  Success: "var(--color-success)",
  Pending: "var(--color-warning)",
  "In Progress": "var(--color-warning)",
  Partial: "var(--color-warning)",
  Rejected: "var(--color-danger)",
  Blocked: "var(--color-danger)",
  Failure: "var(--color-danger)",
};

export function formatCell(value: CellValue, column: ReportColumn): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (column.format === "currency") return fmtPeso(value);
    if (column.format === "signed") return fmtSigned(value);
    return `${fmtNumber(value)}${column.suffix ? ` ${column.suffix}` : ""}`;
  }
  if (column.format === "date") return formatDate(value);
  if (column.format === "datetime") return formatDateTime(value);
  return value;
}

function compare(a: CellValue, b: CellValue): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1;
  if (b === null || b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

interface ReportTableProps {
  table: ReportTableData;
  visibleColumns: ReportColumn[];
  onExport: (rows: ReportRow[]) => void;
  drillDown?: (reportId: string) => void;
}

export default function ReportTable({ table, visibleColumns, onExport, drillDown }: ReportTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(table.sort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = table.rows;
    if (term) {
      rows = rows.filter((row) => visibleColumns.some((c) => formatCell(row[c.key], c).toLowerCase().includes(term)));
    }
    if (sort) {
      rows = [...rows].sort((a, b) => {
        const result = compare(a[sort.key], b[sort.key]);
        return sort.dir === "asc" ? result : -result;
      });
    }
    return rows;
  }, [table.rows, search, sort, visibleColumns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const paginate = !table.compact && filtered.length > PAGE_SIZE;

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <section className="report-table rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] print:break-inside-auto print:rounded-none print:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 print:px-0">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{table.title}</h3>
          {table.description && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{table.description}</p>}
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "row" : "rows"}
            {search ? ` matching “${search}”` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {!table.compact && (
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search…"
                aria-label={`Search ${table.title}`}
                className="w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>
          )}
          {table.drillDown?.map((d) => (
            <button
              key={d.reportId}
              type="button"
              onClick={() => drillDown?.(d.reportId)}
              className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted-bg)]"
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onExport(filtered)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--color-muted)]">
          {table.rows.length === 0 ? "No records for the selected period and filters." : "No rows match this search."}
        </p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-xs">
            <thead className="print:table-header-group">
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                {visibleColumns.map((c) => {
                  const numeric = c.format === "number" || c.format === "currency" || c.format === "signed";
                  return (
                    <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-medium ${numeric ? "text-right" : ""}`}>
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-[var(--color-foreground)] print:pointer-events-none">
                        {c.label}
                        {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => {
                const onPage = !paginate || Math.floor(index / PAGE_SIZE) === currentPage;
                return (
                  <tr
                    key={index}
                    // Off-page rows stay in the DOM, hidden on screen only —
                    // Print / Save as PDF always prints every matching row.
                    className={`border-b border-[var(--color-border)] last:border-0 ${onPage ? "" : "hidden print:table-row"}`}
                  >
                    {visibleColumns.map((c) => {
                      const text = formatCell(row[c.key], c);
                      const numeric = c.format === "number" || c.format === "currency" || c.format === "signed";
                      if (c.format === "status" && text !== "—") {
                        const color = STATUS_COLOR[text] ?? "var(--color-muted)";
                        return (
                          <td key={c.key} className="whitespace-nowrap px-3 py-2">
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                              {text}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-2 align-top ${numeric ? "whitespace-nowrap text-right tabular-nums" : "max-w-[260px]"} text-[var(--color-foreground)]`}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {table.totals && (
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] font-semibold text-[var(--color-foreground)]">
                  {visibleColumns.map((c, i) => {
                    const value = table.totals?.[c.key];
                    const numeric = c.format === "number" || c.format === "currency" || c.format === "signed";
                    return (
                      <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${numeric ? "text-right tabular-nums" : ""}`}>
                        {i === 0 ? "Total" : value === undefined ? "" : formatCell(value, c)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {paginate && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)] print:hidden">
          <span>
            Rows {(currentPage * PAGE_SIZE + 1).toLocaleString()}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of{" "}
            {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
              className="rounded-md p-1 hover:bg-[var(--color-muted-bg)] disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
              className="rounded-md p-1 hover:bg-[var(--color-muted-bg)] disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
