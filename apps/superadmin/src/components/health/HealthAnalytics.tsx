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
import {
  aggregateHealthByCondition,
  aggregateHealthByFarm,
  aggregateHealthByMonth,
  treatmentRateByFarm,
  vaccinationComplianceByFarm,
} from "@poultryhub/shared/services/healthRecordService";
import type { HealthRecord } from "@poultryhub/shared/types/health";

const PIE_COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)", "var(--chart-series-5)"];

export default function HealthAnalytics({ records }: { records: HealthRecord[] }) {
  const byFarm = useMemo(() => aggregateHealthByFarm(records), [records]);
  const byCondition = useMemo(() => aggregateHealthByCondition(records).slice(0, 8), [records]);
  const monthly = useMemo(() => aggregateHealthByMonth(records), [records]);
  const vaccinationCoverage = useMemo(() => vaccinationComplianceByFarm(records), [records]);
  const treatmentRate = useMemo(() => treatmentRateByFarm(records), [records]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Disease Cases by Farm" subtitle="Approved cases, birds affected" height={Math.max(200, byFarm.length * 32)}>
        {byFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byFarm.map((f) => ({ label: f.farmName, value: f.affectedBirds }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Cases by Disease / Condition" subtitle="Top conditions, birds affected">
        {byCondition.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCondition.map((c) => ({ name: c.label, value: c.affectedBirds }))} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {byCondition.map((entry, i) => (
                  <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Disease Trends" subtitle="Birds affected per month, last 12 months">
        {monthly.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" name="Affected birds" fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Vaccination Coverage" subtitle="% of approved cases with a vaccination recorded, per farm" height={Math.max(200, vaccinationCoverage.length * 32)}>
        {vaccinationCoverage.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vaccinationCoverage.map((f) => ({ label: f.farmName, value: f.rate }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(value) => `${value}%`} />
              <Bar dataKey="value" fill="var(--chart-series-3)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Treatment Rate" subtitle="% of approved cases with treatment administered, per farm — the closest honest proxy for recovery, since outcomes aren't tracked" height={Math.max(200, treatmentRate.length * 32)}>
        {treatmentRate.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={treatmentRate.map((f) => ({ label: f.farmName, value: f.rate }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(value) => `${value}%`} />
              <Bar dataKey="value" fill="var(--chart-series-4)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Farm Health Comparison" subtitle="Case count vs. birds affected, per farm" height={Math.max(200, byFarm.length * 36)}>
        {byFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byFarm.map((f) => ({ label: f.farmName, cases: f.caseCount, affected: f.affectedBirds }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
              <Bar dataKey="cases" name="Cases" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="affected" name="Birds affected" fill="var(--chart-series-2)" radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
