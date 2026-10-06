import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";
import type { FarmDailyMonthlyTrend } from "@poultryhub/shared/services/farmMonitoringService";

type Period = "daily" | "monthly";

interface FarmAmountTrendChartProps {
  title: string;
  subtitle?: string;
  data: FarmDailyMonthlyTrend;
  color: string;
}

/** Daily/Monthly toggle amount chart for this farm — reused for both Sales and Expenses so the two tabs share one visual recipe. */
export default function FarmAmountTrendChart({ title, subtitle, data, color }: FarmAmountTrendChartProps) {
  const [period, setPeriod] = useState<Period>("daily");
  const series = period === "daily" ? data.daily : data.monthly;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      actions={
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
          {(["daily", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                period === p ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [`₱${Number(value).toLocaleString()}`, ""]}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
