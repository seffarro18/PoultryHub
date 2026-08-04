import { useState, useCallback } from "react";
import type { RegisterFormOutput } from "../validation/registerSchema";
import type { User } from "../types/auth";
import { storeTokens, signUpWithSupabase } from "../services/authService";

type RegisterStatus = "idle" | "loading" | "success" | "error";

interface UseRegisterReturn {
  status: RegisterStatus;
  errorMessage: string | null;
  user: User | null;
  submit: (data: RegisterFormOutput) => Promise<void>;
  reset: () => void;
}

export function useRegister(): UseRegisterReturn {
  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const submit = useCallback(async (data: RegisterFormOutput) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await signUpWithSupabase({
        email: data.email,
        password: data.password,
        name: data.fullName,
        role: data.role,
      });
      storeTokens(res.token, res.refreshToken, false);
      setUser(res.user);
      setStatus("success");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setStatus("error");
      setErrorMessage(e?.message ?? "Registration failed. Please try again.");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setUser(null);
  }, []);

  return { status, errorMessage, user, submit, reset };
}
