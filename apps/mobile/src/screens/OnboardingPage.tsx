import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Boxes, Egg, HeartPulse, Moon, Smartphone, Sun } from "lucide-react";
import { useTheme } from "@poultryhub/shared/context/ThemeContext";
import FadeIn from "@poultryhub/shared/components/motion/FadeIn";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import PoultryIllustration from "../components/onboarding/PoultryIllustration";
import { markOnboardingCompleted } from "../lib/onboarding";

const FEATURES = [
  {
    icon: Egg,
    title: "Daily Egg Production",
    description: "Record and monitor daily egg collection, including good, cracked, and damaged eggs.",
  },
  {
    icon: Boxes,
    title: "Poultry Inventory",
    description: "Monitor birds, feed, vitamins, supplies, and other farm inventory.",
  },
  {
    icon: HeartPulse,
    title: "Farm Health Monitoring",
    description: "Keep track of poultry health and mortality records for better farm management.",
  },
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

/**
 * Mobile-only first-launch screen (Farm Admin / Staff — Super Admin is
 * desktop-only and never sees this). Shown once: either action below marks
 * onboarding complete and moves on to Login, which already handles both
 * signing in and creating an account. Returning visitors skip straight past
 * this (see the route gate in App.tsx) instead of landing here again.
 */
export default function OnboardingPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const proceedToLogin = () => {
    markOnboardingCompleted();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div>
            <p className="font-display text-base font-semibold leading-tight text-[var(--color-primary)]">PoultryHub</p>
            <p className="text-[11px] leading-tight text-[var(--color-muted)]">Farm Production Monitoring</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <FadeIn delay={0.05} className="mx-auto mt-2 h-44 w-full max-w-xs sm:h-52">
          <PoultryIllustration />
        </FadeIn>

        <div className="mx-auto mt-4 max-w-md text-center">
          <FadeIn delay={0.15}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
              <Smartphone size={13} /> Mobile Poultry Management
            </span>
          </FadeIn>

          <FadeIn delay={0.22}>
            <h1 className="font-display mt-4 text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
              Smarter Poultry Farm
              <br />
              <span className="text-[var(--color-primary)]">Management Starts Here</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="mt-3 text-sm text-[var(--color-muted)] sm:text-base">
              Monitor production, inventory, flock health, and farm operations from one simple mobile app.
            </p>
          </FadeIn>
        </div>

        <StaggerGroup className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2.5" staggerDelay={0.08}>
          {FEATURES.map((feature) => (
            <StaggerItem
              key={feature.title}
              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <feature.icon size={18} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-[var(--color-foreground)]">{feature.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--color-muted)]">{feature.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn delay={0.5} className="mx-auto mt-6 w-full max-w-md">
          <motion.button
            type="button"
            onClick={proceedToLogin}
            whileHover={reducedMotion ? undefined : { y: -2 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-white shadow-lg"
            style={{
              background: "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
              boxShadow: "0 4px 14px rgba(46,125,50,0.35)",
            }}
          >
            Get Started <ArrowRight size={18} />
          </motion.button>

          <div className="mt-4 flex items-center justify-center gap-1.5 pb-2 text-sm">
            <span className="text-[var(--color-muted)]">Already have an account?</span>
            <button type="button" onClick={proceedToLogin} className="font-semibold text-[var(--color-primary)] hover:opacity-75">
              Login
            </button>
          </div>
        </FadeIn>
      </main>
    </div>
  );
}
