import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface MobileQuickAction {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface MobileQuickActionsProps {
  actions: MobileQuickAction[];
}

/** Role-specific action list is decided by the caller (Farm Admin vs Staff) — this just lays out whatever real routes it's given, nothing hardcoded or role-aware here. */
export default function MobileQuickActions({ actions }: MobileQuickActionsProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Quick actions</h2>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {actions.map((action) => (
          <Link
            key={action.path + action.label}
            to={action.path}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-3 text-center"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <action.icon size={18} strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-medium leading-tight text-[var(--color-foreground)]">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
