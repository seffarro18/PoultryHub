import type { LucideIcon } from "lucide-react";
import Button from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** "Nothing here yet" — icon + message + optional call to action, for any list/table with zero rows. Never leave a module showing a blank page. */
export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-muted-bg)] text-[var(--color-muted)]">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="font-display text-base font-semibold text-[var(--color-foreground)]">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>}
      </div>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
