import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { SeriesPoint } from "@poultryhub/shared/types/dashboard";
import { axisTick, chartAnimation, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

export default function FarmEggProductionChart({ data }: { data: SeriesPoint[] }) {

  return (
    <ChartCard title="Egg Production Trend" subtitle="Last 14 days, in eggs" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="farm-egg-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-series-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`)}
          />
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
            fill="url(#farm-egg-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
            {...chartAnimation}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
