import { useEffect, useState } from "react";
import { Loader2, Save, Upload, X } from "lucide-react";
import { useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import { updateSystemSettings, uploadLogo } from "@poultryhub/shared/services/systemSettingsService";
import { formatDate } from "../lib/dateFormat";
import { DATE_FORMAT_OPTIONS, LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from "@poultryhub/shared/types/systemSettings";
import type { SystemSettingsInput, ThemePreference } from "@poultryhub/shared/types/systemSettings";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function SystemGeneralSettingsPage() {
  const { settings, refresh } = useSystemSettings();
  const [form, setForm] = useState<SystemSettingsInput | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        systemName: settings.systemName,
        logoUrl: settings.logoUrl,
        defaultTheme: settings.defaultTheme,
        language: settings.language,
        timezone: settings.timezone,
        dateFormat: settings.dateFormat,
        supportEmail: settings.supportEmail,
      });
    }
  }, [settings, form]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadLogo(file);
      setForm((prev) => (prev ? { ...prev, logoUrl: url } : prev));
    } catch (err) {
      console.error("[SystemGeneralSettingsPage] logo upload failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't upload that logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateSystemSettings(form);
      await refresh();
      setSaved(true);
    } catch (err) {
      console.error("[SystemGeneralSettingsPage] save failed:", err);
      setError("Couldn't save these settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading system settings…
      </div>
    );
  }

  const datePreview = formatDate(new Date(), { timezone: form.timezone, dateFormat: form.dateFormat });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">General Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          System-wide branding, appearance, and locale defaults — applied across both the Super Admin and Farm portals.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
        {saved && (
          <p className="rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-primary)]">Settings saved.</p>
        )}

        <Section title="System Name" description="Shown in the sidebar, the login screen, and the browser tab title.">
          <input
            type="text"
            value={form.systemName}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, systemName: e.target.value } : prev))}
            className={inputClass}
            required
            maxLength={60}
          />
        </Section>

        <Section
          title="Logo"
          description="PNG, JPEG, WebP, or SVG, up to 2MB. Replaces the default egg mark in the sidebar and login screen."
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-[var(--color-muted)]">Default</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
                {uploading ? <Loader2 size={14} className="spinner" /> : <Upload size={14} />}
                {form.logoUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                  disabled={uploading}
                />
              </label>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => (prev ? { ...prev, logoUrl: null } : prev))}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                >
                  <X size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Default Theme"
          description="The starting theme for anyone who hasn't picked light or dark for themselves yet — doesn't override an existing personal choice."
        >
          <select
            value={form.defaultTheme}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, defaultTheme: e.target.value as ThemePreference } : prev))}
            className={inputClass}
          >
            <option value="system">Match device (system)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Section>

        <Section
          title="Language"
          description="Sets the locale used for date and number formatting only — button labels and headings stay in English. Full UI translation isn't built."
        >
          <select
            value={form.language}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, language: e.target.value } : prev))}
            className={inputClass}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Timezone" description="Used wherever dates and times are formatted through this app's shared formatting utility.">
          <select
            value={form.timezone}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, timezone: e.target.value } : prev))}
            className={inputClass}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Section>

        <Section
          title="Support Email"
          description="Where the farm-side app's Help & Support → Report a Problem opens an email to. Leave blank to hide that option there."
        >
          <input
            type="email"
            value={form.supportEmail ?? ""}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, supportEmail: e.target.value || null } : prev))}
            placeholder="support@example.com"
            className={inputClass}
          />
        </Section>

        <Section title="Date Format" description={`Today's date in this format: ${datePreview}`}>
          <select
            value={form.dateFormat}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, dateFormat: e.target.value } : prev))}
            className={inputClass}
          >
            {DATE_FORMAT_OPTIONS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </Section>

        <button
          type="submit"
          disabled={saving || uploading}
          className="flex w-fit items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {saving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
          Save Settings
        </button>
      </form>
    </div>
  );
}
