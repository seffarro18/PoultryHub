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
        <label
          htmlFor="email"
          className="text-sm font-medium"
          style={{ color: "#374151" }}
        >
          {label}
        </label>

        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            <Mail
              size={16}
              style={{ color: hasError ? "#EF4444" : "#9CA3AF" }}
            />
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
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-[10px] transition-all duration-200 outline-none"
            style={{
              border: `1.5px solid ${hasError ? "#EF4444" : "#E5E7EB"}`,
              backgroundColor: hasError ? "#FFF5F5" : "#ffffff",
              color: "#263238",
              boxShadow: hasError
                ? "0 0 0 3px rgba(239,68,68,0.08)"
                : "0 1px 2px rgba(0,0,0,0.04)",
            }}
            onFocus={(e) => {
              if (!hasError) {
                e.currentTarget.style.border = "1.5px solid #2E7D32";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(46,125,50,0.12)";
              }
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = `1.5px solid ${hasError ? "#EF4444" : "#E5E7EB"}`;
              e.currentTarget.style.boxShadow = hasError
                ? "0 0 0 3px rgba(239,68,68,0.08)"
                : "0 1px 2px rgba(0,0,0,0.04)";
              props.onBlur?.(e);
            }}
            placeholder={props.placeholder ?? "you@example.com"}
            {...props}
          />
        </div>

        {hasError && (
          <p
            id="email-error"
            role="alert"
            className="text-xs flex items-center gap-1"
            style={{ color: "#EF4444" }}
          >
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
