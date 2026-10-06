import { forwardRef, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  id?: string;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ error, label = "Password", id = "password", ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const hasError = Boolean(error);
    const errorId = `${id}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-foreground)]">
          {label}
        </label>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <Lock size={16} className={hasError ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"} />
          </span>

          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={[
              "w-full pl-10 pr-11 py-2.5 text-sm rounded-[10px] outline-none transition-colors duration-200",
              "bg-[var(--color-background)] text-[var(--color-foreground)] border-[1.5px]",
              hasError
                ? "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]"
                : "border-[var(--color-border)] focus-visible:border-[var(--color-primary)]",
            ].join(" ")}
            placeholder="••••••••"
            {...props}
          />

          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {hasError && (
          <p id={errorId} role="alert" className="text-xs flex items-center gap-1 text-[var(--color-danger)]">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";
export default PasswordField;
