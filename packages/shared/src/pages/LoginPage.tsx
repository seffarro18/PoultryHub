import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import BrandPanel from "../components/auth/BrandPanel";
import LoginForm from "../components/auth/LoginForm";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";
import RegisterForm from "../components/auth/RegisterForm";
import { useAuth } from "../context/AuthContext";
import { useSystemSettings } from "../context/SystemSettingsContext";
import type { User } from "../types/auth";

type AuthView = "login" | "forgot-password" | "register";

function MobileLogo({ systemName, logoUrl }: { systemName: string; logoUrl: string | null }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-2">
      {logoUrl ? (
        <img src={logoUrl} alt={systemName} className="w-9 h-9 rounded-xl object-cover" />
      ) : (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-light))" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
            <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
          </svg>
        </div>
      )}
      <span className="font-bold text-xl text-[var(--color-primary)]" style={{ fontFamily: "var(--font-display)" }}>
        {systemName}
      </span>
    </div>
  );
}

interface LoginPageProps {
  /** Where to send an already-signed-in visitor or a freshly authenticated user — each app only knows its own roles' home routes. */
  getHomePathForUser: (user: User) => string;
}

export default function LoginPage({ getHomePathForUser }: LoginPageProps) {
  const { user, isLoading } = useAuth();
  const { settings } = useSystemSettings();
  const systemName = settings?.systemName || "PoultryHub";
  const logoUrl = settings?.logoUrl ?? null;
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<AuthView>(searchParams.get("view") === "register" ? "register" : "login");
  const [lastEmail, setLastEmail] = useState("");

  if (!isLoading && user) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  // Slide direction: forward = left, back = right
  const direction = view === "login" ? 1 : -1;

  return (
    <div
      className="min-h-screen w-full flex bg-[var(--color-background)]"
      style={
        {
          fontFamily: "var(--font-sans)",
          // Pinned to the light-theme values regardless of the app's dark/light
          // toggle — the auth screen stays white/light always, not just by
          // coincidence of default theme. Every color used inside this page
          // and its child forms (EmailField, PasswordField, LoginForm,
          // RegisterForm, ForgotPasswordForm, SocialLogin) resolves through
          // these custom properties, so overriding them here is enough —
          // no need to touch those components themselves.
          "--color-background": "#F8FAF8",
          "--color-foreground": "#263238",
          "--color-card": "#ffffff",
          "--color-primary": "#2E7D32",
          "--color-primary-light": "#66BB6A",
          "--color-border": "#E5E7EB",
          "--color-success": "#22C55E",
          "--color-warning": "#F59E0B",
          "--color-danger": "#EF4444",
          "--color-muted": "#6B7280",
          "--color-muted-bg": "#F3F4F6",
        } as React.CSSProperties
      }
    >
      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] shrink-0">
        <BrandPanel />
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-6 text-center fade-in-up">
          <MobileLogo systemName={systemName} logoUrl={logoUrl} />
          <p className="text-xs mt-1 text-[var(--color-muted)]">Farm Intelligence Platform</p>
        </div>

        {/* Auth card */}
        <motion.div
          layout
          className="w-full overflow-hidden bg-[var(--color-card)] border border-[var(--color-border)]"
          style={{
            maxWidth: 420,
            borderRadius: 20,
            padding: "clamp(24px, 5vw, 36px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.12)",
          }}
          role="main"
        >
          {/* Desktop logomark — only on login view */}
          {view === "login" && (
            <div className="hidden lg:flex items-center gap-2 mb-5">
              {logoUrl ? (
                <img src={logoUrl} alt={systemName} className="w-8 h-8 rounded-lg object-cover shrink-0" />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-light))" }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
                    <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
                  </svg>
                </div>
              )}
              <span className="font-semibold text-base text-[var(--color-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                {systemName}
              </span>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {/* ── Login ── */}
            {view === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 24 * direction }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-6">
                  <h2
                    className="font-bold text-2xl text-[var(--color-foreground)]"
                    style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
                  >
                    Welcome back
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">Sign in to continue managing your poultry farm.</p>
                </div>

                <LoginForm
                  onForgotPassword={(email) => {
                    setLastEmail(email);
                    setView("forgot-password");
                  }}
                  getHomePathForUser={getHomePathForUser}
                />

                {/* Create account prompt */}
                <div className="mt-5 flex items-center justify-center gap-1.5 rounded-[10px] py-3 px-4 bg-[var(--color-background)] border border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-muted)]">Don't have an account?</span>
                  <button
                    type="button"
                    onClick={() => setView("register")}
                    className="text-sm font-semibold text-[var(--color-primary)] transition-opacity hover:opacity-75"
                  >
                    Create account →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Forgot password ── */}
            {view === "forgot-password" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <ForgotPasswordForm prefillEmail={lastEmail} onBack={() => setView("login")} />
              </motion.div>
            )}

            {/* ── Register ── */}
            {view === "register" && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <RegisterForm onBack={() => setView("login")} prefillEmail={lastEmail} getHomePathForUser={getHomePathForUser} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Bottom legal */}
        <p className="mt-8 text-center text-xs text-[var(--color-muted)]">
          © {new Date().getFullYear()} {systemName} · All rights reserved ·{" "}
          <button type="button" className="hover:underline">
            Privacy
          </button>{" "}
          ·{" "}
          <button type="button" className="hover:underline">
            Terms
          </button>
        </p>
      </div>
    </div>
  );
}
