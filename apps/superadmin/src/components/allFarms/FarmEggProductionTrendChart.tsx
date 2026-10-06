import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import type { SeriesPoint } from "@poultryhub/shared/types/dashboard";
import { axisTick, gridProps, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from "@poultryhub/shared/components/dashboard/charts/chartTheme";

type Period = "daily" | "weekly" | "monthly";
const PERIOD_LABELS: Record<Period, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

interface FarmEggProductionTrendChartProps {
  dailyData: SeriesPoint[];
  weeklyData: SeriesPoint[];
  monthlyData: SeriesPoint[];
}

/** This farm's own egg production trend, with a Daily/Weekly/Monthly toggle — a dedicated component (not the shared Dashboard EggProductionChart, which only supports 2 periods) so the main Dashboard's chart is never at risk of regressing. */
export default function FarmEggProductionTrendChart({ dailyData, weeklyData, monthlyData }: FarmEggProductionTrendChartProps) {
  const [period, setPeriod] = useState<Period>("daily");
  const data = period === "daily" ? dailyData : period === "weekly" ? weeklyData : monthlyData;

  return (
    <ChartCard
      title="Egg Production"
      subtitle="This farm's collected eggs"
      actions={
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                period === p ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="farm-egg-trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [`${Number(value).toLocaleString()} eggs`, "Collected"]}
          />
          <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#farm-egg-trend)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
