import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Eye, Mail, Moon, ShieldCheck, Sun, Target } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useSystemSettings } from "../context/SystemSettingsContext";

function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
        <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
      </svg>
    </div>
  );
}

function Block({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon size={16} />
        </span>
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{title}</h2>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{children}</div>
    </div>
  );
}

/** Public, unauthenticated equivalent of each app's own account-scoped "Data Privacy" page — reachable from the landing page footer before signing in. */
export default function PrivacyPolicyPage() {
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const supportEmail = settings?.supportEmail;

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-8 sm:py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-semibold text-[var(--color-primary)]">PoultryHub</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <h1 className="font-display mt-4 text-2xl font-bold sm:text-3xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">How PoultryHub collects, uses, and protects your information.</p>

        <div className="mt-8 flex flex-col gap-4">
          <Block icon={Database} title="What we collect">
            Your name/nickname, email, phone number, and profile photo; your role and which farm you're assigned to; and
            the records you personally enter — egg production, poultry inventory, health and mortality records, feed and
            vitamin logs, and sales and expenses (if your role has access to those).
          </Block>

          <Block icon={Target} title="Why we collect it">
            Solely to run day-to-day farm operations — tracking production and inventory, monitoring flock health,
            keeping a record of who recorded or approved what, and letting a Farm Admin manage the staff assigned to
            their farm. Nothing here is used for advertising or sold to anyone.
          </Block>

          <Block icon={Eye} title="Who can see it">
            This isn't just a policy — it's enforced by the database itself (row-level security), not just hidden in
            the app. Staff can see their own farm's records relevant to their role. Farm Admins and Managers can see
            everything for their own assigned farm, and nothing from any other farm. Super Admins can see
            platform-wide data, since they're responsible for the whole system. No one outside PoultryHub has access.
          </Block>

          <Block icon={ShieldCheck} title="Your rights">
            Once signed in, you can update your own name/nickname, contact details, and photo any time from My
            Account. For anything you can't change yourself — like your role or farm assignment — ask your Farm
            Admin, or a Super Admin if you're a Farm Admin. This follows the Philippine Data Privacy Act's principles
            of transparency, legitimate purpose, and proportionality: we only collect what's needed to run the farm,
            and only the people who need it can see it.
          </Block>

          {supportEmail && (
            <Block icon={Mail} title="Questions about your data">
              <a href={`mailto:${supportEmail}`} className="font-medium text-[var(--color-primary)] hover:underline">
                {supportEmail}
              </a>
            </Block>
          )}
        </div>
      </main>
    </div>
  );
}
