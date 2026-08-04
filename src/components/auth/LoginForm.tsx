import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { loginSchema, type LoginFormData, type LoginFormOutput } from "../../validation/loginSchema";
import { useLogin } from "../../hooks/useLogin";
import { getHomePathForUser } from "../../config/roleHome";
import EmailField from "./EmailField";
import PasswordField from "./PasswordField";
import SocialLogin from "./SocialLogin";

interface LoginFormProps {
  /** Called when user clicks "Forgot password?" — passes current email value */
  onForgotPassword?: (email: string) => void;
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
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "#F0FDF4" }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2E7D32"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>
      <div>
        <p className="font-semibold text-lg" style={{ color: "#263238" }}>
          Welcome back, {name}!
        </p>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          Signed in as{" "}
          <span className="font-medium" style={{ color: "#2E7D32" }}>
            {role}
          </span>
        </p>
        <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
          Redirecting to your dashboard…
        </p>
      </div>
    </motion.div>
  );
}

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { isLoading, error, user, submitLogin, loginWithGoogle, loginWithFacebook, clearError } = useLogin();
  const [shakeKey, setShakeKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => navigate(getHomePathForUser(user), { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [user, navigate]);

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
            className="shake flex items-start gap-2.5 rounded-[10px] p-3 mb-4 text-sm"
            style={{
              backgroundColor: "#FFF5F5",
              border: "1px solid #FECACA",
              color: "#B91C1C",
            }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={clearError}
              className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: "#B91C1C" }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit(submitLogin)}
        noValidate
        aria-label="Sign in form"
        className="flex flex-col gap-4"
      >
        {/* Email */}
        <EmailField
          {...register("email")}
          error={errors.email?.message}
          disabled={isLoading}
          aria-disabled={isLoading}
        />

        {/* Password */}
        <PasswordField
          {...register("password")}
          error={errors.password?.message}
          disabled={isLoading}
          aria-disabled={isLoading}
        />

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register("rememberMe")}
              disabled={isLoading}
              className="rounded"
              style={{ accentColor: "#2E7D32", width: 16, height: 16 }}
              aria-label="Remember me"
            />
            <span className="text-sm" style={{ color: "#6B7280" }}>
              Remember me
            </span>
          </label>

          <button
            type="button"
            onClick={() => onForgotPassword?.(getValues("email"))}
            className="text-sm font-medium transition-colors"
            style={{ color: "#2E7D32" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1B5E20")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#2E7D32")}
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
          className="relative flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] font-semibold text-sm text-white transition-all duration-200 disabled:opacity-80 disabled:cursor-not-allowed mt-1"
          style={{
            background: isLoading
              ? "#4CAF50"
              : "linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)",
            boxShadow: isLoading
              ? "none"
              : "0 4px 14px rgba(46,125,50,0.35)",
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
        <div className="flex-1 h-px" style={{ backgroundColor: "#E5E7EB" }} />
        <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
          OR
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "#E5E7EB" }} />
      </div>

      {/* Social login */}
      <SocialLogin
        disabled={isLoading}
        onGoogleClick={loginWithGoogle}
        onFacebookClick={loginWithFacebook}
      />
    </div>
  );
}
