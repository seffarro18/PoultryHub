import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "../dashboard/ChartCard";
import { legendWrapperStyle, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "../dashboard/charts/chartTheme";
import { currentStockByType } from "../../services/poultryInventoryService";
import type { PoultryEvent } from "../../types/poultryInventory";
import type { MortalityRecord } from "../../types/mortality";

const COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)"];

interface PoultryStockBreakdownChartProps {
  events: PoultryEvent[];
  mortalityRecords?: MortalityRecord[];
}

export default function PoultryStockBreakdownChart({ events, mortalityRecords = [] }: PoultryStockBreakdownChartProps) {
  const data = useMemo(() => {
    const totals = currentStockByType(events, mortalityRecords);
    return Object.entries(totals)
      .map(([name, value]) => ({ name: `${name}s`, value }))
      .filter((slice) => slice.value > 0);
  }, [events]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard title="Stock by Type" subtitle={total > 0 ? `${total.toLocaleString()} birds` : undefined}>
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
          No stock recorded yet
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
