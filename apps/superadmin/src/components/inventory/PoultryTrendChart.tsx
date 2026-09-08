import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import {
  axisTick,
  gridProps,
  legendWrapperStyle,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "@poultryhub/shared/components/dashboard/charts/chartTheme";
import { aggregateArrivalsVsMortalityByDay } from "@poultryhub/shared/services/poultryInventoryService";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

interface PoultryTrendChartProps {
  events: PoultryEvent[];
  mortalityRecords?: MortalityRecord[];
}

export default function PoultryTrendChart({ events, mortalityRecords = [] }: PoultryTrendChartProps) {
  const data = useMemo(() => aggregateArrivalsVsMortalityByDay(events, mortalityRecords), [events, mortalityRecords]);

  return (
    <ChartCard title="Arrivals vs. Mortality" subtitle="Per day, last 30 days" height={280}>
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
          No arrivals or mortality recorded yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value) => Number(value).toLocaleString()}
            />
            <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            <Bar dataKey="arrivals" name="Arrivals" fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="mortality" name="Mortality" fill="var(--chart-series-8)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
