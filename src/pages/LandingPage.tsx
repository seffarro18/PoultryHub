import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ChartLine,
  CircleCheckBig,
  Egg,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getHomePathForUser } from "../config/roleHome";

const FEATURES = [
  {
    icon: Egg,
    title: "Daily Production Tracking",
    description:
      "Staff log daily egg collection — good, broken, and damaged — with a real approve/reject review workflow before it counts as official.",
  },
  {
    icon: Building2,
    title: "Multi-Farm Oversight",
    description: "Super Admin compares performance across every farm — trends, totals, and top/low performers, in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Super Admin, Farm Admin, Manager, and Staff each see exactly what their role needs — enforced at the database, not just hidden buttons.",
  },
  {
    icon: UsersRound,
    title: "Staff Management",
    description: "Farm Admin adds and manages their own farm's staff — activate, deactivate, and reset access without waiting on anyone else.",
  },
  {
    icon: ChartLine,
    title: "Reports & Analytics",
    description: "Daily, weekly, monthly, and annual views with exportable reports — real numbers, not vanity charts.",
  },
  {
    icon: Smartphone,
    title: "Built for the Farm, Not the Desk",
    description: "A bottom nav on your phone, a full dashboard on a laptop — the same data, the layout that fits your hands.",
  },
];

const WORKFLOW_STEPS = [
  { title: "Staff records", description: "Daily egg collection is logged from the field, in seconds." },
  { title: "Farm Admin reviews", description: "Approve, reject with a comment, or correct — before it's official." },
  { title: "Super Admin oversees", description: "Cross-farm trends and comparisons, always read-only." },
];

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

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const primaryCtaLabel = user ? "Go to Dashboard" : "Get Started";
  const handlePrimaryCta = () => navigate(user ? getHomePathForUser(user) : "/login");

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-semibold text-[var(--color-primary)]">PoultryHub</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!isLoading && (
              <button
                type="button"
                onClick={() => navigate(user ? getHomePathForUser(user) : "/login")}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
              >
                {user ? "Dashboard" : "Login"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
              <Workflow size={13} /> Mobile-Web Poultry Production Monitoring
            </span>
            <h1 className="font-display mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              From daily egg collection to <span className="text-[var(--color-primary)]">platform-wide oversight</span>
            </h1>
            <p className="mt-4 text-base text-[var(--color-muted)] sm:text-lg">
              PoultryHub connects farm staff, farm admins, and super admins in one system — real production data,
              reviewed and approved before it counts, visible at every level that needs it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] sm:w-auto"
                style={{
                  background: "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
                  boxShadow: "0 4px 14px rgba(46,125,50,0.35)",
                }}
              >
                {primaryCtaLabel} <ArrowRight size={16} />
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] sm:w-auto"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <feature.icon size={20} strokeWidth={2} />
                </span>
                <h3 className="font-display mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">One record, three checkpoints</h2>
              <p className="mt-3 text-sm text-[var(--color-muted)] sm:text-base">
                Nothing becomes an "official" number without a real review step in between.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step.title} className="flex flex-col items-center text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="font-display mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 max-w-xs text-sm text-[var(--color-muted)]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <CircleCheckBig size={32} className="mx-auto text-[var(--color-primary)]" />
          <h2 className="font-display mt-4 text-2xl font-bold sm:text-3xl">Ready to see it running?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-muted)] sm:text-base">
            Sign in with your farm's account, or create one to get started.
          </p>
          <button
            type="button"
            onClick={handlePrimaryCta}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg"
            style={{
              background: "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
              boxShadow: "0 4px 14px rgba(46,125,50,0.35)",
            }}
          >
            {primaryCtaLabel} <ArrowRight size={16} />
          </button>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-[var(--color-muted)] sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} PoultryHub. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="font-medium text-[var(--color-foreground)]">PoultryHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
