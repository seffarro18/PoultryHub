import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../ChartCard";
import { getMonthlyProfit } from "../../../services/farmDashboardService";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "./chartTheme";

export default function FarmMonthlyProfitChart() {
  const data = getMonthlyProfit();

  return (
    <ChartCard title="Monthly Profit" subtitle="Revenue minus expenses, in PHP">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="farm-profit-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-series-3)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-series-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [`₱${Number(value).toLocaleString()}`, "Profit"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-series-3)"
            strokeWidth={2}
            fill="url(#farm-profit-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
