export type ThemePreference = "light" | "dark" | "system";

export interface SystemSettings {
  systemName: string;
  logoUrl: string | null;
  defaultTheme: ThemePreference;
  /** A locale identifier (e.g. "en-US", "fil-PH") — drives date/number formatting conventions only, not UI text translation. */
  language: string;
  timezone: string;
  dateFormat: string;
  /** Where the farm-side app's "Report a Problem" mailto: link points — null until a Super Admin sets it. */
  supportEmail: string | null;
  updatedAt: string;
}

export type SystemSettingsInput = Omit<SystemSettings, "updatedAt">;

export const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fil-PH", label: "Filipino (Philippines)" },
];

export const TIMEZONE_OPTIONS = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Europe/London",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
];

export const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
