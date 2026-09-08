import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { SeriesPoint } from "@poultryhub/shared/types/dashboard";
import { axisTick, chartAnimation, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

export default function FarmFeedConsumptionChart({ data }: { data: SeriesPoint[] }) {

  return (
    <ChartCard title="Feed Consumption" subtitle="This week, in kg">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [`${Number(value).toLocaleString()} kg`, "Consumed"]}
          />
          <Bar dataKey="value" fill="var(--chart-series-3)" radius={[4, 4, 0, 0]} maxBarSize={28} {...chartAnimation} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
