import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { SeriesPoint } from "@poultryhub/shared/types/dashboard";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

export default function FarmComparisonChart({ data }: { data: SeriesPoint[] }) {

  return (
    <ChartCard title="Farm Comparison" subtitle="Monthly egg output by farm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
        >
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis
            type="number"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => Number(value).toLocaleString()}
          />
          <Bar dataKey="value" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
