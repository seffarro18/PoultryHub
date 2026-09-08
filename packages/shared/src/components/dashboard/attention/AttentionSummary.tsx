import { PRIORITY_META } from "./attentionDisplay";
import type { AttentionPriority } from "../../../types/attention";

interface AttentionSummaryProps {
  total: number;
  counts: Record<AttentionPriority, number>;
}

export default function AttentionSummary({ total, counts }: AttentionSummaryProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Needs Attention</h2>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          {total} {total === 1 ? "item requires" : "items require"} your attention
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {(["high", "medium", "low"] as const).map((priority) => {
          const meta = PRIORITY_META[priority];
          const count = counts[priority];
          if (count === 0) return null;
          return (
            <span
              key={priority}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ color: meta.color, backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
            >
              {count} {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
