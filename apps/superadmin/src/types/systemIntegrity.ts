export type IntegrityCheckStatus = "ok" | "warning" | "critical";

export interface IntegrityCheckResult {
  checkName: string;
  status: IntegrityCheckStatus;
  detail: string;
  affectedCount: number;
}
