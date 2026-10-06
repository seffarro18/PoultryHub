import { supabase } from "./supabaseClient";
import type { NotificationCategory } from "../types/notification";
import type {
  NotificationEventToggle,
  NotificationTemplateInput,
  NotificationTemplateRow,
  SmtpSettings,
  SmtpSettingsInput,
} from "../types/emailSettings";

interface SmtpSettingsRow {
  host: string | null;
  port: number | null;
  username: string | null;
  from_name: string;
  from_email: string | null;
  reply_to: string | null;
  encryption: SmtpSettings["encryption"];
  updated_at: string;
}

function mapSmtpRow(row: SmtpSettingsRow): SmtpSettings {
  return {
    host: row.host,
    port: row.port,
    username: row.username,
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyTo: row.reply_to,
    encryption: row.encryption,
    updatedAt: row.updated_at,
  };
}

/** The single SMTP reference row — Super Admin only, no password column (nothing in this app can use one). */
export async function getSmtpSettings(): Promise<SmtpSettings> {
  const { data, error } = await supabase
    .from("smtp_settings")
    .select("host, port, username, from_name, from_email, reply_to, encryption, updated_at")
    .eq("id", true)
    .single();
  if (error) throw error;
  return mapSmtpRow(data);
}

export async function updateSmtpSettings(input: SmtpSettingsInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("smtp_settings")
    .update({
      host: input.host,
      port: input.port,
      username: input.username,
      from_name: input.fromName,
      from_email: input.fromEmail,
      reply_to: input.replyTo,
      encryption: input.encryption,
      updated_by: auth.user?.id ?? null,
    })
    .eq("id", true);
  if (error) throw error;
}

/** One row per auto-triggered category — toggling one is read by the matching notify_* trigger function before it inserts. */
export async function listNotificationEventSettings(): Promise<NotificationEventToggle[]> {
  const { data, error } = await supabase.from("notification_settings").select("category, enabled");
  if (error) throw error;
  return (data ?? []).map((row) => ({ category: row.category as NotificationCategory, enabled: row.enabled }));
}

export async function updateNotificationEventSetting(category: NotificationCategory, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("notification_settings").update({ enabled }).eq("category", category);
  if (error) throw error;
}

/** Default title/message for the 4 manually-composed categories — pre-fills SendNotificationDrawer.tsx. */
export async function listNotificationTemplates(): Promise<NotificationTemplateRow[]> {
  const { data, error } = await supabase.from("notification_templates").select("category, title, message, updated_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    category: row.category as NotificationCategory,
    title: row.title,
    message: row.message,
    updatedAt: row.updated_at,
  }));
}

export async function updateNotificationTemplate(input: NotificationTemplateInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("notification_templates")
    .update({ title: input.title, message: input.message, updated_by: auth.user?.id ?? null })
    .eq("category", input.category);
  if (error) throw error;
}
