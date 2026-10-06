import { useEffect, useState } from "react";
import { AlertCircle, History, Loader2, RotateCcw } from "lucide-react";
import { listFeedVitaminHistory } from "@poultryhub/shared/services/auditLogService";
import { restoreFeedBatch, restoreVitaminBatch } from "@poultryhub/shared/services/feedVitaminService";
import { formatAuditAction, type AuditLogEntry } from "@poultryhub/shared/types/auditLog";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

interface InventoryHistoryPanelProps {
  /** Called after a successful Restore so the parent's active Feed/Vitamin lists refetch. */
  onRestored: () => void;
}

/**
 * Reuses the existing audit_logs system end to end instead of a separate
 * "inventory history" table — every row here is just a feeds/vitamins
 * insert/update that log_audit_event() already recorded, including the
 * full before/after snapshot in old_value/new_value. This panel only adds
 * presentation (a readable quantity diff, a date, who did it) and the one
 * action audit_logs itself can't take: Restore.
 */
export default function InventoryHistoryPanel({ onRestored }: InventoryHistoryPanelProps) {
  const toast = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = () => {
    setIsLoading(true);
    setLoadError(null);
    listFeedVitaminHistory()
      .then(setEntries)
      .catch((err: unknown) => {
        console.error("[InventoryHistoryPanel] failed to load history:", err);
        setLoadError(getErrorMessage(err, "Failed to load inventory history."));
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRestore = async (entry: AuditLogEntry) => {
    if (!entry.recordId || !entry.tableName) return;
    setRestoringId(entry.id);
    try {
      if (entry.tableName === "feeds") await restoreFeedBatch(entry.recordId);
      else await restoreVitaminBatch(entry.recordId);
      toast.success("Stock restored to active inventory.");
      refresh();
      onRestored();
    } catch (err) {
      console.error("[InventoryHistoryPanel] restore failed:", err);
      toast.error(getErrorMessage(err, "Couldn't restore this stock record."));
    } finally {
      setRestoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
        <History size={20} className="text-[var(--color-muted)]" />
        <p className="text-sm text-[var(--color-muted)]">No inventory history yet.</p>
      </div>
    );
  }

  // Entries arrive newest-first — the first entry seen per record_id is
  // therefore that record's CURRENT state. Restore should only ever show on
  // an archive event that's still the latest thing that happened to that
  // record (otherwise a record that was archived, restored, then archived
  // again would show a stale "Restore" on its older archive entry too).
  const latestEntryIdByRecord = new Map<string, string>();
  for (const entry of entries) {
    if (entry.recordId && !latestEntryIdByRecord.has(entry.recordId)) {
      latestEntryIdByRecord.set(entry.recordId, entry.id);
    }
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => {
        const name = (entry.newValue?.feed_name ?? entry.newValue?.vitamin_name ?? entry.oldValue?.feed_name ?? entry.oldValue?.vitamin_name) as
          | string
          | undefined;
        const oldQty = entry.oldValue?.quantity as number | undefined;
        const newQty = entry.newValue?.quantity as number | undefined;
        const quantityChanged = entry.action.endsWith("_updated") && oldQty !== undefined && newQty !== undefined && oldQty !== newQty;
        const isArchived = entry.action.endsWith("_archived");
        const canRestore = isArchived && entry.recordId !== null && latestEntryIdByRecord.get(entry.recordId) === entry.id;

        return (
          <li key={entry.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-foreground)]">{formatAuditAction(entry.action)}</p>
                {name && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{name}</p>}
              </div>
              <p className="text-xs text-[var(--color-muted)]">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>

            {quantityChanged && (
              <p className="mt-2 text-sm text-[var(--color-foreground)]">
                {oldQty?.toLocaleString()} → {newQty?.toLocaleString()} {String(entry.newValue?.unit ?? "")}
              </p>
            )}

            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {isArchived ? "Archived" : entry.action.endsWith("_restored") ? "Restored" : entry.action.endsWith("_added") ? "Added" : "Edited"} by{" "}
              {entry.userName ?? "Unknown"}
            </p>

            {canRestore && (
              <div className="mt-3 flex justify-end border-t border-[var(--color-border)] pt-3">
                <button
                  type="button"
                  onClick={() => void handleRestore(entry)}
                  disabled={restoringId === entry.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:opacity-75 disabled:opacity-50"
                >
                  {restoringId === entry.id ? <Loader2 size={13} className="spinner" /> : <RotateCcw size={13} />}
                  Restore
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
