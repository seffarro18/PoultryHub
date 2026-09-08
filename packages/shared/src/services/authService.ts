import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { checkLoginAllowed, getSecuritySettings, recordFailedLoginAttempt, validatePassword } from "./securityService";
import { logPasswordChanged } from "./auditLogService";
import type { AccountStatus, LoginCredentials, LoginResponse, AuthError, User, UserRole } from "../types/auth";

export type OAuthProvider = "google";

function mapError(code: AuthError, message?: string): { code: AuthError; message: string } {
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
    account_locked: "Too many failed attempts. Please try again later.",
  };
  return { code, message: message ?? messages[code] };
}

/**
 * Builds our app's User from a Supabase auth user, preferring the `profiles`
 * table (populated by the on-signup trigger) and falling back to whatever
 * the auth provider (email form or Google OAuth) supplied as metadata.
 */
export async function resolveSessionUser(authUser: SupabaseAuthUser): Promise<User> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, role, status, farm_id, avatar, first_name, middle_name, last_name, nickname, contact_number, position, assigned_house_pen, created_at")
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
    firstName: profile.first_name ?? null,
    middleName: profile.middle_name ?? null,
    lastName: profile.last_name ?? null,
    nickname: profile.nickname ?? null,
    phone: profile.contact_number ?? null,
    position: profile.position ?? null,
    assignedHousePen: profile.assigned_house_pen ?? null,
    joinedAt: profile.created_at,
  };
}

/**
 * Authenticates against the Supabase users database.
 *
 * Lockout is enforced here, not inside Supabase Auth itself — there's no way
 * to reach into Supabase's own request pipeline from client code, so this is
 * a check this app's login form performs *before* attempting sign-in, backed
 * by the failed_login_attempts table populated below. See schema.sql for the
 * inherent trade-off (the check is keyed on email, and the anon key that
 * makes the check itself possible is public).
 */
export async function loginWithSupabase(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const lockout = await checkLoginAllowed(credentials.email).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
  if (!lockout.allowed) {
    const minutes = Math.ceil(lockout.retryAfterSeconds / 60);
    throw mapError("account_locked", `Too many failed attempts. Please try again in ${minutes} minute(s).`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      throw mapError("email_not_confirmed");
    }
    if (error.status === 400 || error.status === 401) {
      void recordFailedLoginAttempt(credentials.email);
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

/** Re-authenticates the current user with a candidate "current password" — used by the Profile page's Change Password form to confirm the caller actually knows it before allowing a change, protecting against a hijacked already-open session. Returns false for a wrong password rather than throwing; throws only for a genuine unexpected failure. */
export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) throw mapError("server_error");

  const { error } = await supabase.auth.signInWithPassword({ email: auth.user.email, password });
  if (!error) return true;
  if (error.status === 400 || error.status === 401) return false;
  console.error("[authService] verifyCurrentPassword failed:", error);
  throw mapError("server_error");
}

/** Sets a new password for the session established by the reset-link redirect (see ResetPasswordPage). */
export async function updatePasswordWithSupabase(newPassword: string): Promise<void> {
  const settings = await getSecuritySettings().catch(() => null);
  if (settings) {
    const check = validatePassword(newPassword, settings);
    if (!check.valid) throw mapError("invalid_credentials", check.errors.join(". "));
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("[authService] updatePasswordWithSupabase failed:", error);
    throw mapError("server_error");
  }
  void logPasswordChanged();
}

/** Registers a new user in the Supabase users database. */
export async function signUpWithSupabase(
  credentials: LoginCredentials & { name: string; role?: UserRole }
): Promise<LoginResponse> {
  const settings = await getSecuritySettings().catch(() => null);
  if (settings) {
    const check = validatePassword(credentials.password, settings);
    if (!check.valid) throw mapError("invalid_credentials", check.errors.join(". "));
  }

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
      firstName: null,
      middleName: null,
      lastName: null,
      nickname: null,
      phone: null,
      position: null,
      assignedHousePen: null,
      joinedAt: new Date().toISOString(),
    },
  };
}
