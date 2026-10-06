import { Link } from "react-router-dom";
import { Egg, Plus } from "lucide-react";

interface MobileEggHeroCardProps {
  today: number;
  weekly: number;
  monthly: number;
}

/**
 * The mobile dashboard's signature card — Today's Egg Production as the
 * main figure, with the Weekly/Monthly breakdown underneath. All three
 * numbers are whatever the caller already fetched from Supabase (same
 * getFarmOverview()/getStaffOverview() this page already computes for its
 * wide-viewport KPI cards) — never a separate or hardcoded value.
 */
export default function MobileEggHeroCard({ today, weekly, monthly }: MobileEggHeroCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <p className="text-sm font-medium text-[var(--color-muted)]">Today's Egg Production</p>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
          <Egg size={28} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-display text-3xl font-semibold text-[var(--color-foreground)]">{today.toLocaleString()}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {today > 0 ? "eggs collected today" : "No eggs logged yet today."}
          </p>
        </div>
      </div>

      <Link
        to="/farm/egg-production"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white"
      >
        <Plus size={16} /> Log eggs
      </Link>

      <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)] pt-4">
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-[var(--color-foreground)]">{today.toLocaleString()}</p>
          <p className="text-[11px] text-[var(--color-muted)]">Today</p>
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-[var(--color-foreground)]">{weekly.toLocaleString()}</p>
          <p className="text-[11px] text-[var(--color-muted)]">Weekly</p>
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-[var(--color-foreground)]">{monthly.toLocaleString()}</p>
          <p className="text-[11px] text-[var(--color-muted)]">Monthly</p>
        </div>
      </div>
    </div>
  );
}
