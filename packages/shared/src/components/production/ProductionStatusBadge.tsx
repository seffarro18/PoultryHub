import { motion, useReducedMotion } from "framer-motion";
import type { ProductionStatus } from "../../types/eggProduction";

const STATUS_STYLE: Record<ProductionStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "var(--color-warning)" },
  approved: { label: "Approved", color: "var(--color-success)" },
  rejected: { label: "Rejected", color: "var(--color-danger)" },
};

/** Keyed by status so approving/rejecting a record plays a quick, single settle-in on the badge — never a continuous flash or pulse. */
export default function ProductionStatusBadge({ status }: { status: ProductionStatus }) {
  const { label, color } = STATUS_STYLE[status];
  const reducedMotion = useReducedMotion();

  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </motion.span>
  );
}
