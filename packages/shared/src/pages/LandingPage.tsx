import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bird,
  Building2,
  ChartLine,
  Egg,
  Mail,
  Monitor,
  Moon,
  Smartphone,
  Stethoscope,
  Sun,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSystemSettings } from "../context/SystemSettingsContext";
import FadeIn from "../components/motion/FadeIn";
import { StaggerGroup, StaggerItem } from "../components/motion/Stagger";
import type { User } from "../types/auth";

const FEATURES = [
  {
    icon: Egg,
    title: "Daily Egg Production",
    description: "Log daily egg collection — good, broken, and damaged — right from the field, in seconds.",
  },
  {
    icon: Bird,
    title: "Poultry Inventory",
    description: "Track flock counts, house and pen assignments, and stock changes in real time.",
  },
  {
    icon: Stethoscope,
    title: "Health & Mortality Records",
    description: "Log health observations and mortality events with cause, disposal method, and photo evidence.",
  },
  {
    icon: ChartLine,
    title: "Reports & Analytics",
    description: "Daily, weekly, monthly, and annual views with exportable reports — real numbers, not vanity charts.",
  },
];

const HOW_IT_WORKS = [
  { title: "Record", description: "Staff log daily egg collection, health checks, and inventory changes right from the field." },
  { title: "Review", description: "Farm Admin checks every entry — approve, reject with a note, or correct it before it's official." },
  { title: "Monitor", description: "Approved records update live dashboards — production, stock, and flock health, always current." },
  { title: "Analyze", description: "Super Admin compares trends and performance across every registered farm from one platform." },
];

const ROLES = [
  { icon: UserRound, label: "Staff", description: "Records daily poultry production." },
  { icon: Building2, label: "Farm Admin", description: "Monitors and manages the farm." },
  { icon: Monitor, label: "Super Admin", description: "Supervises all registered poultry farms from the desktop platform." },
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

interface LandingPageProps {
  /** Where to send an already-signed-in visitor — each app only knows its own roles' home routes. */
  getHomePathForUser: (user: User) => string;
}

export default function LandingPage({ getHomePathForUser }: LandingPageProps) {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const supportEmail = settings?.supportEmail;

  // Already signed in — go straight to the portal instead of showing marketing
  // copy with a "Go to Dashboard" button (same pattern LoginPage already uses).
  if (!isLoading && user) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  const primaryCtaLabel = "Get Started";
  const handlePrimaryCta = () => navigate("/login?view=register");

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.3 }}
        className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-semibold text-[var(--color-primary)]">PoultryHub</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!isLoading && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex h-11 items-center rounded-lg px-3.5 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </motion.header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <FadeIn delay={0}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                <Smartphone size={13} /> Mobile-Based Poultry Production Monitoring
              </span>
            </FadeIn>
            <FadeIn delay={0.08}>
              <h1 className="font-display mt-5 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                From daily egg collection to <span className="text-[var(--color-primary)]">smarter farm management</span>
              </h1>
            </FadeIn>
            <FadeIn delay={0.16}>
              <p className="mt-4 text-sm text-[var(--color-muted)] sm:text-base md:text-lg">
                PoultryHub helps staff log daily production, farm admins review and manage operations, and super admins
                oversee every farm — all from one connected system.
              </p>
            </FadeIn>
            <FadeIn delay={0.24}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={handlePrimaryCta}
                  whileHover={reducedMotion ? undefined : { y: -2 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg sm:w-auto"
                  style={{
                    background: "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
                    boxShadow: "0 4px 14px rgba(46,125,50,0.35)",
                  }}
                >
                  {primaryCtaLabel} <ArrowRight size={16} />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => navigate("/login")}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] sm:w-auto"
                >
                  Login
                </motion.button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8 sm:pb-16 md:pb-24">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-xl font-bold sm:text-2xl md:text-3xl">Everything your farm needs</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)] sm:text-base">
              One system for the whole flock — from the coop to the dashboard.
            </p>
          </div>

          <StaggerGroup className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <StaggerItem key={feature.title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <feature.icon size={20} strokeWidth={2} />
                </span>
                <h3 className="font-display mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{feature.description}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>

        {/* How it works */}
        <section className="border-y border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16 md:py-20">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-display text-xl font-bold sm:text-2xl md:text-3xl">How it works</h2>
              <p className="mt-3 text-sm text-[var(--color-muted)] sm:text-base">
                Nothing becomes an official number without a real review step in between.
              </p>
            </div>

            <div className="relative mx-auto mt-10 max-w-md">
              <span className="absolute left-5 top-5 bottom-5 w-px bg-[var(--color-border)]" aria-hidden="true" />
              <div className="flex flex-col gap-8">
                {HOW_IT_WORKS.map((step, i) => (
                  <div key={step.title} className="relative flex gap-4">
                    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="pt-1.5">
                      <h3 className="font-display text-base font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* User roles */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16 md:py-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-xl font-bold sm:text-2xl md:text-3xl">Built for every role</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)] sm:text-base">
              Everyone sees exactly what their role needs — nothing more, nothing less.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ROLES.map((role) => (
              <div
                key={role.label}
                className="flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <role.icon size={22} strokeWidth={2} />
                </span>
                <h3 className="font-display mt-4 text-sm font-bold uppercase tracking-wide">{role.label}</h3>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{role.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-5 py-10 text-center sm:px-8 sm:py-16 md:py-20">
          <h2 className="font-display text-xl font-bold sm:text-2xl md:text-3xl">Ready to manage your poultry farm smarter?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-muted)] sm:text-base">
            Sign in with your farm's account, or create one to get started.
          </p>
          <motion.button
            type="button"
            onClick={handlePrimaryCta}
            whileHover={reducedMotion ? undefined : { y: -2 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg"
            style={{
              background: "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
              boxShadow: "0 4px 14px rgba(46,125,50,0.35)",
            }}
          >
            {primaryCtaLabel} <ArrowRight size={16} />
          </motion.button>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-2">
              <Logo size={22} />
              <span className="font-display text-base font-semibold text-[var(--color-primary)]">PoultryHub</span>
            </div>
            <p className="max-w-xs text-sm text-[var(--color-muted)] sm:max-w-sm">
              Mobile-first poultry production monitoring — daily records, reviewed and approved, visible to every role
              that needs them.
            </p>
          </div>

          <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-[var(--color-muted)] sm:justify-start">
            <Link to="/login" className="hover:text-[var(--color-foreground)]">
              Login
            </Link>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
                <Mail size={14} /> Contact
              </a>
            ) : (
              <span className="flex items-center gap-1.5 opacity-60">
                <Mail size={14} /> Contact
              </span>
            )}
            <Link to="/privacy" className="hover:text-[var(--color-foreground)]">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[var(--color-foreground)]">
              Terms
            </Link>
          </nav>

          <div className="mt-8 border-t border-[var(--color-border)] pt-6 text-center text-xs text-[var(--color-muted)] sm:text-left">
            © {new Date().getFullYear()} PoultryHub. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
