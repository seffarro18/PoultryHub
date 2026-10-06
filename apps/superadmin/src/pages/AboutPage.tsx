import ProfilePageHeader from "../components/profile/ProfilePageHeader";

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <ProfilePageHeader title="About" />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
            <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
          </svg>
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold text-[var(--color-foreground)]">PoultryHub</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Version {__APP_VERSION__}</p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
          A mobile-web poultry production monitoring system — connecting farm staff, farm admins, and super admins in one
          system, from daily egg collection to platform-wide oversight.
        </p>
      </div>
    </div>
  );
}
