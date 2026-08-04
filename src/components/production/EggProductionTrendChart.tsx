import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../dashboard/ChartCard";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "../dashboard/charts/chartTheme";
import type { EggProductionRecord } from "../../types/eggProduction";

export default function EggProductionTrendChart({ records }: { records: EggProductionRecord[] }) {
  const data = useMemo(() => {
    const totalsByDate = new Map<string, number>();
    for (const record of records) {
      totalsByDate.set(record.productionDate, (totalsByDate.get(record.productionDate) ?? 0) + record.eggsCollected);
    }
    return [...totalsByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, value]) => ({
        label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value,
      }));
  }, [records]);

  return (
    <ChartCard title="Egg Production Trend" subtitle="Eggs collected per day, last 30 days" height={280}>
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
          No records yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="egg-prod-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-series-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value) => [Number(value).toLocaleString(), "Eggs"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart-series-1)"
              strokeWidth={2}
              fill="url(#egg-prod-trend-fill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
