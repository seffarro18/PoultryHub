import type { FarmStatus } from "../../types/farm";

const STATUS_STYLE: Record<FarmStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "var(--color-success)" },
  inactive: { label: "Inactive", color: "var(--color-warning)" },
  archived: { label: "Archived", color: "var(--color-muted)" },
};

export default function FarmStatusBadge({ status }: { status: FarmStatus }) {
  const { label, color } = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
