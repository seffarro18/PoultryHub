import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Download, ListChecks, Loader2, LogIn, Monitor, Printer, ShieldAlert, Search, Users } from "lucide-react";
import { listAuditLogs, mostActiveModules } from "@poultryhub/shared/services/auditLogService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import AuditLogAnalytics from "../components/audit/AuditLogAnalytics";
import SeverityBadge from "@poultryhub/shared/components/audit/SeverityBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import { AUDIT_MODULES, formatAuditAction, type AuditLogEntry, type AuditSeverity, type AuditStatus } from "@poultryhub/shared/types/auditLog";

const ALL = "all";
const todayIso = () => new Date().toISOString().slice(0, 10);
const isToday = (iso: string, today: string) => iso.slice(0, 10) === today;

const selectClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-xs text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

export default function AuditLogsOversightPage() {
  const breakpoint = useBreakpoint();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [farmFilter, setFarmFilter] = useState(ALL);
  const [moduleFilter, setModuleFilter] = useState(ALL);
  const [actionFilter, setActionFilter] = useState(ALL);
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<AuditStatus | typeof ALL>(ALL);

  useEffect(() => {
    let cancelled = false;
    listAuditLogs()
      .then((rows) => {
        if (!cancelled) setLogs(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load audit logs.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayIso();
  const todayLogs = useMemo(() => logs.filter((l) => isToday(l.createdAt, today)), [logs, today]);
  const failedLoginsToday = useMemo(() => todayLogs.filter((l) => l.action === "failed_login").length, [todayLogs]);
  const successfulLoginsToday = useMemo(() => todayLogs.filter((l) => l.action === "login").length, [todayLogs]);
  const activeUsersToday = useMemo(() => new Set(todayLogs.filter((l) => l.userId).map((l) => l.userId)).size, [todayLogs]);
  const criticalToday = useMemo(() => todayLogs.filter((l) => l.severity === "critical").length, [todayLogs]);

  const roles = useMemo(() => [...new Set(logs.map((l) => l.userRole).filter((r): r is string => Boolean(r)))].sort(), [logs]);
  const farms = useMemo(() => [...new Set(logs.map((l) => l.farmName).filter((f): f is string => Boolean(f)))].sort(), [logs]);
  const actions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (term) {
        const haystack = `${l.userName ?? ""} ${l.farmName ?? ""} ${l.module} ${l.action} ${l.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (dateFrom && l.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && l.createdAt.slice(0, 10) > dateTo) return false;
      if (roleFilter !== ALL && l.userRole !== roleFilter) return false;
      if (farmFilter !== ALL && l.farmName !== farmFilter) return false;
      if (moduleFilter !== ALL && l.module !== moduleFilter) return false;
      if (actionFilter !== ALL && l.action !== actionFilter) return false;
      if (severityFilter !== ALL && l.severity !== severityFilter) return false;
      if (statusFilter !== ALL && l.status !== statusFilter) return false;
      return true;
    });
  }, [logs, search, dateFrom, dateTo, roleFilter, farmFilter, moduleFilter, actionFilter, severityFilter, statusFilter]);

  const securityAlerts = useMemo(() => logs.filter((l) => l.severity === "critical" || l.severity === "high").slice(0, 8), [logs]);

  const csvRow = (l: AuditLogEntry) => ({
    "Log ID": l.id,
    "Date & Time": new Date(l.createdAt).toLocaleString(),
    "User Name": l.userName ?? "",
    "User Role": l.userRole ?? "",
    "Farm Name": l.farmName ?? "",
    Module: l.module,
    Action: formatAuditAction(l.action),
    Description: l.description ?? "",
    "IP Address": "—",
    Device: l.device ?? "",
    Browser: l.browser ?? "",
    Status: l.status,
    Severity: l.severity,
  });

  const handleExportUserActivity = () => downloadCsv(`user-activity-report-${today}.csv`, logs.map(csvRow));
  const handleExportSecurity = () => downloadCsv(`security-report-${today}.csv`, logs.filter((l) => l.severity === "high" || l.severity === "critical").map(csvRow));
  const handleExportLoginHistory = () => downloadCsv(`login-history-${today}.csv`, logs.filter((l) => l.module === "Authentication").map(csvRow));
  const handleExportFarmActivity = () => downloadCsv(`farm-activity-report-${today}.csv`, logs.filter((l) => l.farmName).map(csvRow));
  const handleExportModuleUsage = () =>
    downloadCsv(`module-usage-report-${today}.csv`, mostActiveModules(logs).map((m) => ({ Module: m.label, "Activity Count": m.value })));
  const handleExportFailedLogins = () =>
    downloadCsv(`failed-login-report-${today}.csv`, logs.filter((l) => l.action === "failed_login" || l.action === "multiple_failed_logins").map(csvRow));
  const handleExportDaily = () => downloadCsv(`daily-audit-report-${today}.csv`, todayLogs.map(csvRow));
  const handleExportMonthly = () => {
    const monthPrefix = today.slice(0, 7);
    downloadCsv(`monthly-audit-report-${monthPrefix}.csv`, logs.filter((l) => l.createdAt.slice(0, 7) === monthPrefix).map(csvRow));
  };

  if (breakpoint !== "desktop") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Monitor size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Best viewed on a larger screen</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">Audit Logs supervision is designed for desktop. Please switch to a larger screen.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading audit logs…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Audit Logs</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Complete, immutable activity trail across every farm and user — read-only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={ListChecks} label="Total Audit Logs" value={logs.length} />
        <StatTile icon={ListChecks} label="Today's Activities" value={todayLogs.length} />
        <StatTile icon={ShieldAlert} label="Failed Login Attempts" value={failedLoginsToday} />
        <StatTile icon={LogIn} label="Successful Logins" value={successfulLoginsToday} />
        <StatTile icon={Users} label="Active Users Today" value={activeUsersToday} />
        <StatTile icon={AlertTriangle} label="Critical Security Events" value={criticalToday} />
      </div>

      {securityAlerts.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
          <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Security Alerts</h2>
          <div className="mt-3 flex flex-col divide-y divide-[var(--color-border)]">
            {securityAlerts.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className={l.severity === "critical" ? "text-[var(--color-danger)]" : "text-[var(--color-high)]"} />
                  <span className="text-[var(--color-foreground)]">{l.description ?? formatAuditAction(l.action)}</span>
                </div>
                <span className="text-xs text-[var(--color-muted)]">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Audit Log</h2>
          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, farm, module, action…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectClass} aria-label="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectClass} aria-label="To date" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={farmFilter} onChange={(e) => setFarmFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Farms</option>
            {farms.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Modules</option>
            {AUDIT_MODULES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{formatAuditAction(a)}</option>
            ))}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as AuditSeverity | typeof ALL)} className={selectClass}>
            <option value={ALL}>All Severities</option>
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AuditStatus | typeof ALL)} className={selectClass}>
            <option value={ALL}>All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No audit logs match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date & Time</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Farm</th>
                    <th className="px-4 py-3 font-medium">Module</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">IP Address</th>
                    <th className="px-4 py-3 font-medium">Device</th>
                    <th className="px-4 py-3 font-medium">Browser</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((l) => (
                    <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{l.userName ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{l.userRole ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{l.farmName ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{l.module}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{formatAuditAction(l.action)}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-[var(--color-muted)]">{l.description ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">—</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{l.device ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{l.browser ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{l.status === "success" ? "Success" : "Failure"}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={l.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 300 && (
                <p className="px-4 py-3 text-center text-xs text-[var(--color-muted)]">
                  Showing the 300 most recent of {filtered.length} matching logs — narrow the filters to see more precisely.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="print:hidden">
        <AuditLogAnalytics logs={logs} />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportUserActivity} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> User Activity Report
          </button>
          <button type="button" onClick={handleExportSecurity} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Security Report
          </button>
          <button type="button" onClick={handleExportLoginHistory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Login History
          </button>
          <button type="button" onClick={handleExportFarmActivity} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Farm Activity Report
          </button>
          <button type="button" onClick={handleExportModuleUsage} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Module Usage Report
          </button>
          <button type="button" onClick={handleExportFailedLogins} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Failed Login Report
          </button>
          <button type="button" onClick={handleExportDaily} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Daily Audit Report
          </button>
          <button type="button" onClick={handleExportMonthly} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Monthly Audit Report
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
