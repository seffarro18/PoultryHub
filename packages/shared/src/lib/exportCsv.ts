import { logReportExported } from "../services/auditLogService";

const escapeCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Client-side CSV export — no dependency, just a Blob + a throwaway link click. */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return;

  // Fire-and-forget — centralizes "Report Exported" audit coverage for every
  // caller of this function in one place instead of touching each of them.
  void logReportExported(filename);

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(",")),
  ];
  saveCsv(filename, lines);
}

/**
 * Reports' export: metadata lines (report, farm, period, filters, generated
 * at) above the column headers, then every matching row — not just the
 * visible page. Exports even when there are no rows, so an empty period
 * still produces a file that says so.
 */
export function downloadReportCsv(
  filename: string,
  meta: [string, string][],
  headers: string[],
  rows: (string | number)[][]
): void {
  void logReportExported(filename);
  const lines = [
    ...meta.map(([key, value]) => `${escapeCell(key)},${escapeCell(value)}`),
    "",
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  if (rows.length === 0) lines.push("No matching records");
  saveCsv(filename, lines);
}

function saveCsv(filename: string, lines: string[]): void {
  // BOM so Excel opens ₱ and other non-ASCII text correctly.
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
