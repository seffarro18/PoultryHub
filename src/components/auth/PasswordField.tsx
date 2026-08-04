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
        <label
          htmlFor={id}
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
            <Lock
              size={16}
              style={{ color: hasError ? "#EF4444" : "#9CA3AF" }}
            />
          </span>

          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className="w-full pl-10 pr-11 py-2.5 text-sm rounded-[10px] transition-all duration-200 outline-none"
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
            placeholder="••••••••"
            {...props}
          />

          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
            style={{ color: "#9CA3AF" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#2E7D32")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#9CA3AF")
            }
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {hasError && (
          <p
            id={errorId}
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

PasswordField.displayName = "PasswordField";
export default PasswordField;
