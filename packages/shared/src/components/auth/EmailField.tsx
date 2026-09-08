import { forwardRef } from "react";
import { Mail } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface EmailFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const EmailField = forwardRef<HTMLInputElement, EmailFieldProps>(
  ({ error, label = "Email Address", ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[var(--color-foreground)]">
          {label}
        </label>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <Mail size={16} className={hasError ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"} />
          </span>

          <input
            ref={ref}
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={hasError}
            aria-describedby={hasError ? "email-error" : undefined}
            className={[
              "w-full pl-10 pr-4 py-2.5 text-sm rounded-[10px] outline-none transition-colors duration-200",
              "bg-[var(--color-background)] text-[var(--color-foreground)] border-[1.5px]",
              hasError
                ? "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]"
                : "border-[var(--color-border)] focus-visible:border-[var(--color-primary)]",
            ].join(" ")}
            placeholder={props.placeholder ?? "you@example.com"}
            {...props}
          />
        </div>

        {hasError && (
          <p id="email-error" role="alert" className="text-xs flex items-center gap-1 text-[var(--color-danger)]">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}
      </div>
    );
  }
);

EmailField.displayName = "EmailField";
export default EmailField;
