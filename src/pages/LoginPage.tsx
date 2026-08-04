import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import BrandPanel from "../components/auth/BrandPanel";
import LoginForm from "../components/auth/LoginForm";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";
import RegisterForm from "../components/auth/RegisterForm";
import { useAuth } from "../context/AuthContext";
import { getHomePathForUser } from "../config/roleHome";

type AuthView = "login" | "forgot-password" | "register";

function MobileLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-2">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
          <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
        </svg>
      </div>
      <span
        className="font-bold text-xl"
        style={{ fontFamily: "var(--font-display)", color: "#2E7D32" }}
      >
        PoultryHub
      </span>
    </div>
  );
}

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const [view, setView] = useState<AuthView>("login");
  const [lastEmail, setLastEmail] = useState("");

  if (!isLoading && user) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  // Slide direction: forward = left, back = right
  const direction = view === "login" ? 1 : -1;

  return (
    <div
      className="min-h-screen w-full flex"
      style={{ backgroundColor: "#F8FAF8", fontFamily: "var(--font-sans)" }}
    >
      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] shrink-0">
        <BrandPanel />
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-6 text-center fade-in-up">
          <MobileLogo />
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
            Farm Intelligence Platform
          </p>
        </div>

        {/* Auth card */}
        <motion.div
          layout
          className="w-full bg-white overflow-hidden"
          style={{
            maxWidth: 420,
            borderRadius: 20,
            padding: "clamp(24px, 5vw, 36px)",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08), 0 24px 64px rgba(46,125,50,0.06)",
            border: "1px solid rgba(229,231,235,0.8)",
          }}
          role="main"
        >
          {/* Desktop logomark — only on login view */}
          {view === "login" && (
            <div className="hidden lg:flex items-center gap-2 mb-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
                  <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
                </svg>
              </div>
              <span
                className="font-semibold text-base"
                style={{ fontFamily: "var(--font-display)", color: "#2E7D32" }}
              >
                PoultryHub
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
                    className="font-bold text-2xl"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "#263238",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Welcome back
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                    Sign in to continue managing your poultry farm.
                  </p>
                </div>

                <LoginForm
                  onForgotPassword={(email) => {
                    setLastEmail(email);
                    setView("forgot-password");
                  }}
                />

                {/* Create account prompt */}
                <div
                  className="mt-5 flex items-center justify-center gap-1.5 rounded-[10px] py-3 px-4"
                  style={{ backgroundColor: "#F8FAF8", border: "1px solid #E5E7EB" }}
                >
                  <span className="text-sm" style={{ color: "#6B7280" }}>
                    Don't have an account?
                  </span>
                  <button
                    type="button"
                    onClick={() => setView("register")}
                    className="text-sm font-semibold transition-colors"
                    style={{ color: "#2E7D32" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1B5E20")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#2E7D32")}
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
                <ForgotPasswordForm
                  prefillEmail={lastEmail}
                  onBack={() => setView("login")}
                />
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
                <RegisterForm
                  onBack={() => setView("login")}
                  prefillEmail={lastEmail}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Bottom legal */}
        <p className="mt-8 text-center text-xs" style={{ color: "#D1D5DB" }}>
          © {new Date().getFullYear()} PoultryHub · All rights reserved ·{" "}
          <button type="button" className="hover:underline" style={{ color: "#D1D5DB" }}>
            Privacy
          </button>{" "}
          ·{" "}
          <button type="button" className="hover:underline" style={{ color: "#D1D5DB" }}>
            Terms
          </button>
        </p>
      </div>
    </div>
  );
}
