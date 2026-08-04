import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CalendarDays, LogOut, Menu, Moon, Search, Sun, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface TopbarProps {
  accountPath: string;
  accountLabel: string;
  homePath: string;
  onOpenMobileSidebar: () => void;
  notificationCount: number;
  /** False when a bottom tab bar replaces the sidebar (mobile Farm portal) — there's nothing for this button to open. */
  showMobileMenuButton: boolean;
  /** True on mobile whenever we're not on the portal's home tab — there's a bottom bar but no other way back. */
  showBackButton: boolean;
}

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export default function Topbar({
  accountPath,
  accountLabel,
  homePath,
  onOpenMobileSidebar,
  notificationCount,
  showMobileMenuButton,
  showBackButton,
}: TopbarProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-4 backdrop-blur-sm sm:px-6">
      {showMobileMenuButton && (
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] md:hidden"
          aria-label="Open menu"
        >
          <Menu size={19} />
        </button>
      )}

      {showBackButton && (
        <button
          type="button"
          onClick={() => (window.history.length > 2 ? navigate(-1) : navigate(homePath))}
          className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
          aria-label="Go back"
        >
          <ArrowLeft size={19} />
        </button>
      )}

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search farms, users, records…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)] focus-visible:bg-[var(--color-card)]"
          aria-label="Global search"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-1 hidden items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] md:flex">
          <CalendarDays size={14} />
          {todayLabel}
        </span>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          className="relative rounded-lg p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
          aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[var(--color-muted-bg)]"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={16} />
              )}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-[var(--color-foreground)]">
                {user?.name ?? "Account"}
              </span>
              <span className="block text-xs leading-tight text-[var(--color-muted)]">{user?.role ?? ""}</span>
            </span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(accountPath);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
                >
                  <UserRound size={16} /> {accountLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
