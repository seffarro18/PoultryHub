import type { KpiCardData } from "../types/dashboard";

type TrendFields = Pick<KpiCardData, "sparkline" | "deltaPercent" | "isPositive">;

/**
 * Real sparkline + delta from an already-bucketed real series (first point vs.
 * last point in the window) — no fabricated numbers. Callers with fewer than 2
 * points (not enough real history yet) get `{}`, which KpiCard renders as a
 * plain value with no trend area, rather than a fake flat line.
 */
export function computeTrend(values: number[], goodDirection: "up" | "down" = "up"): TrendFields | Record<string, never> {
  if (values.length < 2) return {};
  const first = values[0];
  const last = values[values.length - 1];
  const deltaPercent = first === 0 ? 0 : Math.round(((last - first) / first) * 1000) / 10;
  const isPositive = goodDirection === "up" ? deltaPercent >= 0 : deltaPercent <= 0;
  return { sparkline: values, deltaPercent, isPositive };
}

/** Buckets an array of ISO date/timestamp strings into a day-by-day count over the trailing `days` window. */
export function countByDay(timestamps: string[], days = 10, today = new Date()): { label: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const result: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    result.push({ label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: buckets.get(key) ?? 0 });
  }
  return result;
}
