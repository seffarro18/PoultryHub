import type { NotificationCategory } from "./notification";

export type SmtpEncryption = "none" | "ssl" | "tls";

export interface SmtpSettings {
  host: string | null;
  port: number | null;
  username: string | null;
  fromName: string;
  fromEmail: string | null;
  replyTo: string | null;
  encryption: SmtpEncryption;
  updatedAt: string;
}

export type SmtpSettingsInput = Omit<SmtpSettings, "updatedAt">;

/** The 8 categories with a real Postgres trigger generating them today — the only ones a toggle can honestly affect. */
export const AUTO_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "new_user_registration",
  "new_staff_account",
  "mortality_alert",
  "low_inventory",
  "low_egg_production",
  "low_feed_stock",
  "low_vitamin_stock",
  "expiring_medicine",
];

export interface NotificationEventToggle {
  category: NotificationCategory;
  enabled: boolean;
}

/** The 4 categories a Farm Admin/Manager composes by hand in SendNotificationDrawer.tsx. */
export const MANUAL_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "task_assignment",
  "feed_schedule_reminder",
  "vaccination_reminder",
  "production_reminder",
];

export interface NotificationTemplateRow {
  category: NotificationCategory;
  title: string;
  message: string;
  updatedAt: string;
}

export type NotificationTemplateInput = Pick<NotificationTemplateRow, "category" | "title" | "message">;
