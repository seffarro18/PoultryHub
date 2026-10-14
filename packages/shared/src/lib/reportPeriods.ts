/**
 * Date-range handling for the Reports module. Every record date in this
 * schema is a plain DATE (production_date, distribution_date, sale_date…),
 * compared here as YYYY-MM-DD strings in the device's local calendar.
 * Weeks start on Monday — the same definition summarizePeriods() and the
 * Egg Production week buckets already use.
 */

export type RangePreset = "today" | "yesterday" | "last7" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

export const RANGE_PRESET_LABEL: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 Days",
  thisWeek: "This Week",
  lastWeek: "Last Week",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  all: "All Time",
  custom: "Custom Range",
};

export interface DateRange {
  /** Inclusive, YYYY-MM-DD. "0000-01-01" for All Time. */
  from: string;
  /** Inclusive, YYYY-MM-DD. */
  to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const ALL_TIME_START = "0000-01-01";

/** YYYY-MM-DD in the device's local calendar (not UTC). */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const date = parseIsoDate(iso);
  const weekday = (date.getDay() + 6) % 7;
  return addDays(iso, -weekday);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  const date = parseIsoDate(monthStart(iso));
  return localIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function resolveRange(preset: RangePreset, custom: DateRange | null, today = localIsoDate()): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisWeek":
      return { from: weekStart(today), to: addDays(weekStart(today), 6) };
    case "lastWeek": {
      const start = addDays(weekStart(today), -7);
      return { from: start, to: addDays(start, 6) };
    }
    case "thisMonth":
      return { from: monthStart(today), to: monthEnd(today) };
    case "lastMonth": {
      const prev = addDays(monthStart(today), -1);
      return { from: monthStart(prev), to: monthEnd(prev) };
    }
    case "all":
      return { from: ALL_TIME_START, to: today };
    case "custom":
      return custom && custom.from && custom.to && custom.from <= custom.to ? custom : { from: today, to: today };
  }
}

/**
 * The comparison period: the previous calendar week/month for those
 * presets, otherwise the same number of days immediately before. Null for
 * All Time (nothing to compare against).
 */
export function previousRange(preset: RangePreset, range: DateRange): DateRange | null {
  if (preset === "all") return null;
  if (preset === "thisMonth" || preset === "lastMonth") {
    const prev = addDays(range.from, -1);
    return { from: monthStart(prev), to: monthEnd(prev) };
  }
  const days = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / DAY_MS);
}

export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= range.from && day <= range.to;
}

/** Every date in the range (capped — an All Time range isn't expanded day by day). */
export function eachDay(range: DateRange, cap = 366): string[] {
  if (range.from === ALL_TIME_START) return [];
  const days: string[] = [];
  for (let d = range.from; d <= range.to && days.length < cap; d = addDays(d, 1)) days.push(d);
  return days;
}

/** True when the range ends after today — i.e. the period isn't over yet. */
export function isIncomplete(range: DateRange, today = localIsoDate()): boolean {
  return range.to > today;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseIsoDate(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRange(range: DateRange): string {
  if (range.from === ALL_TIME_START) return `All time to ${formatDate(range.to)}`;
  if (range.from === range.to) return formatDate(range.from);
  return `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "device local time";
  }
}
