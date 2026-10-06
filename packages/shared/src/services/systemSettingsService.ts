import { supabase } from "./supabaseClient";
import type { SystemSettings, SystemSettingsInput, ThemePreference } from "../types/systemSettings";

interface SystemSettingsRow {
  system_name: string;
  logo_url: string | null;
  default_theme: ThemePreference;
  language: string;
  timezone: string;
  date_format: string;
  support_email: string | null;
  updated_at: string;
}

function mapRow(row: SystemSettingsRow): SystemSettings {
  return {
    systemName: row.system_name,
    logoUrl: row.logo_url,
    defaultTheme: row.default_theme,
    language: row.language,
    timezone: row.timezone,
    dateFormat: row.date_format,
    supportEmail: row.support_email,
    updatedAt: row.updated_at,
  };
}

/** The single global settings row — world-readable (see schema.sql), needed pre-login for the logo/name on the login screen. */
export async function getSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("system_name, logo_url, default_theme, language, timezone, date_format, support_email, updated_at")
    .eq("id", true)
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateSystemSettings(input: SystemSettingsInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("system_settings")
    .update({
      system_name: input.systemName,
      logo_url: input.logoUrl,
      default_theme: input.defaultTheme,
      language: input.language,
      timezone: input.timezone,
      date_format: input.dateFormat,
      support_email: input.supportEmail,
      updated_by: auth.user?.id ?? null,
    })
    .eq("id", true);
  if (error) throw error;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

/**
 * Uploads a logo image to the system-assets bucket and returns its public URL.
 * Doesn't touch the settings row itself — the caller saves that as an
 * explicit step, so picking a file doesn't silently commit it.
 */
export async function uploadLogo(file: File): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new Error("Logo must be a PNG, JPEG, WebP, or SVG image.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be 2MB or smaller.");
  }

  const extension = file.name.split(".").pop() ?? "png";
  const path = `logo-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("system-assets").upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("system-assets").getPublicUrl(path);
  return data.publicUrl;
}
