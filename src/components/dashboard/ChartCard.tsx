import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number;
}

export default function ChartCard({ title, subtitle, actions, children, className, height = 260 }: ChartCardProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}
