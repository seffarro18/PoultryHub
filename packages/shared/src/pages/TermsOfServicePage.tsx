import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Ban, KeyRound, Moon, RefreshCw, ShieldAlert, Sun, UserCog } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

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

function Block({ icon: Icon, title, children }: { icon: typeof Ban; title: string; children: React.ReactNode }) {
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

/** Public, unauthenticated terms of use — reachable from the landing page footer before signing in. */
export default function TermsOfServicePage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

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

        <h1 className="font-display mt-4 text-2xl font-bold sm:text-3xl">Terms of Use</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">The ground rules for using PoultryHub.</p>

        <div className="mt-8 flex flex-col gap-4">
          <Block icon={KeyRound} title="Accounts & access">
            Accounts are created and role-assigned by a Farm Admin or Super Admin — there's no public self-signup into
            an existing farm. You're responsible for keeping your own login credentials private and for everything
            done under your account; tell your Farm Admin or Super Admin right away if you suspect unauthorized
            access.
          </Block>

          <Block icon={UserCog} title="Acceptable use">
            Use PoultryHub only for legitimate farm record-keeping and management. Don't submit knowingly false
            production, inventory, health, or financial records, and don't attempt to access data, farms, or features
            outside what your role is permitted to see — that boundary is enforced by the system, and attempting to
            bypass it is a violation of these terms.
          </Block>

          <Block icon={ShieldAlert} title="Data ownership">
            Records you enter belong to the farm and organization you entered them for. Super Admin's platform-wide
            visibility exists to operate and support the system, not to claim ownership of any individual farm's
            data.
          </Block>

          <Block icon={RefreshCw} title="Changes to the service">
            Features, workflows, and these terms may change as PoultryHub evolves. We'll aim to keep this page current
            — continued use after a change means you accept the update.
          </Block>

          <Block icon={Ban} title="Suspension & termination">
            A Farm Admin or Super Admin may disable an account for policy violations, at a farm's request, or when
            someone leaves a farm's staff. Disabling an account doesn't delete the records it already submitted —
            those remain part of the farm's history.
          </Block>
        </div>
      </main>
    </div>
  );
}
