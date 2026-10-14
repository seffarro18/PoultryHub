import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import ToastViewport, { type ToastAction, type ToastItem, type ToastType } from "./Toast";

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  /** Incoming-alert style toast (e.g. a newly delivered notification), optionally with a "View" action. */
  info: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;
const INFO_AUTO_DISMISS_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message, action }]);
      setTimeout(() => dismiss(id), type === "info" ? INFO_AUTO_DISMISS_MS : AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    info: (message, action) => push("info", message, action),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** Transient page-level feedback after an action completes — success/error toasts, auto-dismissed. Not for inline form validation, which should stay next to the field being corrected. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
