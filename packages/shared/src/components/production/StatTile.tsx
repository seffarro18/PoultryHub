import type { LucideIcon } from "lucide-react";

export default function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  /** A string is passed pre-formatted as-is (e.g. a unit-aware breakdown like "1,200 kg + 40 sacks") — only numbers get toLocaleString(). */
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
        <Icon size={18} strokeWidth={2} />
      </span>
      <div>
        <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
        <p className="text-xl font-semibold text-[var(--color-foreground)]">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}
