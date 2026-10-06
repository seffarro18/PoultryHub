import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { SeriesPoint } from "@poultryhub/shared/types/dashboard";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

export default function UserGrowthChart({ data }: { data: SeriesPoint[] }) {

  return (
    <ChartCard title="User Growth" subtitle="Cumulative platform users, this year">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="user-growth-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-series-7)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-series-7)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [Number(value).toLocaleString(), "Users"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-series-7)"
            strokeWidth={2}
            fill="url(#user-growth-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
