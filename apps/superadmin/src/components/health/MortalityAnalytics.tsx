import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "@poultryhub/shared/components/dashboard/ChartCard";
import {
  axisTick,
  gridProps,
  legendWrapperStyle,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "@poultryhub/shared/components/dashboard/charts/chartTheme";
import { aggregateMortalityByCause, aggregateMortalityByFarm, aggregateMortalityByMonth, mortalityRateByFarm } from "@poultryhub/shared/services/mortalityRecordService";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";
import type { FarmStockTotal } from "@poultryhub/shared/services/poultryInventoryService";

const PIE_COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)", "var(--chart-series-5)"];

export default function MortalityAnalytics({ records, stockTotals }: { records: MortalityRecord[]; stockTotals: FarmStockTotal[] }) {
  const monthly = useMemo(() => aggregateMortalityByMonth(records), [records]);
  const byCause = useMemo(() => aggregateMortalityByCause(records).slice(0, 8), [records]);
  const byFarm = useMemo(() => aggregateMortalityByFarm(records), [records]);
  const rateByFarm = useMemo(() => mortalityRateByFarm(records, stockTotals), [records, stockTotals]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Mortality Trends" subtitle="Dead birds per month, last 12 months">
        {monthly.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" name="Dead birds" fill="var(--color-danger)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Mortality by Cause" subtitle="Top causes of death, dead birds">
        {byCause.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCause.map((c) => ({ name: c.label, value: c.deadBirds }))} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {byCause.map((entry, i) => (
                  <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Farm Mortality Comparison" subtitle="Dead birds per farm" height={Math.max(200, byFarm.length * 32)}>
        {byFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byFarm.map((f) => ({ label: f.farmName, value: f.deadBirds }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--color-danger)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Mortality Rate by Farm" subtitle="Dead birds ÷ current stock, last 30 days" height={Math.max(200, rateByFarm.length * 32)}>
        {rateByFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rateByFarm.map((f) => ({ label: f.farmName, value: f.ratePercent }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(value) => `${value}%`} />
              <Bar dataKey="value" fill="var(--color-danger)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
