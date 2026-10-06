import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import { formatDateTime } from "../lib/dateFormat";
import { runSystemIntegrityCheck } from "../services/systemIntegrityService";
import type { IntegrityCheckResult } from "../types/systemIntegrity";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

const STATUS_META: Record<IntegrityCheckResult["status"], { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-[var(--color-success)]", label: "OK" },
  warning: { icon: AlertTriangle, className: "text-[var(--color-warning)]", label: "Warning" },
  critical: { icon: AlertCircle, className: "text-[var(--color-danger)]", label: "Critical" },
};

function ResultRow({ result }: { result: IntegrityCheckResult }) {
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] p-3">
      <Icon size={18} className={`mt-0.5 shrink-0 ${meta.className}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{result.checkName}</p>
          <span className={`text-xs font-semibold ${meta.className}`}>{meta.label}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">{result.detail}</p>
      </div>
    </div>
  );
}

/**
 * Read-only diagnostic — every check runs server-side via a single
 * security-definer RPC (run_system_integrity_check, migration 0039) that
 * reads across every farm, something RLS would otherwise block even for
 * Super Admin's own client queries. A failed run surfaces the real error,
 * never a silent "all clear" (see AGENTS.md's "never hide database errors").
 */
export default function SystemIntegrityPage() {
  const { settings } = useSystemSettings();
  const [results, setResults] = useState<IntegrityCheckResult[] | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const checkResults = await runSystemIntegrityCheck();
      setResults(checkResults);
      setLastRunAt(new Date().toISOString());
    } catch (err) {
      console.error("[SystemIntegrityPage] integrity check failed:", err);
      setRunError(getErrorMessage(err, "Couldn't run the integrity check. Please try again."));
    } finally {
      setIsRunning(false);
    }
  };

  const criticalCount = results?.filter((r) => r.status === "critical").length ?? 0;
  const warningCount = results?.filter((r) => r.status === "warning").length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">System Integrity Check</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Runs a fixed set of read-only checks directly against the live database — negative inventory, duplicate
          houses, orphaned records, and status invariants. Nothing here is modified; this only reports what it finds.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <ShieldCheck size={16} />
            {lastRunAt && settings
              ? `Last run ${formatDateTime(lastRunAt, settings)}`
              : lastRunAt
                ? `Last run ${new Date(lastRunAt).toLocaleString()}`
                : "Not run yet this session."}
          </div>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={isRunning}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {isRunning ? <Loader2 size={14} className="spinner" /> : <ShieldCheck size={14} />}
            {isRunning ? "Running…" : "Run Check"}
          </button>
        </div>

        {runError && (
          <p className="mt-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{runError}</p>
        )}

        {results && !runError && (
          <>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-[var(--color-muted-bg)] px-3 py-1 text-[var(--color-foreground)]">
                {results.length} checks run
              </span>
              {criticalCount > 0 && (
                <span className="rounded-full bg-[var(--color-danger)]/10 px-3 py-1 font-medium text-[var(--color-danger)]">
                  {criticalCount} critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-[var(--color-warning)]/10 px-3 py-1 font-medium text-[var(--color-warning)]">
                  {warningCount} warning{warningCount === 1 ? "" : "s"}
                </span>
              )}
              {criticalCount === 0 && warningCount === 0 && (
                <span className="rounded-full bg-[var(--color-success)]/10 px-3 py-1 font-medium text-[var(--color-success)]">
                  All checks passed
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {results.map((result) => (
                <ResultRow key={result.checkName} result={result} />
              ))}
            </div>
          </>
        )}

        {!results && !runError && !isRunning && (
          <p className="mt-4 text-sm text-[var(--color-muted)]">Run the check to see the current results.</p>
        )}
      </div>
    </div>
  );
}
