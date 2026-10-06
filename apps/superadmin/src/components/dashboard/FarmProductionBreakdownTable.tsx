import type { FarmProductionBreakdownRow } from "@poultryhub/shared/types/dashboard";

interface FarmProductionBreakdownTableProps {
  rows: FarmProductionBreakdownRow[];
}

/** Approved egg production, Today/This Week/This Month, per authorized farm — same underlying records and approved-only rule as the KPI cards above, just broken out by farm instead of summed across all of them. */
export default function FarmProductionBreakdownTable({ rows }: FarmProductionBreakdownTableProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Production by Farm</h3>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">Approved egg production, per farm</p>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-muted)]">No approved production records yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                <th className="py-2 pr-4 font-medium">Farm Name</th>
                <th className="py-2 pr-4 font-medium">Today</th>
                <th className="py-2 pr-4 font-medium">This Week</th>
                <th className="py-2 font-medium">This Month</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.farmId} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-[var(--color-foreground)]">{row.farmName}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-foreground)]">{row.today.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-foreground)]">{row.thisWeek.toLocaleString()}</td>
                  <td className="py-2.5 text-[var(--color-foreground)]">{row.thisMonth.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
