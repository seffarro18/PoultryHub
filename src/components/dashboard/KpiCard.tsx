import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { KpiCardData } from "../../types/dashboard";

const STATUS_COLOR: Record<KpiCardData["status"], string> = {
  good: "var(--color-success)",
  warning: "var(--color-warning)",
  critical: "var(--color-danger)",
};

export default function KpiCard({ data }: { data: KpiCardData }) {
  const Icon = data.icon;
  const deltaColor = data.isPositive ? "var(--color-success)" : "var(--color-danger)";
  const sparkData = data.sparkline.map((value, i) => ({ i, value }));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon size={17} strokeWidth={2} aria-hidden="true" />
        </span>
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_COLOR[data.status] }}
          role="img"
          aria-label={`Status: ${data.status}`}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--color-muted)]">{data.label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-[var(--color-foreground)]">{data.value}</p>
      </div>

      <div className="flex items-end justify-between gap-2">
        <span
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold"
          style={{ color: deltaColor, backgroundColor: `color-mix(in srgb, ${deltaColor} 12%, transparent)` }}
        >
          {data.deltaPercent >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(data.deltaPercent)}%
        </span>

        <div className="h-8 w-20" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STATUS_COLOR[data.status]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={STATUS_COLOR[data.status]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-muted)"
                strokeWidth={1.5}
                fill={`url(#spark-${data.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
