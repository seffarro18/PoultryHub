import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Loader2, Send, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
  type ForgotPasswordFormOutput,
} from "../../validation/forgotPasswordSchema";
import { useForgotPassword } from "../../hooks/useForgotPassword";
import EmailField from "./EmailField";

interface ForgotPasswordFormProps {
  /** Called when the user wants to return to the login form */
  onBack: () => void;
  /** Pre-fill the email if the user had typed one on the login form */
  prefillEmail?: string;
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({
  email,
  onBack,
  onResend,
  resending,
}: {
  email: string;
  onBack: () => void;
  onResend: () => void;
  resending: boolean;
}) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center gap-5 py-4"
    >
      {/* Animated envelope check */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 20 }}
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center bg-[var(--color-success)]/10 border-[1.5px] border-[var(--color-success)]/30"
      >
        <CheckCircle2 size={36} className="text-[var(--color-success)]" strokeWidth={1.8} />
        {/* Ripple */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-[1.5px] border-[var(--color-success)]"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }}
        />
      </motion.div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-bold text-xl text-[var(--color-foreground)]" style={{ fontFamily: "var(--font-display)" }}>
          Check your inbox
        </h3>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">We sent a password reset link to</p>
        <p className="text-sm font-semibold break-all text-[var(--color-primary)]">{email}</p>
      </div>

      {/* Info card */}
      <div className="w-full rounded-[10px] p-4 text-left bg-[var(--color-background)] border border-[var(--color-border)]">
        <p className="text-xs font-semibold mb-2 text-[var(--color-foreground)]">What to do next:</p>
        <ol className="text-xs space-y-1.5 text-[var(--color-muted)]">
          {[
            "Open the email from PoultryHub",
            "Click the Reset Password button",
            "Choose a new secure password",
            "Sign in with your new password",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full text-center flex items-center justify-center text-[10px] font-bold text-white mt-0.5 bg-[var(--color-primary)]">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Expiry note */}
      <p className="text-xs text-[var(--color-muted)]">
        The link expires in <span className="font-medium text-[var(--color-warning)]">30 minutes</span>. Check your spam folder if
        you don't see it.
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-2.5 w-full mt-1">
        <motion.button
          type="button"
          onClick={onResend}
          disabled={resending}
          whileHover={{ scale: resending ? 1 : 1.01 }}
          whileTap={{ scale: resending ? 1 : 0.98 }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed border-[1.5px] border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          {resending ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />}
          {resending ? "Resending…" : "Resend email"}
        </motion.button>

        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--color-primary)] transition-opacity hover:opacity-75"
        >
          <ArrowLeft size={14} />
          Back to Sign In
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ForgotPasswordForm({ onBack, prefillEmail = "" }: ForgotPasswordFormProps) {
  const { status, errorMessage, submittedEmail, submit, reset } = useForgotPassword();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ForgotPasswordFormData, unknown, ForgotPasswordFormOutput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: prefillEmail },
    mode: "onTouched",
  });

  // Sync prefillEmail if it changes after mount
  useEffect(() => {
    if (prefillEmail) setValue("email", prefillEmail);
  }, [prefillEmail, setValue]);

  const isLoading = status === "loading";
  const isResending = status === "loading" && submittedEmail !== null;

  if (status === "success" && submittedEmail) {
    return (
      <SuccessScreen
        email={submittedEmail}
        onBack={() => {
          reset();
          onBack();
        }}
        onResend={() => submit({ email: submittedEmail })}
        resending={isResending}
      />
    );
  }

  return (
    <motion.div
      key="form"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6 text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)] group"
        aria-label="Back to sign in"
      >
        <ArrowLeft size={15} />
        <span>Back to Sign In</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        {/* Icon badge */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-[var(--color-success)]/10 border-[1.5px] border-[var(--color-success)]/30">
          <Mail size={22} className="text-[var(--color-primary)]" strokeWidth={1.8} />
        </div>

        <h2
          className="font-bold text-2xl text-[var(--color-foreground)]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          Forgot password?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
          No worries. Enter the email address linked to your account and we'll send you a reset link.
        </p>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {status === "error" && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-[10px] p-3 mb-4 text-sm bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleSubmit(submit)} noValidate aria-label="Forgot password form" className="flex flex-col gap-4">
        <EmailField
          {...register("email")}
          label="Email Address"
          error={errors.email?.message}
          disabled={isLoading}
          aria-disabled={isLoading}
          placeholder="you@example.com"
        />

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: isLoading ? 1 : 1.01 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] font-semibold text-sm text-white transition-opacity duration-200 disabled:opacity-80 disabled:cursor-not-allowed mt-1"
          style={{
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="spinner" aria-hidden="true" />
              <span>Sending reset link…</span>
            </>
          ) : (
            <>
              <Send size={15} aria-hidden="true" />
              <span>Send Reset Link</span>
            </>
          )}
        </motion.button>
      </form>

      {/* Security note */}
      <p className="mt-5 text-center text-xs leading-relaxed text-[var(--color-muted)]">
        For security, the link expires in <span className="font-medium text-[var(--color-warning)]">30 minutes</span>. Only one
        active link is allowed at a time.
      </p>
    </motion.div>
  );
}
