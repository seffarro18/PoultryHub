import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { CategorySlice } from "@poultryhub/shared/types/dashboard";
import { legendWrapperStyle, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

const COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)"];

export default function PoultryPopulationChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard title="Poultry Population" subtitle={`${total.toLocaleString()} birds by type`}>
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
    </ChartCard>
  );
}
