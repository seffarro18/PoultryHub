import { AlertCircle, Check, X } from "lucide-react";

export type ToastType = "success" | "error";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

/** Fixed bottom-center stack — reuses theme.css's existing .fade-in-up keyframe rather than adding new animation CSS. */
export default function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fade-in-up pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border bg-[var(--color-card)] px-4 py-3 text-sm shadow-lg ${
            toast.type === "success" ? "border-[var(--color-success)]/30" : "border-[var(--color-danger)]/30"
          }`}
        >
          {toast.type === "success" ? (
            <Check size={16} className="success-pop shrink-0 text-[var(--color-success)]" />
          ) : (
            <AlertCircle size={16} className="shrink-0 text-[var(--color-danger)]" />
          )}
          <span className="flex-1 font-medium text-[var(--color-foreground)]">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded p-0.5 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
