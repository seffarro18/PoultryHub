import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../dashboard/ChartCard";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "../dashboard/charts/chartTheme";
import type { FarmAggregate } from "../../services/eggProductionService";

export default function FarmComparisonChart({ data }: { data: FarmAggregate[] }) {
  const chartData = data.map((d) => ({ label: d.farmName, value: d.totalCollected }));

  return (
    <ChartCard title="Farm Comparison" subtitle="Total approved eggs collected, by farm" height={Math.max(200, chartData.length * 36)}>
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
          No approved records yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis
              type="number"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
            />
            <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={120} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value) => Number(value).toLocaleString()}
            />
            <Bar dataKey="value" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
