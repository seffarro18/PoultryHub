import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  activityByDay,
  activityByFarm,
  activityByRole,
  failedLoginTrend,
  loginTrends,
  mostActiveModules,
  securityEventsTimeline,
} from "@poultryhub/shared/services/auditLogService";
import type { AuditLogEntry } from "@poultryhub/shared/types/auditLog";

const PIE_COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)", "var(--chart-series-5)"];

export default function AuditLogAnalytics({ logs }: { logs: AuditLogEntry[] }) {
  const byDay = useMemo(() => activityByDay(logs), [logs]);
  const logins = useMemo(() => loginTrends(logs), [logs]);
  const modules = useMemo(() => mostActiveModules(logs), [logs]);
  const failedLogins = useMemo(() => failedLoginTrend(logs), [logs]);
  const byRole = useMemo(() => activityByRole(logs), [logs]);
  const byFarm = useMemo(() => activityByFarm(logs).slice(0, 10), [logs]);
  const securityTimeline = useMemo(() => securityEventsTimeline(logs), [logs]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="User Activity by Day" subtitle="All logged actions, last 14 days">
        {byDay.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No activity yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Login Trends" subtitle="Successful sign-ins, last 14 days">
        {logins.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No sign-ins yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={logins} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Area type="monotone" dataKey="value" stroke="var(--chart-series-3)" fill="var(--chart-series-3)" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Most Active Modules" subtitle="Logged actions per module" height={Math.max(200, modules.length * 32)}>
        {modules.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No activity yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modules} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={130} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-2)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Failed Login Attempts" subtitle="Last 14 days">
        {failedLogins.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No failed attempts recorded</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={failedLogins} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--color-warning)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Activity by User Role" subtitle="Logged actions per role">
        {byRole.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No activity yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byRole} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {byRole.map((entry, i) => (
                  <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Activity by Farm" subtitle="Top 10 farms by logged actions" height={Math.max(200, byFarm.length * 32)}>
        {byFarm.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No farm-scoped activity yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byFarm} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--chart-series-4)" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Security Events Timeline" subtitle="High + critical severity events, last 14 days">
        {securityTimeline.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No high or critical severity events yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={securityTimeline} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="value" fill="var(--color-danger)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
