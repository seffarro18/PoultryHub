import { useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, PackageCheck } from "lucide-react";
import RemainingEggsModal from "@poultryhub/shared/components/dashboard/RemainingEggsModal";

interface RemainingEggsCardProps {
  farmId: string;
  /** The dashboard's Remaining Eggs total; null when it couldn't be loaded. */
  total: number | null;
  /** Desktop: wrap the existing KPI card instead of rendering the compact phone card. */
  children?: ReactNode;
}

/** Opens Remaining Eggs by size. Phone: a compact card under the hero; tablet/desktop: wraps the existing KPI card. */
export default function RemainingEggsCard({ farmId, total, children }: RemainingEggsCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children ? (
        <button type="button" onClick={() => setOpen(true)} className="block w-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" aria-label="Remaining Eggs — view by size">
          {children}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <PackageCheck size={17} />
            </span>
            <span>
              <span className="block text-xs font-medium text-[var(--color-muted)]">Remaining Eggs</span>
              <span className="block text-lg font-semibold text-[var(--color-foreground)]">{total === null ? "Unavailable" : `${total.toLocaleString()} eggs`}</span>
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
            By size <ChevronRight size={14} />
          </span>
        </button>
      )}
      <AnimatePresence>{open && <RemainingEggsModal farmId={farmId} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
