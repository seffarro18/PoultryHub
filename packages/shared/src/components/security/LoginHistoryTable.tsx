import { Loader2 } from "lucide-react";
import type { LoginHistoryEntry } from "../../types/security";

interface LoginHistoryTableProps {
  entries: LoginHistoryEntry[];
  isLoading: boolean;
  /** Shown in the Super Admin's system-wide view; hidden on a user's own "My Login History" (redundant there). */
  showUser?: boolean;
}

function StatusBadge({ status }: { status: LoginHistoryEntry["status"] }) {
  const success = status === "success";
  const color = success ? "var(--color-success)" : "var(--color-danger)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {success ? "Successful" : "Failed"}
    </span>
  );
}

export default function LoginHistoryTable({ entries, isLoading, showUser = false }: LoginHistoryTableProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--color-muted)]">No sign-ins recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                {showUser && <th className="px-4 py-3 font-medium">User</th>}
                <th className="px-4 py-3 font-medium">Date & Time</th>
                <th className="px-4 py-3 font-medium">Device / Browser</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--color-border)] last:border-0">
                  {showUser && (
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-foreground)]">{entry.userName ?? "—"}</p>
                      <p className="text-xs text-[var(--color-muted)]">{entry.userEmail ?? ""}</p>
                    </td>
                  )}
                  <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {entry.operatingSystem} / {entry.browser}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
