import type { StockStatus } from "../../types/feedVitamin";

const STATUS_STYLE: Record<StockStatus, { label: string; color: string }> = {
  normal: { label: "Normal", color: "var(--color-success)" },
  low: { label: "Low Stock", color: "var(--color-warning)" },
  out: { label: "Out of Stock", color: "var(--color-danger)" },
};

/** Status is computed by the caller via feedStockStatus()/vitaminStockStatus() (types/feedVitamin.ts) — a hardcoded threshold per item type, not a per-batch configurable one. */
export default function InventoryStatusBadge({ status }: { status: StockStatus }) {
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
