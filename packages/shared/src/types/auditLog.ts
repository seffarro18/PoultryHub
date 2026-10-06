export type AuditSeverity = "info" | "warning" | "high" | "critical";
export type AuditStatus = "success" | "failure";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  farmId: string | null;
  farmName: string | null;
  module: string;
  action: string;
  description: string | null;
  tableName: string | null;
  recordId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  device: string | null;
  browser: string | null;
  operatingSystem: string | null;
  severity: AuditSeverity;
  status: AuditStatus;
  createdAt: string;
}

/** Every module that actually generates audit logs today — no Dashboard (no loggable action) or Sales (module isn't built). */
export const AUDIT_MODULES = [
  "Authentication",
  "User Management",
  "Farm Management",
  "Egg Production",
  "Poultry Inventory",
  "Feeds & Vitamins",
  "Health Records",
  "Mortality Records",
  "Notifications",
  "Reports",
  "System Settings",
] as const;

export const SEVERITY_META: Record<AuditSeverity, { label: string; color: string }> = {
  info: { label: "Information", color: "var(--color-success)" },
  warning: { label: "Warning", color: "var(--color-warning)" },
  high: { label: "High", color: "var(--color-high)" },
  critical: { label: "Critical", color: "var(--color-danger)" },
};

export const STATUS_META: Record<AuditStatus, { label: string; color: string }> = {
  success: { label: "Success", color: "var(--color-success)" },
  failure: { label: "Failure", color: "var(--color-danger)" },
};

/** "user_deactivated" -> "User deactivated" */
export function formatAuditAction(action: string): string {
  const spaced = action.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
