import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordFormData, type ResetPasswordFormOutput } from "../validation/resetPasswordSchema";
import { useResetPassword } from "../hooks/useResetPassword";
import { supabase } from "../services/supabaseClient";
import PasswordField from "../components/auth/PasswordField";

type LinkState = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const { status, errorMessage, submit } = useResetPassword();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData, unknown, ResetPasswordFormOutput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  // The recovery link redirects here with a token in the URL that
  // supabase-js parses automatically into a session — we just need to know
  // whether that succeeded before letting anyone submit a new password.
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setLinkState(session ? "valid" : "invalid");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setLinkState("valid");
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }, 1800);
    return () => clearTimeout(timer);
  }, [status, navigate]);

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5 py-10"
      style={{ backgroundColor: "#F8FAF8", fontFamily: "var(--font-sans)" }}
    >
      <motion.div
        layout
        className="w-full bg-white overflow-hidden"
        style={{
          maxWidth: 420,
          borderRadius: 20,
          padding: "clamp(24px, 5vw, 36px)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08), 0 24px 64px rgba(46,125,50,0.06)",
          border: "1px solid rgba(229,231,235,0.8)",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {linkState === "checking" && (
            <motion.div key="checking" className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 size={22} className="spinner" style={{ color: "#2E7D32" }} />
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Verifying your reset link…
              </p>
            </motion.div>
          )}

          {linkState === "invalid" && (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "#FFF5F5", border: "1.5px solid #FECACA" }}
              >
                <ShieldAlert size={26} style={{ color: "#EF4444" }} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="font-bold text-xl" style={{ fontFamily: "var(--font-display)", color: "#263238" }}>
                  Link expired or invalid
                </h2>
                <p className="mt-1.5 text-sm" style={{ color: "#6B7280" }}>
                  Reset links expire after 30 minutes and can only be used once. Request a new one from the sign-in
                  page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="mt-1 w-full rounded-[10px] py-2.5 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)" }}
              >
                Back to Sign In
              </button>
            </motion.div>
          )}

          {linkState === "valid" && status === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
              >
                <CheckCircle2 size={26} style={{ color: "#2E7D32" }} strokeWidth={1.8} />
              </div>
              <h2 className="font-bold text-xl" style={{ fontFamily: "var(--font-display)", color: "#263238" }}>
                Password updated
              </h2>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Redirecting you to sign in…
              </p>
            </motion.div>
          )}

          {linkState === "valid" && status !== "success" && (
            <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
              >
                <KeyRound size={22} style={{ color: "#2E7D32" }} strokeWidth={1.8} />
              </div>
              <h2
                className="font-bold text-2xl"
                style={{ fontFamily: "var(--font-display)", color: "#263238", letterSpacing: "-0.02em" }}
              >
                Set a new password
              </h2>
              <p className="mt-1.5 text-sm" style={{ color: "#6B7280" }}>
                Choose a new password for your account.
              </p>

              <AnimatePresence>
                {status === "error" && errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    role="alert"
                    aria-live="assertive"
                    className="mt-4 flex items-start gap-2.5 rounded-[10px] p-3 text-sm"
                    style={{ backgroundColor: "#FFF5F5", border: "1px solid #FECACA", color: "#B91C1C" }}
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit(submit)} noValidate className="mt-5 flex flex-col gap-4">
                <PasswordField
                  id="new-password"
                  label="New Password"
                  autoComplete="new-password"
                  {...register("password")}
                  error={errors.password?.message}
                  disabled={status === "loading"}
                />
                <PasswordField
                  id="confirm-new-password"
                  label="Confirm New Password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                  error={errors.confirmPassword?.message}
                  disabled={status === "loading"}
                />

                <motion.button
                  type="submit"
                  disabled={status === "loading"}
                  whileHover={{ scale: status === "loading" ? 1 : 1.01 }}
                  whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
                  className="mt-1 flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-80"
                  style={{
                    background: status === "loading" ? "#4CAF50" : "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
                  }}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 size={16} className="spinner" /> Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
