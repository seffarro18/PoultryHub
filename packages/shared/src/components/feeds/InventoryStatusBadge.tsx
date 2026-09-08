type InventoryStatus = "in-stock" | "low-stock" | "depleted";

const STATUS_STYLE: Record<InventoryStatus, { label: string; color: string }> = {
  "in-stock": { label: "In Stock", color: "var(--color-success)" },
  "low-stock": { label: "Low Stock", color: "var(--color-warning)" },
  depleted: { label: "Depleted", color: "var(--color-danger)" },
};

function computeStatus(remainingStock: number, minimumStockLevel: number): InventoryStatus {
  if (remainingStock <= 0) return "depleted";
  if (remainingStock <= minimumStockLevel) return "low-stock";
  return "in-stock";
}

export default function InventoryStatusBadge({
  remainingStock,
  minimumStockLevel,
}: {
  remainingStock: number;
  minimumStockLevel: number;
}) {
  const { label, color } = STATUS_STYLE[computeStatus(remainingStock, minimumStockLevel)];
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
