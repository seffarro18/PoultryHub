import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CalendarDays, Check, Languages, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotificationCount } from "../../context/NotificationCountContext";
import { useSystemSettings } from "../../context/SystemSettingsContext";
import { getMyPreferences, updateMyPreferences } from "../../services/profileService";
import { LANGUAGE_OPTIONS } from "../../types/systemSettings";
import ConfirmDialog from "./ConfirmDialog";

interface TopbarProps {
  accountPath: string;
  accountLabel: string;
  homePath: string;
  notificationsPath: string;
  onOpenMobileSidebar: () => void;
  /** False when a bottom tab bar replaces the sidebar (mobile Farm portal) — there's nothing for this button to open. */
  showMobileMenuButton: boolean;
  /** True on mobile whenever we're not on the portal's home tab — there's a bottom bar but no other way back. */
  showBackButton: boolean;
}

export default function Topbar({
  accountPath,
  accountLabel,
  homePath,
  notificationsPath,
  onOpenMobileSidebar,
  showMobileMenuButton,
  showBackButton,
}: TopbarProps) {
  const { user, signOut } = useAuth();
  const { settings } = useSystemSettings();
  const { count: notificationCount } = useNotificationCount();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);

  useEffect(() => {
    getMyPreferences()
      .then((prefs) => {
        if (prefs?.language) setLanguage(prefs.language);
      })
      .catch((err) => console.error("[Topbar] failed to load language preference:", err));
  }, []);

  const handleSelectLanguage = (value: string) => {
    const previous = language;
    setLanguage(value);
    setLanguageMenuOpen(false);
    setLanguageError(null);
    updateMyPreferences({ language: value }).catch((err) => {
      console.error("[Topbar] failed to save language preference:", err);
      // Roll back — if the save didn't actually take, the UI shouldn't
      // silently claim otherwise (this is what made the button look like it
      // "did nothing": the click registered, but a failed save with no
      // visible error made it indistinguishable from a dead button).
      setLanguage(previous);
      setLanguageError("Couldn't save your language. Please try again.");
    });
  };

  const currentLanguageCode = language.split("-")[1] ?? language;

  const todayLabel = new Date().toLocaleDateString(language, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const systemName = settings?.systemName || "PoultryHub";

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-4 backdrop-blur-sm sm:px-6">
      {/* Back/menu button comes before the logo so it's the true leftmost,
          upper-left corner element whenever it's showing — navigation
          affordance takes priority over branding position. */}
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

      {/* The sidebar already carries this exact mark once it's on-screen at
          md+ width — showing it here too would just double up. Below md, the
          sidebar is off-screen by default (a drawer, closed until the menu
          button is tapped), so this is the only branding visible there —
          most relevant for the Farm portal's bottom-nav mode, which has no
          sidebar at all. */}
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt={systemName} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
              <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
            </svg>
          </div>
        )}
        <span className="font-display truncate text-base font-semibold text-[var(--color-primary)]">{systemName}</span>
      </div>

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

        <div className="relative">
          <button
            type="button"
            onClick={() => setLanguageMenuOpen((v) => !v)}
            aria-expanded={languageMenuOpen}
            className="flex items-center gap-1 rounded-lg px-2 py-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
            aria-label={`Language: ${LANGUAGE_OPTIONS.find((opt) => opt.value === language)?.label ?? language}`}
          >
            <Languages size={18} />
            {/* A visible, always-on indicator of the current selection — the
                dropdown click itself gives no other confirmation that a
                selection actually took effect. */}
            <span className="text-xs font-semibold">{currentLanguageCode}</span>
          </button>

          {languageMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLanguageMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-lg">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectLanguage(opt.value)}
                    className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
                  >
                    {opt.label}
                    {language === opt.value && <Check size={14} className="text-[var(--color-primary)]" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {languageError && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLanguageError(null)} aria-hidden="true" />
              <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-card)] p-2.5 text-xs text-[var(--color-danger)] shadow-lg">
                {languageError}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate(notificationsPath)}
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
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingLogout(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmingLogout && (
        <ConfirmDialog
          title="Log out"
          message="Are you sure you want to logout?"
          confirmLabel="Logout"
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => {
            setConfirmingLogout(false);
            void signOut();
          }}
        />
      )}
    </header>
  );
}
