import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { loginSchema, type LoginFormData, type LoginFormOutput } from "../../validation/loginSchema";
import { useLogin } from "../../hooks/useLogin";
import type { User } from "../../types/auth";
import EmailField from "./EmailField";
import PasswordField from "./PasswordField";
import SocialLogin from "./SocialLogin";

interface LoginFormProps {
  /** Called when user clicks "Forgot password?" — passes current email value */
  onForgotPassword?: (email: string) => void;
  /** Where to send a signed-in user — each app only knows its own roles' home routes. */
  getHomePathForUser: (user: User) => string;
}

function SuccessState({ name, role }: { name: string; role: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4 py-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
        className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--color-success)]/10"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>
      <div>
        <p className="font-semibold text-lg text-[var(--color-foreground)]">Welcome back, {name}!</p>
        <p className="text-sm mt-1 text-[var(--color-muted)]">
          Signed in as <span className="font-medium text-[var(--color-primary)]">{role}</span>
        </p>
        <p className="text-xs mt-3 text-[var(--color-muted)]">Redirecting to your dashboard…</p>
      </div>
    </motion.div>
  );
}

export default function LoginForm({ onForgotPassword, getHomePathForUser }: LoginFormProps) {
  const { isLoading, oauthLoading, error, user, submitLogin, loginWithGoogle, clearError } = useLogin();
  const [shakeKey, setShakeKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => navigate(getHomePathForUser(user), { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [user, navigate, getHomePathForUser]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormData, unknown, LoginFormOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
    mode: "onTouched",
  });

  useEffect(() => {
    if (error) setShakeKey((k) => k + 1);
  }, [error]);

  if (user) {
    return <SuccessState name={user.name} role={user.role} />;
  }

  return (
    <div ref={formRef}>
      {/* Server error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-[10px] p-3 mb-4 text-sm bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={clearError}
              className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(submitLogin)} noValidate aria-label="Sign in form" className="flex flex-col gap-4">
        {/* Email */}
        <EmailField {...register("email")} error={errors.email?.message} disabled={isLoading} aria-disabled={isLoading} />

        {/* Password */}
        <PasswordField {...register("password")} error={errors.password?.message} disabled={isLoading} aria-disabled={isLoading} />

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register("rememberMe")}
              disabled={isLoading}
              className="rounded accent-[var(--color-primary)]"
              style={{ width: 16, height: 16 }}
              aria-label="Remember me"
            />
            <span className="text-sm text-[var(--color-muted)]">Remember me</span>
          </label>

          <button
            type="button"
            onClick={() => onForgotPassword?.(getValues("email"))}
            className="text-sm font-medium text-[var(--color-primary)] transition-opacity hover:opacity-75"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit button */}
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: isLoading ? 1 : 1.01 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          className="relative flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] font-semibold text-sm text-white transition-opacity duration-200 disabled:opacity-80 disabled:cursor-not-allowed mt-1"
          style={{
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="spinner" aria-hidden="true" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <LogIn size={16} aria-hidden="true" />
              <span>Sign In</span>
            </>
          )}
        </motion.button>
      </form>

      {/* OR divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs font-medium text-[var(--color-muted)]">OR</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* Social login */}
      <SocialLogin disabled={isLoading} loading={oauthLoading} onGoogleClick={loginWithGoogle} />
    </div>
  );
}
