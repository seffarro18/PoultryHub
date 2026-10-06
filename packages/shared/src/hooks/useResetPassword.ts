import { useCallback, useState } from "react";
import { updatePasswordWithSupabase } from "../services/authService";
import type { ResetPasswordFormOutput } from "../validation/resetPasswordSchema";

type Status = "idle" | "loading" | "success" | "error";

interface UseResetPasswordReturn {
  status: Status;
  errorMessage: string | null;
  submit: (data: ResetPasswordFormOutput) => Promise<void>;
}

export function useResetPassword(): UseResetPasswordReturn {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(async (data: ResetPasswordFormOutput) => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      await updatePasswordWithSupabase(data.password);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("We couldn't update your password. Your link may have expired — request a new one.");
    }
  }, []);

  return { status, errorMessage, submit };
}
