import { NavLink as RouterNavLink } from "react-router-dom";
import { useNotificationCount } from "../../context/NotificationCountContext";
import type { NavLink } from "../../config/navTypes";

interface BottomNavProps {
  items: NavLink[];
  homePath: string;
}

export default function BottomNav({ items, homePath }: BottomNavProps) {
  const { count: notificationCount } = useNotificationCount();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-card)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const showBadge = item.label === "Notifications" && notificationCount > 0;
        return (
          <RouterNavLink
            key={item.path}
            to={item.path}
            end={item.path === homePath}
            className={({ isActive }) =>
              [
                "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]",
              ].join(" ")
            }
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
          </RouterNavLink>
        );
      })}
    </nav>
  );
}
