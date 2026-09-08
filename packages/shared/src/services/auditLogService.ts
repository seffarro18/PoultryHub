import { supabase } from "./supabaseClient";
import type { AuditLogEntry, AuditSeverity, AuditStatus } from "../types/auditLog";

interface AuditLogRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  farm_id: string | null;
  farm_name: string | null;
  module: string;
  action: string;
  description: string | null;
  table_name: string | null;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  device: string | null;
  browser: string | null;
  operating_system: string | null;
  severity: AuditSeverity;
  status: AuditStatus;
  created_at: string;
}

const AUDIT_LOG_SELECT = `
  id, user_id, user_name, user_role, farm_id, farm_name, module, action, description,
  table_name, record_id, old_value, new_value, device, browser, operating_system,
  severity, status, created_at
`;

function mapAuditLogRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    farmId: row.farm_id,
    farmName: row.farm_name,
    module: row.module,
    action: row.action,
    description: row.description,
    tableName: row.table_name,
    recordId: row.record_id,
    oldValue: row.old_value,
    newValue: row.new_value,
    device: row.device,
    browser: row.browser,
    operatingSystem: row.operating_system,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** RLS scopes rows automatically per role — Super Admin sees all, Farm Admin/Manager their farm, Staff their own. Same function serves all three role pages. */
export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(AUDIT_LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as unknown as AuditLogRow[]).map(mapAuditLogRow);
}

/** Most recent "password_changed" event for the current user — real data already logged by logPasswordChanged(), reused for the Password & Security card's "Last changed" line. Null if it's never happened (or predates audit logging). */
export async function getLastPasswordChangeAt(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("audit_logs")
    .select("created_at")
    .eq("user_id", auth.user.id)
    .eq("action", "password_changed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

/** The current user's own recent activity, for the Profile page's "My Activity" card — distinct from listAuditLogs(), which returns everything RLS allows (all of a farm, or the whole system) and would need filtering down from up to 1000 rows for Super Admin/Farm Admin. */
export async function listMyRecentAuditLogs(limit = 5): Promise<AuditLogEntry[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("audit_logs")
    .select(AUDIT_LOG_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as AuditLogRow[]).map(mapAuditLogRow);
}

interface RpcLogParams {
  module: string;
  action: string;
  description?: string | null;
  severity?: AuditSeverity;
  status?: AuditStatus;
  device?: string | null;
  browser?: string | null;
  operatingSystem?: string | null;
}

async function logClientAuditEvent(params: RpcLogParams): Promise<void> {
  const { error } = await supabase.rpc("log_client_audit_event", {
    p_module: params.module,
    p_action: params.action,
    p_description: params.description ?? null,
    p_severity: params.severity ?? "info",
    p_status: params.status ?? "success",
    p_device: params.device ?? null,
    p_browser: params.browser ?? null,
    p_os: params.operatingSystem ?? null,
  });
  if (error) console.error("[auditLogService] logClientAuditEvent failed:", error);
}

/** Called once from AuthContext on a real SIGNED_IN event — never on token refresh. */
export async function logLoginEvent(device: string, browser: string, operatingSystem: string): Promise<void> {
  await logClientAuditEvent({ module: "Authentication", action: "login", description: "User signed in.", device, browser, operatingSystem });
}

/** Called from AuthContext's signOut(), before the session is cleared (the RPC needs auth.uid() to still resolve). */
export async function logLogoutEvent(): Promise<void> {
  await logClientAuditEvent({ module: "Authentication", action: "logout", description: "User signed out." });
}

export async function logPasswordChanged(): Promise<void> {
  await logClientAuditEvent({ module: "Authentication", action: "password_changed", description: "Password changed.", severity: "warning" });
}

export async function logReportExported(filename: string): Promise<void> {
  await logClientAuditEvent({ module: "Reports", action: "report_exported", description: `Exported ${filename}` });
}

// ── Analytics helpers ────────────────────────────────────────────────────

export interface PeriodPoint {
  label: string;
  value: number;
}

function dayBucketKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayBucketLabel(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function countByDay(logs: AuditLogEntry[], recentDays = 14): PeriodPoint[] {
  const buckets = new Map<string, number>();
  for (const log of logs) {
    const key = dayBucketKey(log.createdAt);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-recentDays)
    .map(([key, value]) => ({ label: dayBucketLabel(key), value }));
}

/** Total activity per day, all actions — "User Activity by Day". */
export function activityByDay(logs: AuditLogEntry[]): PeriodPoint[] {
  return countByDay(logs);
}

/** Successful logins per day — "Login Trends". */
export function loginTrends(logs: AuditLogEntry[]): PeriodPoint[] {
  return countByDay(logs.filter((l) => l.action === "login"));
}

/** Failed sign-in attempts per day — "Failed Login Attempts". */
export function failedLoginTrend(logs: AuditLogEntry[]): PeriodPoint[] {
  return countByDay(logs.filter((l) => l.action === "failed_login"));
}

export interface LabeledCount {
  label: string;
  value: number;
}

/** Activity count per module — "Most Active Modules". */
export function mostActiveModules(logs: AuditLogEntry[]): LabeledCount[] {
  const totals = new Map<string, number>();
  for (const log of logs) totals.set(log.module, (totals.get(log.module) ?? 0) + 1);
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Activity count per role — "Activity by User Role". */
export function activityByRole(logs: AuditLogEntry[]): LabeledCount[] {
  const totals = new Map<string, number>();
  for (const log of logs) {
    const role = log.userRole ?? "Unknown";
    totals.set(role, (totals.get(role) ?? 0) + 1);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Activity count per farm — "Activity by Farm". Only meaningful for Super Admin's cross-farm view. */
export function activityByFarm(logs: AuditLogEntry[]): LabeledCount[] {
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (!log.farmName) continue;
    totals.set(log.farmName, (totals.get(log.farmName) ?? 0) + 1);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** High/critical severity events per day — "Security Events Timeline". */
export function securityEventsTimeline(logs: AuditLogEntry[]): PeriodPoint[] {
  return countByDay(logs.filter((l) => l.severity === "high" || l.severity === "critical"));
}
