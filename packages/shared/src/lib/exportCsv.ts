import { logReportExported } from "../services/auditLogService";

/** Client-side CSV export — no dependency, just a Blob + a throwaway link click. */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return;

  // Fire-and-forget — centralizes "Report Exported" audit coverage for every
  // caller of this function in one place instead of touching each of them.
  void logReportExported(filename);

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
