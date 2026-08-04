import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { AccountStatus, LoginCredentials, LoginResponse, AuthError, User, UserRole } from "../types/auth";

export type OAuthProvider = "google" | "facebook";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

const TOKEN_KEY = "ph_access_token";
const REFRESH_KEY = "ph_refresh_token";

/** Persists auth tokens based on remember-me preference. */
export function storeTokens(
  token: string,
  refreshToken: string,
  remember: boolean
): void {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  );
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

export async function loginRequest(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest", // basic CSRF signal
    },
    credentials: "same-origin",
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw mapError("invalid_credentials");
    if (status === 403) throw mapError("account_disabled");
    if (status >= 500) throw mapError("server_error");
    throw mapError("server_error");
  }

  const data: LoginResponse = await response.json();
  if (!data.success) throw mapError("invalid_credentials");
  return data;
}

function mapError(code: AuthError): { code: AuthError; message: string } {
  const messages: Record<AuthError, string> = {
    invalid_credentials: "Incorrect email or password. Please try again.",
    account_disabled:
      "Your account has been disabled. Contact your administrator.",
    network_error: "Unable to connect. Please check your internet connection.",
    server_error: "Something went wrong on our end. Please try again shortly.",
    session_expired: "Your session has expired. Please sign in again.",
    email_not_confirmed:
      "Please confirm your email address first. Check your inbox for the confirmation link.",
    email_taken: "An account with this email already exists.",
  };
  return { code, message: messages[code] };
}

/** Simulates a successful login for development/demo. */
export async function loginDemo(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  await new Promise((r) => setTimeout(r, 1400));

  // Simulate wrong password
  if (credentials.password === "wrongpass") {
    throw mapError("invalid_credentials");
  }

  return {
    success: true,
    token: "eyJhbGciOiJIUzI1NiJ9.demo_access_token",
    refreshToken: "eyJhbGciOiJIUzI1NiJ9.demo_refresh_token",
    user: {
      id: "demo-1",
      name: "Juan dela Cruz",
      email: credentials.email,
      role: "Farm Admin",
      status: "active",
      farmId: null,
    },
  };
}

/**
 * Builds our app's User from a Supabase auth user, preferring the `profiles`
 * table (populated by the on-signup trigger) and falling back to whatever
 * the auth provider (email form or Google/Facebook OAuth) supplied as metadata.
 */
export async function resolveSessionUser(authUser: SupabaseAuthUser): Promise<User> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, role, status, farm_id, avatar")
    .eq("id", authUser.id)
    .single();

  if (error) {
    // Don't fail closed to "pending" here — that's indistinguishable from a
    // genuinely-pending account and has caused real confusion (a schema
    // mismatch, like a column this query expects not existing yet, looked
    // identical to "not yet approved"). Surface it as a distinct error
    // instead; AuthContext shows a dedicated "couldn't load your account"
    // screen for this, not the pending-approval one.
    console.error("[authService] resolveSessionUser: profile fetch failed:", error);
    throw new Error("Couldn't load your account. Please try again in a moment.");
  }

  const metadata = authUser.user_metadata as {
    name?: string;
    full_name?: string;
    role?: UserRole;
    avatar_url?: string;
    picture?: string;
  };

  return {
    id: authUser.id,
    name: profile.name ?? metadata.name ?? metadata.full_name ?? authUser.email ?? "User",
    email: authUser.email ?? "",
    role: profile.role as UserRole,
    status: profile.status as AccountStatus,
    farmId: profile.farm_id,
    avatar: profile.avatar ?? metadata.avatar_url ?? metadata.picture,
  };
}

/** Authenticates against the Supabase users database. */
export async function loginWithSupabase(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      throw mapError("email_not_confirmed");
    }
    if (error.status === 400 || error.status === 401) {
      throw mapError("invalid_credentials");
    }
    console.error("[authService] loginWithSupabase failed:", error);
    throw mapError("server_error");
  }

  if (!data.session || !data.user) {
    throw mapError("server_error");
  }

  return {
    success: true,
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: await resolveSessionUser(data.user),
  };
}

/** Redirects the browser to the given OAuth provider's sign-in page. */
export async function loginWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw mapError("server_error");
}

/**
 * Emails a password-reset link. Supabase intentionally returns success even
 * for an unregistered email (avoids leaking which addresses have accounts),
 * so a non-network error here is a real configuration/delivery problem.
 */
export async function requestPasswordResetWithSupabase(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    console.error("[authService] requestPasswordResetWithSupabase failed:", error);
    throw mapError("server_error");
  }
}

/** Sets a new password for the session established by the reset-link redirect (see ResetPasswordPage). */
export async function updatePasswordWithSupabase(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("[authService] updatePasswordWithSupabase failed:", error);
    throw mapError("server_error");
  }
}

/** Registers a new user in the Supabase users database. */
export async function signUpWithSupabase(
  credentials: LoginCredentials & { name: string; role?: UserRole }
): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        name: credentials.name,
        role: credentials.role ?? "Staff",
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      throw mapError("email_taken");
    }
    if (error.status === 400 || error.status === 422) {
      throw mapError("invalid_credentials");
    }
    console.error("[authService] signUpWithSupabase failed:", error);
    throw mapError("server_error");
  }

  // Email confirmation is required by the project's Auth settings, so a new
  // sign-up succeeds but returns no session until the user confirms.
  if (!data.session || !data.user) {
    throw mapError("email_not_confirmed");
  }

  const role = credentials.role ?? "Staff";

  return {
    success: true,
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: data.user.id,
      name: credentials.name,
      email: data.user.email ?? credentials.email,
      role,
      // Mirrors handle_new_user()'s rule (see schema.sql).
      status: role === "Super Admin" ? "active" : "pending",
      farmId: null,
    },
  };
}
