interface AccountScreenHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Shared title (+ optional subtitle) for every screen reached from the
 * Profile settings menu. No back button here — the topbar already shows one
 * automatically for any page that isn't a bottom-nav root (see
 * DashboardLayout's showBackButton), same mechanism every other drill-down
 * screen in the app (Staff Management, Egg Production, etc.) already relies
 * on. A second, page-local back button here would just duplicate it.
 */
export default function AccountScreenHeader({ title, subtitle }: AccountScreenHeaderProps) {
  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
    </div>
  );
}
