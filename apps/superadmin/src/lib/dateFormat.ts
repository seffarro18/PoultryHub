import type { SystemSettings } from "@poultryhub/shared/types/systemSettings";

/**
 * Real, functional formatting utility driven by the configured
 * timezone/language/date_format — not yet retrofit onto the ~20+ existing
 * pages that already call .toLocaleDateString()/.toLocaleString() directly.
 * That's a separate, deliberate follow-up pass, not a side effect of adding
 * a settings page.
 */

function getZonedParts(value: Date | string, timezone: string): Record<string, string> {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
}

/** Formats a date per the configured timezone and date_format pattern (MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD). */
export function formatDate(value: Date | string, settings: Pick<SystemSettings, "timezone" | "dateFormat">): string {
  const { year, month, day } = getZonedParts(value, settings.timezone);
  switch (settings.dateFormat) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "MM/DD/YYYY":
    default:
      return `${month}/${day}/${year}`;
  }
}

/** Same date portion as formatDate, plus a time formatted per the configured language's convention (e.g. 12- vs 24-hour). */
export function formatDateTime(
  value: Date | string,
  settings: Pick<SystemSettings, "timezone" | "dateFormat" | "language">
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const timePart = new Intl.DateTimeFormat(settings.language, {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${formatDate(value, settings)}, ${timePart}`;
}
