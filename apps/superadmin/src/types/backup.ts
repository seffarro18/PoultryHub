export type BackupType = "manual" | "scheduled";
export type BackupStatus = "completed" | "failed";
export type BackupFrequency = "daily" | "weekly" | "monthly";

/** Metadata only — the `tables` jsonb snapshot itself is fetched separately (see getBackupTables), it's too large for the History list. */
export interface Backup {
  id: string;
  type: BackupType;
  status: BackupStatus;
  label: string | null;
  tableCounts: Record<string, number>;
  sizeBytes: number;
  createdBy: string | null;
  createdByName: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/** The full snapshot payload for one backup — one key per included table. */
export type BackupTables = Record<string, Record<string, unknown>[]>;

export interface BackupScheduleSettings {
  enabled: boolean;
  frequency: BackupFrequency;
  retentionCount: number;
  updatedAt: string;
}

export interface BackupScheduleInput {
  enabled: boolean;
  frequency: BackupFrequency;
  retentionCount: number;
}

/** Row counts restored per table, returned by restore_backup() for a confirmation summary. */
export type RestoreResult = Record<string, number>;

export const BACKUP_TABLE_LABELS: Record<string, string> = {
  farms: "Farms",
  feeds: "Feeds",
  vitamins: "Vitamins",
  egg_production: "Egg Production",
  poultry_inventory_events: "Poultry Inventory",
  feed_distribution: "Feed Distribution",
  vitamin_administration: "Vitamin Administration",
  health_records: "Health Records",
  mortality_records: "Mortality Records",
  sales: "Sales",
  expenses: "Expenses",
};
