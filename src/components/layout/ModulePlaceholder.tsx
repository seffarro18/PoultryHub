import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  icon?: LucideIcon;
}

export default function ModulePlaceholder({ title, icon: Icon = Construction }: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-muted-bg)] text-[var(--color-primary)]">
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">{title}</h2>
        <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
          This module is coming soon. It'll be built out in a follow-up pass.
        </p>
      </div>
    </div>
  );
}
