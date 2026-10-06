import { useState, useCallback, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import {
  loginWithSupabase,
  loginWithOAuthProvider,
  resolveSessionUser,
  type OAuthProvider,
} from "../services/authService";
import type { LoginFormOutput } from "../validation/loginSchema";
import type { AuthError, User } from "../types/auth";

interface UseLoginReturn {
  isLoading: boolean;
  /** True only while the Google OAuth redirect is being prepared — separate from `isLoading` since it's a different button. */
  oauthLoading: boolean;
  error: string | null;
  errorCode: AuthError | null;
  user: User | null;
  submitLogin: (data: LoginFormOutput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  clearError: () => void;
}

export function useLogin(): UseLoginReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AuthError | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  // Picks up the session Supabase creates client-side once the OAuth
  // provider (Google) redirects back to this page.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      resolveSessionUser(session.user).then((resolvedUser) => {
        setUser(resolvedUser);
      });
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const submitLogin = useCallback(async (data: LoginFormOutput) => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const response = await loginWithSupabase({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });

      setUser(response.user);
    } catch (err: unknown) {
      const e = err as { code: AuthError; message: string };
      setErrorCode(e?.code ?? "server_error");
      setError(e?.message ?? "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithOAuth = useCallback(async (provider: OAuthProvider) => {
    setOauthLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      await loginWithOAuthProvider(provider);
      // Browser navigates away to the provider here; no further state to set
      // on success — oauthLoading intentionally stays true through the
      // redirect rather than flipping back to false first.
    } catch (err: unknown) {
      const e = err as { code: AuthError; message: string };
      setErrorCode(e?.code ?? "server_error");
      setError(e?.message ?? "An unexpected error occurred.");
      setOauthLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(() => loginWithOAuth("google"), [loginWithOAuth]);

  return {
    isLoading,
    oauthLoading,
    error,
    errorCode,
    user,
    submitLogin,
    loginWithGoogle,
    clearError,
  };
}
