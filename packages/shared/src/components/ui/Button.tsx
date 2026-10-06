import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "success";
type ButtonSize = "sm" | "md";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of the icon and disables the button — for an in-flight async action. */
  loading?: boolean;
  /** Replaces `children` while `loading` is true, e.g. "Saving…" for a "Save" button — omit to keep the same label during the async action. */
  loadingText?: string;
  /** Leading icon, hidden while loading (the spinner takes its place). */
  icon?: LucideIcon;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white shadow-sm hover:brightness-95 hover:shadow-md active:brightness-90",
  secondary: "text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]",
  outline:
    "border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]",
  destructive: "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10",
  success: "text-[var(--color-success)] hover:bg-[var(--color-success)]/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "gap-1 px-2.5 py-1.5 text-xs",
  md: "gap-2 px-4 py-2 text-sm",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14 };

/**
 * Shared button — every module should reach for this instead of hand-rolling
 * `<button className="rounded-lg bg-[var(--color-primary)] ...">`, which is
 * how buttons across this app ended up with slightly different padding/
 * hover/disabled treatments per page. Variant/size cover every button shape
 * seen across the app so far (a big primary form-submit and a small inline
 * row action both fit); reach for a one-off className only for a genuinely
 * new shape, not to avoid using this component.
 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  icon: Icon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const reducedMotion = useReducedMotion();
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      whileTap={reducedMotion || isDisabled ? undefined : { scale: 0.97 }}
      whileHover={!reducedMotion && !isDisabled && variant === "primary" ? { y: -1 } : undefined}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={[
        "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 size={ICON_SIZE[size]} className="spinner" />
      ) : Icon ? (
        <Icon size={ICON_SIZE[size]} />
      ) : null}
      {loading && loadingText ? loadingText : children}
    </motion.button>
  );
}
