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
  aggregateFeedByFarm,
  aggregateFeedByMonth,
  aggregateVitaminByFarm,
  aggregateVitaminByMonth,
  lowStockFeeds,
  lowStockVitamins,
} from "@poultryhub/shared/services/feedVitaminService";
import type { FeedBatch, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "@poultryhub/shared/types/feedVitamin";

const PIE_COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)", "var(--chart-series-5)"];

interface FeedVitaminAnalyticsProps {
  feedBatches: FeedBatch[];
  vitaminBatches: VitaminBatch[];
  feedDistributionRecords: FeedDistributionRecord[];
  vitaminAdministrationRecords: VitaminAdministrationRecord[];
}

export default function FeedVitaminAnalytics({
  feedBatches,
  vitaminBatches,
  feedDistributionRecords,
  vitaminAdministrationRecords,
}: FeedVitaminAnalyticsProps) {
  const feedByFarm = useMemo(() => aggregateFeedByFarm(feedDistributionRecords), [feedDistributionRecords]);
  const vitaminByFarm = useMemo(() => aggregateVitaminByFarm(vitaminAdministrationRecords), [vitaminAdministrationRecords]);

  const monthlyTrends = useMemo(() => {
    const feedMonthly = aggregateFeedByMonth(feedDistributionRecords);
    const vitaminMonthly = aggregateVitaminByMonth(vitaminAdministrationRecords);
    const labels = [...new Set([...feedMonthly.map((m) => m.label), ...vitaminMonthly.map((m) => m.label)])];
    return labels.map((label) => ({
      label,
      feed: feedMonthly.find((m) => m.label === label)?.value ?? 0,
      vitamin: vitaminMonthly.find((m) => m.label === label)?.value ?? 0,
    }));
  }, [feedDistributionRecords, vitaminAdministrationRecords]);

  const feedByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const f of feedBatches) {
      const key = f.category ?? "Uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + f.remainingStock);
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value })).filter((d) => d.value > 0);
  }, [feedBatches]);

  const lowStock = useMemo(() => {
    const feeds = lowStockFeeds(feedBatches).map((f) => ({
      label: `${f.farmName} · ${f.feedName}`,
      remaining: f.remainingStock,
      minimum: f.minimumStockLevel,
    }));
    const vitamins = lowStockVitamins(vitaminBatches).map((v) => ({
      label: `${v.farmName} · ${v.vitaminName}`,
      remaining: v.remainingStock,
      minimum: v.minimumStockLevel,
    }));
    return [...feeds, ...vitamins].slice(0, 10);
  }, [feedBatches, vitaminBatches]);

  const farmComparison = useMemo(() => {
    const farmNames = new Map<string, string>();
    for (const f of feedByFarm) farmNames.set(f.farmId, f.farmName);
    for (const v of vitaminByFarm) farmNames.set(v.farmId, v.farmName);
    return [...farmNames.entries()]
      .map(([farmId, farmName]) => ({
        label: farmName,
        feed: feedByFarm.find((f) => f.farmId === farmId)?.totalUsed ?? 0,
        vitamin: vitaminByFarm.find((v) => v.farmId === farmId)?.totalUsed ?? 0,
      }))
      .sort((a, b) => b.feed + b.vitamin - (a.feed + a.vitamin))
      .slice(0, 10);
  }, [feedByFarm, vitaminByFarm]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Feed Consumption by Farm" subtitle="Approved distributions" height={Math.max(200, feedByFarm.length * 32)}>
        {feedByFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feedByFarm.map((f) => ({ label: f.farmName, value: f.totalUsed }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Vitamin Usage by Farm" subtitle="Approved administrations" height={Math.max(200, vitaminByFarm.length * 32)}>
        {vitaminByFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vitaminByFarm.map((v) => ({ label: v.farmName, value: v.totalUsed }))} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-2)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Monthly Consumption Trends" subtitle="Feed vs. vitamin usage, last 12 months">
        {monthlyTrends.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrends} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
              <Bar dataKey="feed" name="Feed" fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="vitamin" name="Vitamin" fill="var(--chart-series-2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Feed Inventory Distribution" subtitle="Remaining stock by category">
        {feedByCategory.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No feed stock recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={feedByCategory} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {feedByCategory.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Low Stock Analysis" subtitle="Remaining vs. minimum level" height={Math.max(200, lowStock.length * 32)}>
        {lowStock.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">Nothing below its minimum level</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lowStock} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={140} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
              <Bar dataKey="remaining" name="Remaining" fill="var(--color-danger)" radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="minimum" name="Minimum" fill="var(--chart-muted)" radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Farm Performance Comparison" subtitle="Feed vs. vitamin usage per farm" height={Math.max(200, farmComparison.length * 36)}>
        {farmComparison.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No approved records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={farmComparison} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
              <Bar dataKey="feed" name="Feed" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="vitamin" name="Vitamin" fill="var(--chart-series-2)" radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
