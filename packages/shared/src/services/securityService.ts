import { supabase } from "./supabaseClient";
import { parseUserAgent } from "../lib/userAgent";
import type {
  FailedLoginAttempt,
  LoginAllowedResult,
  LoginHistoryEntry,
  PasswordValidationResult,
  SecuritySettings,
  SecuritySettingsInput,
} from "../types/security";
import type { UserSession } from "../types/profile";

interface SecuritySettingsRow {
  min_password_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_symbol: boolean;
  mfa_enabled: boolean;
  session_timeout_minutes: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  updated_at: string;
}

function mapSettingsRow(row: SecuritySettingsRow): SecuritySettings {
  return {
    minPasswordLength: row.min_password_length,
    requireUppercase: row.require_uppercase,
    requireLowercase: row.require_lowercase,
    requireNumber: row.require_number,
    requireSymbol: row.require_symbol,
    mfaEnabled: row.mfa_enabled,
    sessionTimeoutMinutes: row.session_timeout_minutes,
    maxFailedAttempts: row.max_failed_attempts,
    lockoutDurationMinutes: row.lockout_duration_minutes,
    updatedAt: row.updated_at,
  };
}

/** The single global security policy row — world-readable (see schema.sql), needed pre-auth by sign-up and the lockout check. */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  const { data, error } = await supabase
    .from("security_settings")
    .select("min_password_length, require_uppercase, require_lowercase, require_number, require_symbol, mfa_enabled, session_timeout_minutes, max_failed_attempts, lockout_duration_minutes, updated_at")
    .eq("id", true)
    .single();
  if (error) throw error;
  return mapSettingsRow(data);
}

export async function updateSecuritySettings(input: SecuritySettingsInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("security_settings")
    .update({
      min_password_length: input.minPasswordLength,
      require_uppercase: input.requireUppercase,
      require_lowercase: input.requireLowercase,
      require_number: input.requireNumber,
      require_symbol: input.requireSymbol,
      mfa_enabled: input.mfaEnabled,
      session_timeout_minutes: input.sessionTimeoutMinutes,
      max_failed_attempts: input.maxFailedAttempts,
      lockout_duration_minutes: input.lockoutDurationMinutes,
      updated_by: auth.user?.id ?? null,
    })
    .eq("id", true);
  if (error) throw error;
}

/** Checked by both the sign-up and reset-password forms — a real, additional floor on top of whatever Supabase's own project-level minimum already is. */
export function validatePassword(password: string, settings: SecuritySettings): PasswordValidationResult {
  const errors: string[] = [];
  if (password.length < settings.minPasswordLength) {
    errors.push(`Must be at least ${settings.minPasswordLength} characters`);
  }
  if (settings.requireUppercase && !/[A-Z]/.test(password)) errors.push("Must include an uppercase letter");
  if (settings.requireLowercase && !/[a-z]/.test(password)) errors.push("Must include a lowercase letter");
  if (settings.requireNumber && !/[0-9]/.test(password)) errors.push("Must include a number");
  if (settings.requireSymbol && !/[^A-Za-z0-9]/.test(password)) errors.push("Must include a symbol");
  return { valid: errors.length === 0, errors };
}

// ── Login history ────────────────────────────────────────────────────────

interface LoginHistoryRow {
  id: string;
  user_id: string;
  user_agent: string | null;
  created_at: string;
  profiles: { name: string; email: string } | null;
}

function mapLoginHistoryRow(row: LoginHistoryRow): LoginHistoryEntry {
  const { device, browser, operatingSystem } = parseUserAgent(row.user_agent ?? "");
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.name ?? null,
    userEmail: row.profiles?.email ?? null,
    userAgent: row.user_agent,
    status: "success",
    device,
    browser,
    operatingSystem,
    createdAt: row.created_at,
  };
}

interface FailedAttemptRowForHistory {
  id: string;
  email: string;
  user_agent: string | null;
  created_at: string;
}

function mapFailedAttemptToHistory(row: FailedAttemptRowForHistory): LoginHistoryEntry {
  const { device, browser, operatingSystem } = parseUserAgent(row.user_agent ?? "");
  return {
    id: row.id,
    userId: null,
    userName: null,
    userEmail: row.email,
    userAgent: row.user_agent,
    status: "failed",
    device,
    browser,
    operatingSystem,
    createdAt: row.created_at,
  };
}

const LOGIN_HISTORY_SELECT = "id, user_id, user_agent, created_at, profiles ( name, email )";

/** Super Admin oversight — every user's login history, RLS-scoped. */
export async function listLoginHistory(): Promise<LoginHistoryEntry[]> {
  const { data, error } = await supabase
    .from("login_history")
    .select(LOGIN_HISTORY_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as unknown as LoginHistoryRow[]).map(mapLoginHistoryRow);
}

/** A user's own login history, for their Profile page — merges successful sign-ins (login_history) with their own failed attempts (failed_login_attempts, keyed by email since a failed attempt has no user_id yet). */
export async function listMyLoginHistory(): Promise<LoginHistoryEntry[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return [];

  const [successes, failures] = await Promise.all([
    supabase
      .from("login_history")
      .select(LOGIN_HISTORY_SELECT)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("failed_login_attempts")
      .select("id, email, user_agent, created_at")
      .eq("email", auth.user.email)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (successes.error) throw successes.error;
  if (failures.error) throw failures.error;

  const entries = [
    ...((successes.data ?? []) as unknown as LoginHistoryRow[]).map(mapLoginHistoryRow),
    ...((failures.data ?? []) as FailedAttemptRowForHistory[]).map(mapFailedAttemptToHistory),
  ];
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
}

/** Called once from AuthContext on a real SIGNED_IN event — never on token refresh. */
export async function recordLoginHistory(userId: string): Promise<void> {
  const { error } = await supabase.from("login_history").insert({ user_id: userId, user_agent: navigator.userAgent });
  if (error) console.error("[securityService] recordLoginHistory failed:", error);
}

// ── Failed login attempts & lockout ─────────────────────────────────────

interface FailedLoginAttemptRow {
  id: string;
  email: string;
  user_agent: string | null;
  created_at: string;
}

export async function listFailedLoginAttempts(): Promise<FailedLoginAttempt[]> {
  const { data, error } = await supabase
    .from("failed_login_attempts")
    .select("id, email, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as FailedLoginAttemptRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

/** Called before attempting sign-in — blocks the attempt client-side if this email has too many recent failures. */
export async function checkLoginAllowed(email: string): Promise<LoginAllowedResult> {
  const { data, error } = await supabase.rpc("check_login_allowed", { p_email: email });
  if (error) throw error;
  const row = data?.[0];
  return { allowed: row?.allowed ?? true, retryAfterSeconds: row?.retry_after_seconds ?? 0 };
}

/** Called from the login form's own invalid-credentials branch — no session exists yet, so this goes through a security definer RPC rather than a direct insert. */
export async function recordFailedLoginAttempt(email: string): Promise<void> {
  const { error } = await supabase.rpc("record_failed_login_attempt", { p_email: email, p_user_agent: navigator.userAgent });
  if (error) console.error("[securityService] recordFailedLoginAttempt failed:", error);
}

// ── Two-factor authentication (Supabase Auth's native TOTP MFA) ─────────

export async function listMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.all;
}

/** Returns a QR code (SVG) + secret to show the user, plus the factor id needed to verify it. */
export async function enrollMfa() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCodeSvgDataUrl: `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`,
    secret: data.totp.secret,
  };
}

/** Completes enrollment — verifying the first code both confirms the factor and promotes the session to aal2. */
export async function verifyMfaEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (verifyError) throw verifyError;
}

export async function unenrollMfa(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/** Used by the post-login AAL2 gate — completes a TOTP challenge for an already-enrolled factor. */
export async function challengeAndVerifyMfa(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

export async function getAuthenticatorAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

/** Ends every other active session for the current user — real and safe, no elevated privileges needed (unlike revoking another user's session, which would require the service-role key). Also cleans up this device's own tracking rows in user_sessions so the list reflects it immediately. */
export async function signOutOtherSessions(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;

  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", auth.user.id)
      .neq("device_id", getDeviceId());
  }
}

// ── Active sessions ──────────────────────────────────────────────────────

const DEVICE_ID_KEY = "ph_device_id";
const LAST_SESSION_TOUCH_KEY = "ph_session_touch";
const SESSION_TOUCH_THROTTLE_MS = 5 * 60 * 1000;

/** Identifies "this browser install" — persisted client-side, not tied to any auth token so it survives sign-out/sign-in. */
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Upserts this device's row in user_sessions — called on sign-in and (throttled) on normal session rehydration, never more than once per SESSION_TOUCH_THROTTLE_MS. */
export async function touchMySession(userId: string): Promise<void> {
  const last = Number(sessionStorage.getItem(LAST_SESSION_TOUCH_KEY) ?? 0);
  if (Date.now() - last < SESSION_TOUCH_THROTTLE_MS) return;

  const { device, browser, operatingSystem } = parseUserAgent();
  const { error } = await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      device_id: getDeviceId(),
      device,
      browser,
      operating_system: operatingSystem,
      last_activity: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" }
  );
  if (error) {
    console.error("[securityService] touchMySession failed:", error);
    return;
  }
  sessionStorage.setItem(LAST_SESSION_TOUCH_KEY, String(Date.now()));
}

interface UserSessionRow {
  id: string;
  device_id: string;
  device: string;
  browser: string;
  operating_system: string;
  last_activity: string;
  created_at: string;
}

/** This user's own active sessions, most recently active first. */
export async function listMySessions(): Promise<UserSession[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("user_sessions")
    .select("id, device_id, device, browser, operating_system, last_activity, created_at")
    .eq("user_id", auth.user.id)
    .order("last_activity", { ascending: false });
  if (error) throw error;

  const deviceId = getDeviceId();
  return ((data ?? []) as UserSessionRow[]).map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    device: row.device,
    browser: row.browser,
    operatingSystem: row.operating_system,
    lastActivity: row.last_activity,
    createdAt: row.created_at,
    isCurrent: row.device_id === deviceId,
  }));
}
