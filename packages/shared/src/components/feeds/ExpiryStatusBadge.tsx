import type { ExpiryStatus } from "../../types/feedVitamin";

const STATUS_STYLE: Record<ExpiryStatus, { label: string; color: string }> = {
  normal: { label: "Normal", color: "var(--color-success)" },
  expiring: { label: "Expiring Soon", color: "var(--color-warning)" },
  expired: { label: "Expired", color: "var(--color-danger)" },
};

/** Status is computed by the caller via vitaminExpiryStatus() (types/feedVitamin.ts). Same pill style as InventoryStatusBadge. */
export default function ExpiryStatusBadge({ status }: { status: ExpiryStatus }) {
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
