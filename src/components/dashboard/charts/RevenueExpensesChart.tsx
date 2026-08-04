import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../ChartCard";
import { getRevenueExpenses } from "../../../services/dashboardService";
import {
  axisTick,
  gridProps,
  legendWrapperStyle,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "./chartTheme";

const formatCurrency = (v: number) => `₱${(v / 1000).toFixed(0)}K`;

export default function RevenueExpensesChart() {
  const data = getRevenueExpenses();

  return (
    <ChartCard title="Revenue vs Expenses" subtitle="This year, in PHP" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
          <Bar dataKey="revenue" name="Revenue" fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar dataKey="expenses" name="Expenses" fill="var(--chart-series-2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
