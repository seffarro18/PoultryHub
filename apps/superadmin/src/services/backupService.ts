import { supabase } from "@poultryhub/shared/services/supabaseClient";
import type {
  Backup,
  BackupFrequency,
  BackupScheduleInput,
  BackupScheduleSettings,
  BackupTables,
  BackupType,
  RestoreResult,
} from "../types/backup";

interface BackupRow {
  id: string;
  type: BackupType;
  status: "completed" | "failed";
  label: string | null;
  table_counts: Record<string, number> | null;
  size_bytes: number;
  created_by: string | null;
  created_by_name: string | null;
  error_message: string | null;
  created_at: string;
}

const BACKUP_LIST_COLUMNS = "id, type, status, label, table_counts, size_bytes, created_by, created_by_name, error_message, created_at";

function mapBackupRow(row: BackupRow): Backup {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    label: row.label,
    tableCounts: row.table_counts ?? {},
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function listBackups(): Promise<Backup[]> {
  const { data, error } = await supabase
    .from("backups")
    .select(BACKUP_LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as BackupRow[]).map(mapBackupRow);
}

/** Fetches just one backup's full snapshot payload, on demand — not included in listBackups(), it can be large. */
export async function getBackupTables(id: string): Promise<BackupTables> {
  const { data, error } = await supabase.from("backups").select("tables").eq("id", id).single();
  if (error) throw error;
  return (data.tables ?? {}) as BackupTables;
}

export async function createBackup(label?: string): Promise<Backup> {
  const { data, error } = await supabase.rpc("create_backup", { p_type: "manual", p_label: label ?? null });
  if (error) throw error;
  return mapBackupRow(data as BackupRow);
}

/** Safe merge/upsert — never deletes anything. Returns rows-restored counts per table for a confirmation summary. */
export async function restoreBackup(id: string): Promise<RestoreResult> {
  const { data, error } = await supabase.rpc("restore_backup", { p_backup_id: id });
  if (error) throw error;
  return (data ?? {}) as RestoreResult;
}

export async function deleteBackup(id: string): Promise<void> {
  const { error } = await supabase.from("backups").delete().eq("id", id);
  if (error) throw error;
}

/** Client-side JSON download — same Blob + throwaway-link mechanic as exportCsv.ts's downloadCsv. */
export async function downloadBackupJson(backup: Backup): Promise<void> {
  const tables = await getBackupTables(backup.id);
  const payload = { backupId: backup.id, type: backup.type, createdAt: backup.createdAt, tables };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `poultryhub-backup-${backup.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  const { error } = await supabase.rpc("log_client_audit_event", {
    p_module: "System Settings",
    p_action: "backup_downloaded",
    p_description: `Downloaded backup created ${backup.createdAt.slice(0, 10)}`,
    p_severity: "info",
    p_status: "success",
  });
  if (error) console.error("[backupService] failed to log backup download:", error);
}

interface BackupScheduleRow {
  enabled: boolean;
  frequency: BackupFrequency;
  retention_count: number;
  updated_at: string;
}

export async function getScheduleSettings(): Promise<BackupScheduleSettings> {
  const { data, error } = await supabase
    .from("backup_schedule_settings")
    .select("enabled, frequency, retention_count, updated_at")
    .eq("id", true)
    .single();
  if (error) throw error;
  const row = data as BackupScheduleRow;
  return { enabled: row.enabled, frequency: row.frequency, retentionCount: row.retention_count, updatedAt: row.updated_at };
}

export async function updateScheduleSettings(input: BackupScheduleInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("backup_schedule_settings")
    .update({
      enabled: input.enabled,
      frequency: input.frequency,
      retention_count: input.retentionCount,
      updated_by: auth.user?.id ?? null,
    })
    .eq("id", true);
  if (error) throw error;
}
