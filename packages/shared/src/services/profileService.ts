import { supabase } from "./supabaseClient";
import type { NotificationPreferenceGroup, ThemePreference } from "../types/profile";

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export interface UpdateOwnProfileInput {
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  /** Only passed when the email field actually changed — triggers Supabase's secure email-change flow (confirmation email, not an immediate switch). */
  email?: string;
}

/** Self-service profile edit — writes profiles.first_name/middle_name/last_name/contact_number/avatar and recomputes `name` in one UPDATE, so every other place that already reads profiles.name stays in sync. Role/status/farm/HR fields are never touched here — RLS + the trigger block them regardless. */
export async function updateOwnProfile(input: UpdateOwnProfileInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");

  const name = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" ").trim() || auth.user.email || "User";

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName || null,
      middle_name: input.middleName || null,
      last_name: input.lastName || null,
      contact_number: input.phone || null,
      name,
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
    })
    .eq("id", auth.user.id);
  if (error) throw error;

  if (input.email && input.email !== auth.user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: input.email });
    if (emailError) throw emailError;
  }
}

export interface UpdateOwnNicknameProfileInput {
  nickname: string;
  phone: string;
  avatar?: string;
  /** Only passed when the email field actually changed — triggers Supabase's secure email-change flow (confirmation email, not an immediate switch). */
  email?: string;
}

/** Farm-side self-service profile edit — writes profiles.nickname/contact_number/avatar and recomputes `name` from the nickname in one UPDATE, so every other place that already reads profiles.name (sidebar, greetings, staff lists) stays in sync. Role/status/farm/HR fields are never touched here — RLS + the trigger block them regardless. */
export async function updateOwnProfileNickname(input: UpdateOwnNicknameProfileInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");

  const name = input.nickname.trim() || auth.user.email || "User";

  const { error } = await supabase
    .from("profiles")
    .update({
      nickname: input.nickname.trim() || null,
      contact_number: input.phone || null,
      name,
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
    })
    .eq("id", auth.user.id);
  if (error) throw error;

  if (input.email && input.email !== auth.user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: input.email });
    if (emailError) throw emailError;
  }
}

/** Uploads to avatars/{user_id}/... and returns the public URL — bucket is public (a profile photo isn't sensitive), same tier as system-assets. */
export async function uploadAvatar(file: File): Promise<string> {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("Photo must be a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Photo must be 2MB or smaller.");
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");

  const extension = file.name.split(".").pop() ?? "jpg";
  const path = `${auth.user.id}/avatar-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

// ── Appearance & language preferences ────────────────────────────────────

export async function getMyPreferences(): Promise<{
  theme: ThemePreference;
  language: string;
  eggReminderEnabled: boolean;
} | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme, language, egg_reminder_enabled")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { theme: data.theme as ThemePreference, language: data.language, eggReminderEnabled: data.egg_reminder_enabled }
    : null;
}

/** Any subset of fields is a real partial update — Postgres's ON CONFLICT ... DO UPDATE only touches the columns actually passed, so setting just one field never resets the others. */
export async function updateMyPreferences(input: {
  theme?: ThemePreference;
  language?: string;
  eggReminderEnabled?: boolean;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: auth.user.id,
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.eggReminderEnabled !== undefined ? { egg_reminder_enabled: input.eggReminderEnabled } : {}),
  });
  if (error) throw error;
}

// ── Notification preferences ────────────────────────────────────────────

/** Missing rows mean "on" — callers should default any group not present in this list to enabled. */
export async function listMyNotificationPreferences(): Promise<Record<NotificationPreferenceGroup, boolean>> {
  const { data: auth } = await supabase.auth.getUser();
  const result = {} as Record<NotificationPreferenceGroup, boolean>;
  if (!auth.user) return result;

  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("category, enabled")
    .eq("user_id", auth.user.id);
  if (error) throw error;

  for (const row of data ?? []) {
    result[row.category as NotificationPreferenceGroup] = row.enabled;
  }
  return result;
}

export async function updateMyNotificationPreference(group: NotificationPreferenceGroup, enabled: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("user_notification_preferences")
    .upsert({ user_id: auth.user.id, category: group, enabled });
  if (error) throw error;
}
