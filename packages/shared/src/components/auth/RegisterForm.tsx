import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Users,
} from "lucide-react";
import type { UserRole, User as AuthUser } from "../../types/auth";
import {
  registerSchema,
  type RegisterFormData,
  type RegisterFormOutput,
} from "../../validation/registerSchema";
import { useRegister } from "../../hooks/useRegister";

interface RegisterFormProps {
  onBack: () => void;
  prefillEmail?: string;
  /** Where to send a newly-registered user — each app only knows its own roles' home routes. */
  getHomePathForUser: (user: AuthUser) => string;
}

// ─── Password strength meter ──────────────────────────────────────────────────
function strengthScore(pwd: string): 0 | 1 | 2 | 3 | 4 {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

const strengthMeta = [
  { label: "", color: "var(--color-border)" },
  { label: "Weak", color: "var(--color-danger)" },
  { label: "Fair", color: "var(--color-warning)" },
  { label: "Good", color: "var(--color-primary-light)" },
  { label: "Strong", color: "var(--color-primary)" },
] as const;

function PasswordStrength({ password }: { password: string }) {
  const score = strengthScore(password);
  if (!password) return null;
  const { label, color } = strengthMeta[score];

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-colors duration-200"
            style={{ backgroundColor: i <= score ? color : "var(--color-border)" }}
          />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color }}>
        {label}
      </p>
    </div>
  );
}

// ─── Role selector ─────────────────────────────────────────────────────────────
// "Super Admin" is deliberately not selectable here — self-registering into the
// platform-wide role would be a privilege-escalation hole. That account is
// provisioned separately.
type RegistrableRole = Extract<UserRole, "Farm Admin" | "Manager" | "Staff">;

const roleOptions: { value: RegistrableRole; label: string; icon: typeof ShieldAlert }[] = [
  { value: "Farm Admin", label: "Farm Admin", icon: ShieldAlert },
  { value: "Manager", label: "Manager", icon: UserCog },
  { value: "Staff", label: "Staff", icon: Users },
];

function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: RegistrableRole | undefined;
  onChange: (role: RegistrableRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account role">
      {roleOptions.map(({ value: role, label, icon: Icon }) => {
        const selected = value === role;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={[
              "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-[10px] border-[1.5px] text-sm font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              selected
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]",
            ].join(" ")}
          >
            <Icon size={15} strokeWidth={1.8} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center gap-5 py-4"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 20 }}
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center bg-[var(--color-success)]/10 border-[1.5px] border-[var(--color-success)]/30"
      >
        <CheckCircle2 size={36} className="text-[var(--color-success)]" strokeWidth={1.8} />
        <motion.div
          className="absolute inset-0 rounded-2xl border-[1.5px] border-[var(--color-success)]"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }}
        />
      </motion.div>

      <div className="flex flex-col gap-1">
        <h3 className="font-bold text-xl text-[var(--color-foreground)]" style={{ fontFamily: "var(--font-display)" }}>
          Account created!
        </h3>
        <p className="text-sm text-[var(--color-muted)]">
          Welcome to PoultryHub, <span className="font-semibold text-[var(--color-primary)]">{name}</span>.
        </p>
        <p className="text-xs mt-1 text-[var(--color-muted)]">Redirecting to your dashboard…</p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium mt-2 text-[var(--color-primary)] transition-opacity hover:opacity-75"
      >
        <ArrowLeft size={14} />
        Back to Sign In
      </button>
    </motion.div>
  );
}

// ─── Reusable labelled input wrapper ─────────────────────────────────────────
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs flex items-center gap-1 text-[var(--color-danger)]">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full pl-10 pr-4 py-2.5 text-sm rounded-[10px] outline-none transition-colors duration-200",
    "bg-[var(--color-background)] text-[var(--color-foreground)] border-[1.5px]",
    hasError
      ? "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]"
      : "border-[var(--color-border)] focus-visible:border-[var(--color-primary)]",
  ].join(" ");
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function RegisterForm({ onBack, prefillEmail = "", getHomePathForUser }: RegisterFormProps) {
  const { status, errorMessage, user, submit } = useRegister();
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (status !== "success" || !user) return;
    const timer = setTimeout(() => navigate(getHomePathForUser(user), { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [status, user, navigate, getHomePathForUser]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData, unknown, RegisterFormOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: prefillEmail,
      password: "",
      confirmPassword: "",
      role: "Staff",
      agreeToTerms: false,
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (prefillEmail) setValue("email", prefillEmail);
  }, [prefillEmail, setValue]);

  useEffect(() => {
    if (status === "error") setShakeKey((k) => k + 1);
  }, [status]);

  const passwordValue = watch("password", "");
  const roleValue = watch("role");
  const isLoading = status === "loading";

  if (status === "success" && user) {
    return <SuccessScreen name={user.name} onBack={onBack} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
        aria-label="Back to sign in"
      >
        <ArrowLeft size={15} />
        Back to Sign In
      </button>

      {/* Header */}
      <div className="mb-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-[var(--color-success)]/10 border-[1.5px] border-[var(--color-success)]/30">
          <UserPlus size={22} className="text-[var(--color-primary)]" strokeWidth={1.8} />
        </div>
        <h2
          className="font-bold text-2xl text-[var(--color-foreground)]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          Create account
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Join PoultryHub and start managing your farm today.</p>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {status === "error" && errorMessage && (
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-[10px] p-3 mb-4 text-sm bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(submit)} noValidate aria-label="Create account form" className="flex flex-col gap-3.5">
        {/* Full Name */}
        <Field id="fullName" label="Full Name" error={errors.fullName?.message}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <User size={16} className={errors.fullName ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"} />
            </span>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Juan dela Cruz"
              disabled={isLoading}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              className={inputClass(Boolean(errors.fullName))}
              {...register("fullName")}
            />
          </div>
        </Field>

        {/* Email */}
        <Field id="reg-email" label="Email Address" error={errors.email?.message}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Mail size={16} className={errors.email ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"} />
            </span>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="you@example.com"
              disabled={isLoading}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "reg-email-error" : undefined}
              className={inputClass(Boolean(errors.email))}
              {...register("email")}
            />
          </div>
        </Field>

        {/* Password */}
        <Field id="reg-password" label="Password" error={errors.password?.message}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Lock size={16} className={errors.password ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"} />
            </span>
            <input
              id="reg-password"
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              disabled={isLoading}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "reg-password-error" : undefined}
              className={`${inputClass(Boolean(errors.password))} pr-11`}
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPwd ? "Hide password" : "Show password"}
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <PasswordStrength password={passwordValue} />
        </Field>

        {/* Confirm Password */}
        <Field id="confirmPassword" label="Confirm Password" error={errors.confirmPassword?.message}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Lock size={16} className={errors.confirmPassword ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"} />
            </span>
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              disabled={isLoading}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              className={`${inputClass(Boolean(errors.confirmPassword))} pr-11`}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              aria-label={showConfirm ? "Hide password" : "Show password"}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* Role */}
        <Field id="role" label="Account Role" error={errors.role?.message}>
          <RoleSelector
            value={roleValue}
            disabled={isLoading}
            onChange={(role) => setValue("role", role, { shouldValidate: true, shouldDirty: true })}
          />
        </Field>

        {/* Terms */}
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={isLoading}
              aria-describedby={errors.agreeToTerms ? "terms-error" : undefined}
              className="mt-0.5 rounded shrink-0 accent-[var(--color-primary)]"
              style={{ width: 16, height: 16 }}
              {...register("agreeToTerms")}
            />
            <span className="text-xs leading-relaxed text-[var(--color-muted)]">
              I agree to the{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2 text-[var(--color-primary)] transition-opacity hover:opacity-75"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2 text-[var(--color-primary)] transition-opacity hover:opacity-75"
              >
                Privacy Policy
              </button>
            </span>
          </label>
          {errors.agreeToTerms && (
            <p id="terms-error" role="alert" className="text-xs flex items-center gap-1 text-[var(--color-danger)]">
              <span aria-hidden="true">⚠</span> {errors.agreeToTerms.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: isLoading ? 1 : 1.01 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] font-semibold text-sm text-white transition-opacity duration-200 disabled:opacity-80 disabled:cursor-not-allowed mt-0.5"
          style={{
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="spinner" aria-hidden="true" />
              <span>Creating account…</span>
            </>
          ) : (
            <>
              <UserPlus size={16} aria-hidden="true" />
              <span>Create Account</span>
            </>
          )}
        </motion.button>
      </form>

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-[var(--color-muted)]">
        <ShieldCheck size={13} />
        <span>Your data is encrypted and secure</span>
      </div>
    </motion.div>
  );
}
