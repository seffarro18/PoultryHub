import { useEffect, useMemo, useState } from "react";
import { AlertCircle, History, Loader2, Search } from "lucide-react";
import { listAuditLogs } from "@poultryhub/shared/services/auditLogService";
import SeverityBadge from "@poultryhub/shared/components/audit/SeverityBadge";
import { formatAuditAction, type AuditLogEntry } from "@poultryhub/shared/types/auditLog";

export default function StaffActivityHistoryPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    listAuditLogs()
      .then((rows) => {
        if (!cancelled) setLogs(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load your activity history.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((l) => `${l.module} ${l.action} ${l.description ?? ""}`.toLowerCase().includes(term));
  }, [logs, search]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">My Activity</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Your own activity history — only you can see this.</p>
      </div>

      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search my activity…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <History size={20} className="text-[var(--color-muted)]" />
          <p className="text-sm text-[var(--color-muted)]">No activity recorded yet.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {filtered.map((l) => (
            <li key={l.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{formatAuditAction(l.action)}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">{l.module}</p>
                </div>
                <SeverityBadge severity={l.severity} />
              </div>
              {l.description && <p className="mt-2 text-xs text-[var(--color-muted)]">{l.description}</p>}
              <p className="mt-2 text-xs text-[var(--color-muted)]">{new Date(l.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
