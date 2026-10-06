import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { RevenueExpensePoint } from "@poultryhub/shared/services/salesExpensesService";
import { axisTick, chartAnimation, gridProps, legendWrapperStyle, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

const currencyFormatter = (v: number) => `₱${(v / 1000).toFixed(0)}K`;

export default function FarmRevenueExpensesChart({ data }: { data: RevenueExpensePoint[] }) {
  return (
    <ChartCard title="Revenue vs. Expenses" subtitle="By month, in ₱" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={currencyFormatter} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [`₱${Number(value).toLocaleString()}`, ""]}
          />
          <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
          <Bar dataKey="revenue" name="Revenue" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={20} {...chartAnimation} />
          <Bar dataKey="expenses" name="Expenses" fill="var(--color-danger)" radius={[4, 4, 0, 0]} maxBarSize={20} {...chartAnimation} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
