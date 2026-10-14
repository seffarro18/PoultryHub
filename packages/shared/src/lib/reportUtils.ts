import { formatUnitLabel } from "../types/feedVitamin";
import type { CellValue, FilterOptions, FilterValues, ReportColumn, ReportContext, ReportRow, ReportTable } from "../types/report";

/** Display-only rounding — totals are always summed from the raw values first. */
export function fmtNumber(value: number, maxFractionDigits = 2): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

export function fmtPeso(value: number): string {
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtSigned(value: number): string {
  return value > 0 ? `+${fmtNumber(value)}` : fmtNumber(value);
}

/** "2 Sacks", "1 Bottle" — vitamin unit codes resolved via formatUnitLabel. */
export function fmtQty(value: number, unit: string): string {
  return `${fmtNumber(value)} ${formatUnitLabel(unit, value)}`;
}

/**
 * Period-over-period change. Null when there's no valid denominator (the
 * previous period had nothing) — a percentage is never invented from zero.
 */
export function pctChange(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs previous period`;
}

/** Short, stable, human-readable reference for a record without its own reference number. */
export function ref(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
  paid: "Paid",
  partial: "Partial",
  success: "Success",
  failure: "Failure",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABEL[status] ?? status;
}

/** A filter with no selection matches everything. */
export function matches(filters: FilterValues, key: keyof FilterValues, actual: string | null | undefined): boolean {
  const wanted = filters[key];
  if (!wanted) return true;
  return (actual ?? "") === wanted;
}

export function distinct(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) => a.localeCompare(b));
}

export function mergeOptions(...parts: FilterOptions[]): FilterOptions {
  return Object.assign({}, ...parts);
}

/** Adds the Farm column for Super Admin's all-farms view. */
export function withFarmColumn(ctx: ReportContext, columns: ReportColumn[]): ReportColumn[] {
  return ctx.multiFarm ? [{ key: "farm", label: "Farm" }, ...columns] : columns;
}

export function sumBy<T>(rows: T[], value: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + value(row), 0);
}

/** Group + sum, insertion-ordered; callers sort as needed. */
export function groupSum<T>(rows: T[], key: (row: T) => string, value: (row: T) => number): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + value(row));
  return map;
}

/** A small two-column-or-more breakdown table from grouped values. */
export function breakdownTable(
  id: string,
  title: string,
  label: string,
  groups: Map<string, ReportRow>,
  columns: ReportColumn[],
  options: { description?: string; sortKey?: string; sortDir?: "asc" | "desc"; totals?: ReportRow } = {}
): ReportTable {
  const rows = [...groups.entries()].map(([name, values]) => ({ name, ...values }));
  return {
    id,
    title,
    description: options.description,
    columns: [{ key: "name", label }, ...columns],
    rows,
    totals: options.totals,
    sort: { key: options.sortKey ?? "name", dir: options.sortDir ?? "asc" },
    compact: true,
  };
}

export function addInto(target: ReportRow, values: Record<string, number>): void {
  for (const [key, value] of Object.entries(values)) {
    const current = target[key];
    target[key] = (typeof current === "number" ? current : 0) + value;
  }
}

export function cellText(value: CellValue): string {
  return value === null || value === undefined ? "" : String(value);
}
