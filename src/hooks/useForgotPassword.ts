import { useState, useCallback } from "react";
import type { ForgotPasswordFormOutput } from "../validation/forgotPasswordSchema";
import { requestPasswordResetWithSupabase } from "../services/authService";

type ResetStatus = "idle" | "loading" | "success" | "error";

interface UseForgotPasswordReturn {
  status: ResetStatus;
  errorMessage: string | null;
  submittedEmail: string | null;
  submit: (data: ForgotPasswordFormOutput) => Promise<void>;
  reset: () => void;
}

export function useForgotPassword(): UseForgotPasswordReturn {
  const [status, setStatus] = useState<ResetStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const submit = useCallback(async (data: ForgotPasswordFormOutput) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      await requestPasswordResetWithSupabase(data.email);
      setSubmittedEmail(data.email);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage(
        "We couldn't process your request. Please try again shortly."
      );
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setSubmittedEmail(null);
  }, []);

  return { status, errorMessage, submittedEmail, submit, reset };
}
