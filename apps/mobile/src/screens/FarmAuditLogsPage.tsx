import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bird, Boxes, Download, ListChecks, Loader2, LogIn, Printer, Search } from "lucide-react";
import { listAuditLogs } from "@poultryhub/shared/services/auditLogService";
import { countPendingApprovals } from "@poultryhub/shared/services/farmDashboardService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import SeverityBadge from "@poultryhub/shared/components/audit/SeverityBadge";
import PageBackButton from "../components/PageBackButton";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { formatAuditAction, type AuditLogEntry } from "@poultryhub/shared/types/auditLog";

const ALL = "all";
const todayIso = () => new Date().toISOString().slice(0, 10);
const isToday = (iso: string, today: string) => iso.slice(0, 10) === today;

const selectClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-xs text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

export default function FarmAuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState(ALL);
  const [moduleFilter, setModuleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  useEffect(() => {
    if (!user?.farmId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([listAuditLogs(), countPendingApprovals()])
      .then(([rows, pending]) => {
        if (cancelled) return;
        setLogs(rows);
        setPendingApprovals(pending);
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
  }, [user?.farmId]);

  const today = todayIso();
  const todayLogs = useMemo(() => logs.filter((l) => isToday(l.createdAt, today)), [logs, today]);
  const staffLoginsToday = useMemo(() => todayLogs.filter((l) => l.action === "login" && l.userRole === "Staff").length, [todayLogs]);
  const inventoryUpdatesToday = useMemo(
    () => todayLogs.filter((l) => l.module === "Poultry Inventory" || l.module === "Feeds & Vitamins").length,
    [todayLogs]
  );
  const productionRecordsToday = useMemo(
    () => todayLogs.filter((l) => l.module === "Egg Production" || l.module === "Health Records" || l.module === "Mortality Records").length,
    [todayLogs]
  );

  const staffNames = useMemo(() => [...new Set(logs.map((l) => l.userName).filter((n): n is string => Boolean(n)))].sort(), [logs]);
  const modules = useMemo(() => [...new Set(logs.map((l) => l.module))].sort(), [logs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (term) {
        const haystack = `${l.userName ?? ""} ${l.module} ${l.action} ${l.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (dateFilter && l.createdAt.slice(0, 10) !== dateFilter) return false;
      if (staffFilter !== ALL && l.userName !== staffFilter) return false;
      if (moduleFilter !== ALL && l.module !== moduleFilter) return false;
      if (statusFilter !== ALL && l.status !== statusFilter) return false;
      return true;
    });
  }, [logs, search, dateFilter, staffFilter, moduleFilter, statusFilter]);

  const csvRow = (l: AuditLogEntry) => ({
    "Date & Time": new Date(l.createdAt).toLocaleString(),
    "Staff Name": l.userName ?? "",
    Module: l.module,
    Action: formatAuditAction(l.action),
    Description: l.description ?? "",
    Status: l.status,
  });

  const handleExportStaffActivity = () => downloadCsv(`staff-activity-report-${today}.csv`, logs.map(csvRow));
  const handleExportDaily = () => downloadCsv(`daily-activity-report-${today}.csv`, todayLogs.map(csvRow));
  const handleExportWeekly = () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    downloadCsv(`weekly-activity-report-${today}.csv`, logs.filter((l) => l.createdAt >= cutoff).map(csvRow));
  };
  const handleExportMonthly = () => {
    const monthPrefix = today.slice(0, 7);
    downloadCsv(`monthly-activity-report-${monthPrefix}.csv`, logs.filter((l) => l.createdAt.slice(0, 7) === monthPrefix).map(csvRow));
  };

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <p className="text-sm text-[var(--color-muted)]">Ask your Super Admin to assign your account to a farm before you can view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <PageBackButton />
            <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Audit Logs</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Activity within your farm — read-only.</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={ListChecks} label="Today's Activities" value={todayLogs.length} />
        <StatTile icon={LogIn} label="Staff Logins Today" value={staffLoginsToday} />
        <StatTile icon={ListChecks} label="Pending Approvals" value={pendingApprovals} />
        <StatTile icon={Boxes} label="Inventory Updates Today" value={inventoryUpdatesToday} />
        <StatTile icon={Bird} label="Production Records Today" value={productionRecordsToday} />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Activity Log</h2>
          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff, module, action…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={selectClass} aria-label="Date" />
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Staff</option>
            {staffNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        {isLoading ? (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading…
          </div>
        ) : loadError ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
            <AlertCircle size={20} className="text-[var(--color-danger)]" />
            <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--color-muted)]">No activity matches these filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                      <th className="px-4 py-3 font-medium">Date & Time</th>
                      <th className="px-4 py-3 font-medium">Staff</th>
                      <th className="px-4 py-3 font-medium">Module</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 300).map((l) => (
                      <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(l.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{l.userName ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{l.module}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{formatAuditAction(l.action)}</td>
                        <td className="max-w-[280px] truncate px-4 py-3 text-[var(--color-muted)]">{l.description ?? "—"}</td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={l.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportStaffActivity} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Staff Activity Report
          </button>
          <button type="button" onClick={handleExportDaily} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Daily Activity Report
          </button>
          <button type="button" onClick={handleExportWeekly} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Weekly Activity Report
          </button>
          <button type="button" onClick={handleExportMonthly} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Monthly Activity Report
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
