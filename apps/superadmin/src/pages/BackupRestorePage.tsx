import { useEffect, useState } from "react";
import { Download, History, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import ConfirmDialog from "@poultryhub/shared/components/layout/ConfirmDialog";
import { formatDateTime } from "../lib/dateFormat";
import {
  createBackup,
  deleteBackup,
  downloadBackupJson,
  getScheduleSettings,
  listBackups,
  restoreBackup,
  updateScheduleSettings,
} from "../services/backupService";
import { BACKUP_TABLE_LABELS, type Backup, type BackupFrequency, type BackupScheduleSettings } from "../types/backup";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: Backup["type"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        type === "manual" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "bg-[var(--color-muted-bg)] text-[var(--color-muted)]"
      }`}
    >
      {type === "manual" ? "Manual" : "Scheduled"}
    </span>
  );
}

function StatusBadge({ status }: { status: Backup["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "completed" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
      }`}
    >
      {status === "completed" ? "Completed" : "Failed"}
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tableSummary(counts: Record<string, number>): string {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return `${total.toLocaleString()} rows across ${Object.keys(counts).length} tables`;
}

export default function BackupRestorePage() {
  const { settings } = useSystemSettings();
  const formatWhen = (value: string) => (settings ? formatDateTime(value, settings) : new Date(value).toLocaleString());

  const [backups, setBackups] = useState<Backup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);

  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<BackupScheduleSettings | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Backup | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refreshBackups = async () => {
    setLoadingBackups(true);
    try {
      setBackups(await listBackups());
    } catch (err) {
      console.error("[BackupRestorePage] failed to load backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    void refreshBackups();
    getScheduleSettings()
      .then(setSchedule)
      .catch((err) => console.error("[BackupRestorePage] failed to load schedule settings:", err));
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await createBackup(label.trim() || undefined);
      setLabel("");
      await refreshBackups();
    } catch (err) {
      console.error("[BackupRestorePage] backup creation failed:", err);
      setCreateError(err instanceof Error ? err.message : "Couldn't create a backup. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;
    setSavingSchedule(true);
    setScheduleError(null);
    setScheduleSaved(false);
    try {
      await updateScheduleSettings(schedule);
      setScheduleSaved(true);
    } catch (err) {
      console.error("[BackupRestorePage] failed to save schedule settings:", err);
      setScheduleError("Couldn't save these settings. Please try again.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDownload = async (backup: Backup) => {
    setDownloadingId(backup.id);
    setRowActionError(null);
    try {
      await downloadBackupJson(backup);
    } catch (err) {
      console.error("[BackupRestorePage] download failed:", err);
      setRowActionError("Couldn't download that backup. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    const restoredFrom = pendingRestore;
    setRestoring(true);
    setRowActionError(null);
    try {
      const result = await restoreBackup(restoredFrom.id);
      const summary = Object.entries(result)
        .map(([table, count]) => `${BACKUP_TABLE_LABELS[table] ?? table} (${count})`)
        .join(", ");
      setRestoreSuccess(`Restored from the backup taken ${formatWhen(restoredFrom.createdAt)}: ${summary}.`);
    } catch (err) {
      console.error("[BackupRestorePage] restore failed:", err);
      setRowActionError(err instanceof Error ? err.message : "Restore failed. Please try again.");
    } finally {
      setRestoring(false);
      setPendingRestore(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteBackup(pendingDelete.id);
      await refreshBackups();
    } catch (err) {
      console.error("[BackupRestorePage] delete failed:", err);
      setRowActionError("Couldn't delete that backup. Please try again.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Backup & Restore</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Snapshots of farm operational data — farms, production, inventory, feeds & vitamins, health & mortality, sales &
          expenses. User accounts, roles, and system settings are never included.
        </p>
      </div>

      {rowActionError && (
        <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{rowActionError}</p>
      )}
      {restoreSuccess && (
        <p className="flex items-start gap-2 rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-primary)]">
          <span className="flex-1">{restoreSuccess}</span>
          <button type="button" onClick={() => setRestoreSuccess(null)} className="shrink-0 opacity-70 hover:opacity-100">
            ✕
          </button>
        </p>
      )}

      <Section title="Manual Backup" description="Capture a snapshot of every farm's current data right now.">
        {createError && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{createError}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Before Q3 migration"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreateBackup()}
            disabled={creating}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {creating ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
            Back Up Now
          </button>
        </div>
      </Section>

      {schedule && (
        <Section
          title="Scheduled Backup"
          description="Runs automatically, unattended — daily, weekly, or monthly, keeping the most recent backups per your retention setting below. Runs on the database server's own clock, not your local time, and a paused free-tier project won't run scheduled backups while paused."
        >
          {scheduleError && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{scheduleError}</p>
          )}
          {scheduleSaved && (
            <p className="rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-primary)]">Schedule saved.</p>
          )}
          <form onSubmit={(e) => void handleSaveSchedule(e)} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) => setSchedule((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))}
                className="rounded accent-[var(--color-primary)]"
              />
              Enable scheduled backups
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Frequency</label>
                <select
                  value={schedule.frequency}
                  onChange={(e) => setSchedule((prev) => (prev ? { ...prev, frequency: e.target.value as BackupFrequency } : prev))}
                  className={inputClass}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Keep the most recent</label>
                <input
                  type="number"
                  min={1}
                  value={schedule.retentionCount}
                  onChange={(e) =>
                    setSchedule((prev) => (prev ? { ...prev, retentionCount: Math.max(1, Number(e.target.value)) } : prev))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingSchedule}
              className="flex w-fit items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {savingSchedule ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
              Save Schedule
            </button>
          </form>
        </Section>
      )}

      <Section title="Backup History" description="Every backup, manual or scheduled — download, restore, or delete.">
        {loadingBackups ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading backups…
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[var(--color-muted)]">
            <History size={22} className="text-[var(--color-muted)]" />
            No backups yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Contents</th>
                  <th className="pb-2 pr-3">Size</th>
                  <th className="pb-2 pr-3">Created By</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 pr-3 text-[var(--color-foreground)]">
                      {formatWhen(backup.createdAt)}
                      {backup.label && <p className="text-xs text-[var(--color-muted)]">{backup.label}</p>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <TypeBadge type={backup.type} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={backup.status} />
                      {backup.status === "failed" && backup.errorMessage && (
                        <p className="mt-1 max-w-[220px] text-xs text-[var(--color-danger)]">{backup.errorMessage}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--color-muted)]">
                      {backup.status === "completed" ? tableSummary(backup.tableCounts) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--color-muted)]">
                      {backup.status === "completed" ? formatSize(backup.sizeBytes) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--color-muted)]">
                      {backup.createdByName ?? (backup.type === "scheduled" ? "Scheduled job" : "—")}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {backup.status === "completed" && (
                          <>
                            <button
                              type="button"
                              title="Download"
                              onClick={() => void handleDownload(backup)}
                              disabled={downloadingId === backup.id}
                              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)] disabled:opacity-50"
                            >
                              {downloadingId === backup.id ? <Loader2 size={15} className="spinner" /> : <Download size={15} />}
                            </button>
                            <button
                              type="button"
                              title="Restore"
                              onClick={() => setPendingRestore(backup)}
                              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                            >
                              <RotateCcw size={15} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setPendingDelete(backup)}
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {pendingRestore && (
        <ConfirmDialog
          title="Restore this backup?"
          message={`This restores data from the backup taken ${formatWhen(pendingRestore.createdAt)} (${tableSummary(
            pendingRestore.tableCounts
          )}). Matching records get updated by ID; nothing is deleted — but this can also bring back records that were legitimately deleted since this backup was taken.`}
          confirmLabel={restoring ? "Restoring…" : "Restore"}
          onConfirm={() => void handleConfirmRestore()}
          onCancel={() => setPendingRestore(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this backup?"
          message="This permanently deletes the backup itself — it has no effect on your live data. This can't be undone."
          confirmLabel="Delete"
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
