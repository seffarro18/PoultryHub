import type { ProductionStatus } from "../../types/eggProduction";

const STATUS_STYLE: Record<ProductionStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "var(--color-warning)" },
  approved: { label: "Approved", color: "var(--color-success)" },
  rejected: { label: "Rejected", color: "var(--color-danger)" },
};

export default function ProductionStatusBadge({ status }: { status: ProductionStatus }) {
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
