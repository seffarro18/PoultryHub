import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import { chartAnimation, legendWrapperStyle, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";
import type { EggProductionRecord } from "@poultryhub/shared/types/eggProduction";

const COLORS = ["var(--chart-series-1)", "var(--chart-series-4)", "var(--chart-series-8)"];

export default function EggQualityBreakdownChart({ records }: { records: EggProductionRecord[] }) {
  const data = useMemo(() => {
    const totals = records.reduce(
      (acc, r) => ({
        good: acc.good + r.goodEggs,
        cracked: acc.cracked + r.crackedEggs,
        damaged: acc.damaged + r.damagedEggs,
      }),
      { good: 0, cracked: 0, damaged: 0 }
    );
    return [
      { name: "Good", value: totals.good },
      { name: "Cracked", value: totals.cracked },
      { name: "Damaged", value: totals.damaged },
    ].filter((slice) => slice.value > 0);
  }, [records]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard title="Egg Quality Breakdown" subtitle={total > 0 ? `${total.toLocaleString()} eggs, all records` : undefined}>
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
          No records yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
              {...chartAnimation}
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value) => Number(value).toLocaleString()}
            />
            <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
