import { CircleCheckBig } from "lucide-react";

/** The positive "all clear" state — deliberately styled in success green rather than the neutral gray generic EmptyState uses, since this is reassuring news, not a missing-content gap. */
export default function AttentionEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-success)]/10 text-[var(--color-success)]">
        <CircleCheckBig size={26} strokeWidth={1.75} />
      </div>
      <p className="font-display text-base font-semibold text-[var(--color-foreground)]">No pending actions</p>
      <p className="max-w-xs text-sm text-[var(--color-muted)]">All important farm activities are up to date.</p>
    </div>
  );
}
