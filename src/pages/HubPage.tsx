import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { NavLink } from "../config/navTypes";

interface HubPageProps {
  title: string;
  subtitle?: string;
  items: NavLink[];
}

/**
 * Landing page for a mobile bottom-nav tab that fans out to more than one
 * destination (e.g. "Operations"). Every item here is a real route — nothing
 * reachable from the desktop sidebar becomes unreachable on mobile just
 * because it didn't fit in five tabs.
 */
export default function HubPage({ title, subtitle, items }: HubPageProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 transition-colors hover:bg-[var(--color-muted-bg)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="flex-1 text-sm font-medium text-[var(--color-foreground)]">{item.label}</span>
              <ChevronRight size={16} className="shrink-0 text-[var(--color-muted)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
