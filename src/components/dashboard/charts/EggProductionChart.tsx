import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../ChartCard";
import { getEggProductionTrend } from "../../../services/dashboardService";
import { axisTick, gridProps, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from "./chartTheme";

type Period = "daily" | "monthly";

export default function EggProductionChart() {
  const [period, setPeriod] = useState<Period>("monthly");
  const data = getEggProductionTrend(period);

  return (
    <ChartCard
      title="Egg Production"
      subtitle={period === "daily" ? "Last 8 days, in eggs" : "This year, in eggs"}
      height={280}
      actions={
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
          {(["daily", "monthly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                period === p
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="egg-fill" x1="0" y1="0" x2="0" y2="1">
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
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
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
            fill="url(#egg-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
