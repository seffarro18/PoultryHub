import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { resolveSessionUser } from "../services/authService";
import { challengeAndVerifyMfa, getAuthenticatorAssuranceLevel, getSecuritySettings, listMfaFactors, recordLoginHistory, touchMySession } from "../services/securityService";
import { logLoginEvent, logLogoutEvent } from "../services/auditLogService";
import { parseUserAgent } from "../lib/userAgent";
import type { User } from "../types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

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

/** Gates the whole app behind a TOTP code when the session is at aal1 but an enrolled factor requires aal2 — shown after a password sign-in that has 2FA enabled, before any protected route renders. */
function MfaChallengeScreen({ factorId, onVerified, onCancel }: { factorId: string; onVerified: () => void; onCancel: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      await challengeAndVerifyMfa(factorId, code.trim());
      onVerified();
    } catch (err) {
      console.error("[AuthContext] MFA verify failed:", err);
      setError("That code didn't work. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <ShieldCheck size={26} strokeWidth={1.75} />
        </div>
        <h1 className="font-display mt-4 text-lg font-semibold text-[var(--color-foreground)]">Two-factor verification</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Enter the 6-digit code from your authenticator app.</p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="000000"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-center text-lg tracking-[0.3em] text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={verifying || code.trim().length < 6}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-70"
          >
            {verifying && <RefreshCw size={15} className="spinner" />}
            Verify
          </button>
          <button
            type="button"
            onClick={() => void onCancel()}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
          >
            <LogOut size={15} />
            Sign in as someone else
          </button>
        </form>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** aal2 required but not yet satisfied — find the verified TOTP factor to challenge. */
  const checkMfaGate = async () => {
    try {
      const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
      if (nextLevel === "aal2" && currentLevel !== "aal2") {
        const factors = await listMfaFactors();
        const factor = factors.find((f) => f.factor_type === "totp" && f.status === "verified");
        setMfaFactorId(factor?.id ?? null);
      } else {
        setMfaFactorId(null);
      }
    } catch (err) {
      console.error("[AuthContext] MFA assurance check failed:", err);
    }
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      resolveSessionUser(session.user)
        .then(async (resolvedUser) => {
          if (cancelled) return;
          setUser(resolvedUser);
          setAuthError(null);
          void touchMySession(resolvedUser.id);
          await checkMfaGate();
          if (!cancelled) setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setAuthError(err instanceof Error ? err.message : "Couldn't load your account.");
          setIsLoading(false);
        });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setUser(null);
        setMfaFactorId(null);
        return;
      }
      resolveSessionUser(session.user)
        .then(async (resolvedUser) => {
          if (cancelled) return;
          setUser(resolvedUser);
          setAuthError(null);
          // Only a genuinely new sign-in — never the page-refresh rehydration
          // (INITIAL_SESSION) or the silent background token refresh.
          if (event === "SIGNED_IN") {
            void recordLoginHistory(resolvedUser.id);
            const { device, browser, operatingSystem } = parseUserAgent();
            void logLoginEvent(device, browser, operatingSystem);
          }
          void touchMySession(resolvedUser.id);
          await checkMfaGate();
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
    // Logged before the session clears — the RPC needs auth.uid() to still resolve.
    await logLogoutEvent();
    await supabase.auth.signOut();
    setUser(null);
    setMfaFactorId(null);
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

  // Idle timeout — signs out and bounces to /login after N minutes of no
  // mouse/keyboard/touch activity, per the Super Admin's configured
  // session_timeout_minutes. Enforced by this app's own client code, same as
  // every real SPA idle-timeout; it can't reach into Supabase's own session
  // lifetime.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getSecuritySettings()
      .then((settings) => {
        if (cancelled) return;
        const timeoutMs = settings.sessionTimeoutMinutes * 60 * 1000;

        const resetTimer = () => {
          if (idleTimer.current) clearTimeout(idleTimer.current);
          idleTimer.current = setTimeout(() => {
            void signOut().then(() => navigate("/login?reason=idle", { replace: true }));
          }, timeoutMs);
        };

        ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));
        resetTimer();

        return () => {
          ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
          if (idleTimer.current) clearTimeout(idleTimer.current);
        };
      })
      .catch((err) => console.error("[AuthContext] failed to load session timeout:", err));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (authError) {
    return <SessionErrorScreen message={authError} onRetry={refreshUser} />;
  }

  if (user && mfaFactorId) {
    return (
      <MfaChallengeScreen
        factorId={mfaFactorId}
        onVerified={() => setMfaFactorId(null)}
        onCancel={signOut}
      />
    );
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
