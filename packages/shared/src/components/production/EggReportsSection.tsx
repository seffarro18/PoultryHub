import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../dashboard/ChartCard";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "../dashboard/charts/chartTheme";
import { aggregateByDay, aggregateByMonth, aggregateByWeek, aggregateByYear } from "../../services/eggProductionService";
import type { EggProductionRecord } from "../../types/eggProduction";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Annual" };

export default function EggReportsSection({
  records,
  includeYearly = false,
}: {
  records: EggProductionRecord[];
  /** Adds an "Annual" tab — only Super Admin's system-wide view asks for this. */
  includeYearly?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("daily");
  const periods = includeYearly ? (["daily", "weekly", "monthly", "yearly"] as const) : (["daily", "weekly", "monthly"] as const);

  const data = useMemo(() => {
    if (period === "yearly") return aggregateByYear(records);
    if (period === "weekly") return aggregateByWeek(records);
    if (period === "monthly") return aggregateByMonth(records);
    return aggregateByDay(records);
  }, [records, period]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                period === p
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <ChartCard title={`${PERIOD_LABELS[period]} Eggs Collected`} height={240}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
            No records yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="period" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(value) => [Number(value).toLocaleString(), "Collected"]}
              />
              <Bar dataKey="collected" fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {data.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">{PERIOD_LABELS[period]}</th>
                  <th className="px-4 py-3 font-medium">Collected</th>
                  <th className="px-4 py-3 font-medium">Broken</th>
                  <th className="px-4 py-3 font-medium">Damaged</th>
                  <th className="px-4 py-3 font-medium">Sold</th>
                  <th className="px-4 py-3 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row) => (
                  <tr key={row.period} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3 text-[var(--color-foreground)]">{row.period}</td>
                    <td className="px-4 py-3 text-[var(--color-foreground)]">{row.collected.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{row.broken.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{row.damaged.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{row.sold.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--color-foreground)]">{row.remaining.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
