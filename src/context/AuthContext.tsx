import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { resolveSessionUser } from "../services/authService";
import type { User } from "../types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function SessionErrorScreen({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
          <AlertTriangle size={26} strokeWidth={1.75} />
        </div>
        <h1 className="font-display mt-4 text-lg font-semibold text-[var(--color-foreground)]">
          Couldn't load your account
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-70"
          >
            <RefreshCw size={15} className={retrying ? "spinner" : ""} />
            {retrying ? "Retrying…" : "Try again"}
          </button>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut().then(() => window.location.reload())}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      resolveSessionUser(session.user)
        .then((resolvedUser) => {
          if (cancelled) return;
          setUser(resolvedUser);
          setAuthError(null);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setAuthError(err instanceof Error ? err.message : "Couldn't load your account.");
          setIsLoading(false);
        });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      resolveSessionUser(session.user)
        .then((resolvedUser) => {
          if (cancelled) return;
          setUser(resolvedUser);
          setAuthError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setAuthError(err instanceof Error ? err.message : "Couldn't load your account.");
        });
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthError(null);
  };

  /** Re-resolves the current session's profile — used to pick up a status change (e.g. approval) without a full re-login. */
  const refreshUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setUser(null);
      return;
    }
    try {
      setUser(await resolveSessionUser(session.user));
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Couldn't load your account.");
    }
  };

  if (authError) {
    return <SessionErrorScreen message={authError} onRetry={refreshUser} />;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
