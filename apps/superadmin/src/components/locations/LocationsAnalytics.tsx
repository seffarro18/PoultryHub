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
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

const STATUS_COLORS: Record<string, string> = {
  Active: "var(--color-success)",
  Inactive: "var(--color-danger)",
  Archived: "var(--color-muted)",
};

// Farms by Province would always be a single "Aurora" bar — PoultryHub only
// operates there — so this breaks down by municipality instead, the
// meaningful geographic dimension now (Aurora has 8).
function useMunicipalityBreakdown(farms: ManagedFarm[]) {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of farms) {
      if (!f.city) continue;
      counts.set(f.city, (counts.get(f.city) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [farms]);
}

function useStatusBreakdown(farms: ManagedFarm[]) {
  return useMemo(() => {
    const labels: Record<ManagedFarm["status"], string> = { active: "Active", inactive: "Inactive", archived: "Archived" };
    const counts = { active: 0, inactive: 0, archived: 0 };
    for (const f of farms) counts[f.status] += 1;
    return (Object.keys(counts) as (keyof typeof counts)[])
      .map((status) => ({ name: labels[status], value: counts[status] }))
      .filter((slice) => slice.value > 0);
  }, [farms]);
}

function useMonthlyRegistrations(farms: ManagedFarm[]) {
  return useMemo(() => {
    const buckets = new Map<string, { label: string; value: number }>();
    for (const f of farms) {
      const d = new Date(f.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      const bucket = buckets.get(key) ?? { label, value: 0 };
      bucket.value += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, bucket]) => bucket);
  }, [farms]);
}

export default function LocationsAnalytics({ farms }: { farms: ManagedFarm[] }) {
  const byMunicipality = useMunicipalityBreakdown(farms);
  const byStatus = useStatusBreakdown(farms);
  const byMonth = useMonthlyRegistrations(farms);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <ChartCard title="Farms by Municipality" subtitle="Across Aurora" height={Math.max(200, byMunicipality.length * 32)}>
        {byMunicipality.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No location data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMunicipality} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Active vs Inactive" subtitle="By current status">
        {byStatus.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No farms yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="var(--color-card)"
                strokeWidth={2}
              >
                {byStatus.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Registered Farms per Month" subtitle="Last 12 months with activity">
        {byMonth.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No farms yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
