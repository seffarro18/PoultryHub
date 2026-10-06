import { Link, useLocation } from "react-router-dom";
import { useNotificationCount } from "../../context/NotificationCountContext";
import type { NavLink } from "../../config/navTypes";

interface BottomNavProps {
  items: NavLink[];
  homePath: string;
}

/** Home is the only tab that must NOT prefix-match (every other route starts with "/farm", so a prefix match here would light Home up everywhere). Every other tab matches its own path, or its `matchPaths` list when it covers more than one route (e.g. Inventory also covering the separate /farm/feed, /farm/vitamins, /farm/mortality alias routes) — exact match or a real path-segment boundary, never a bare substring, so "/farm/inventory-hub" can't false-positive against "/farm/inventory". */
function isTabActive(pathname: string, item: NavLink, homePath: string): boolean {
  if (item.path === homePath) return pathname === homePath;
  const candidates = item.matchPaths ?? [item.path];
  return candidates.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function BottomNav({ items, homePath }: BottomNavProps) {
  const { count: notificationCount } = useNotificationCount();
  const location = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-card)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isTabActive(location.pathname, item, homePath);
        const showBadge = item.label === "Notifications" && notificationCount > 0;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? "page" : undefined}
            className={[
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]",
            ].join(" ")}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={2} />
              {showBadge && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold text-white">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
