import { useEffect, useState } from "react";
import { AlertCircle, Info, Loader2, Save } from "lucide-react";
import {
  getSmtpSettings,
  listNotificationEventSettings,
  listNotificationTemplates,
  updateNotificationEventSetting,
  updateNotificationTemplate,
  updateSmtpSettings,
} from "@poultryhub/shared/services/emailSettingsService";
import { NOTIFICATION_CATEGORY_META } from "@poultryhub/shared/types/notification";
import type { NotificationCategory } from "@poultryhub/shared/types/notification";
import { AUTO_NOTIFICATION_CATEGORIES, MANUAL_NOTIFICATION_CATEGORIES } from "@poultryhub/shared/types/emailSettings";
import type { SmtpSettings, SmtpSettingsInput } from "@poultryhub/shared/types/emailSettings";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";
const textareaClass = `${inputClass} min-h-20 resize-y`;

/** Example wording paraphrased from the real notify_* trigger functions in schema.sql — display only, not editable here. */
const AUTO_NOTIFICATION_EXAMPLES: Record<NotificationCategory, string> = {
  new_user_registration: '"{name} ({role}) just signed up."',
  new_staff_account: '"{name} was added to your farm."',
  mortality_alert: '"{farm} has lost {count} birds in the last 7 days (over 5% of its stock)."',
  low_inventory: '"{farm}\'s {bird type} stock is down to {count}."',
  low_egg_production: '"{farm} collected {count} eggs on {date}, well below its recent daily average."',
  low_feed_stock: '"{farm}\'s {feed name} stock is down to {amount} {unit}."',
  low_vitamin_stock: '"{farm}\'s {vitamin name} stock is down to {amount} {unit}."',
  expiring_medicine: '"{vitamin name} ({farm}) expires/expired on {date}."',
  system_update: "",
  security_alert: "",
  backup_completion: "",
  failed_login_attempt: "",
  feed_schedule_reminder: "",
  vaccination_reminder: "",
  production_reminder: "",
  task_assignment: "",
  disease_outbreak: "",
  mortality_threshold_exceeded: "",
  health_case_submitted: "",
  mortality_case_submitted: "",
};

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onClick, disabled }: { checked: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function SmtpForm({ settings }: { settings: SmtpSettings }) {
  const [form, setForm] = useState<SmtpSettingsInput>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateSmtpSettings(form);
      setSaved(true);
    } catch (err) {
      console.error("[EmailConfigurationPage] SMTP save failed:", err);
      setError("Couldn't save SMTP settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="SMTP"
      description="Reference details only — this app has no backend and can never safely hold SMTP credentials in browser code, so it can't send mail itself. To actually enable outbound email, configure real SMTP transport in your Supabase project: Authentication → Emails → SMTP Settings. What's saved here is just for your team's own record."
    >
      <div className="flex items-start gap-2 rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-xs text-[var(--color-primary)]">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>No password field exists here on purpose — a credential nothing can use is pure risk with no benefit.</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
        {saved && <p className="rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-primary)]">Saved.</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            Host
            <input
              type="text"
              value={form.host ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value || null }))}
              className={inputClass}
              placeholder="smtp.example.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            Port
            <input
              type="number"
              value={form.port ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value ? Number(e.target.value) : null }))}
              className={inputClass}
              placeholder="587"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            Username
            <input
              type="text"
              value={form.username ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value || null }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            Encryption
            <select
              value={form.encryption}
              onChange={(e) => setForm((prev) => ({ ...prev, encryption: e.target.value as SmtpSettingsInput["encryption"] }))}
              className={inputClass}
            >
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            From name
            <input
              type="text"
              value={form.fromName}
              onChange={(e) => setForm((prev) => ({ ...prev, fromName: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)]">
            From email
            <input
              type="email"
              value={form.fromEmail ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, fromEmail: e.target.value || null }))}
              className={inputClass}
              placeholder="noreply@example.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted)] sm:col-span-2">
            Reply-to
            <input
              type="email"
              value={form.replyTo ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, replyTo: e.target.value || null }))}
              className={inputClass}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-fit items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {saving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
          Save SMTP Settings
        </button>
      </form>
    </Section>
  );
}

function NotificationsSection({ toggles }: { toggles: Record<NotificationCategory, boolean> }) {
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);
  const [localToggles, setLocalToggles] = useState(toggles);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (category: NotificationCategory) => {
    const next = !localToggles[category];
    setSavingCategory(category);
    setError(null);
    setLocalToggles((prev) => ({ ...prev, [category]: next }));
    try {
      await updateNotificationEventSetting(category, next);
    } catch (err) {
      console.error("[EmailConfigurationPage] notification toggle failed:", err);
      setLocalToggles((prev) => ({ ...prev, [category]: !next }));
      setError("Couldn't save that change. Please try again.");
    } finally {
      setSavingCategory(null);
    }
  };

  return (
    <Section
      title="Notifications"
      description="Turn any of these off to stop that automatic in-app notification platform-wide. Each is backed by a real Postgres trigger — the toggle actually gates whether it inserts."
    >
      {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      {AUTO_NOTIFICATION_CATEGORIES.map((category) => {
        const meta = NOTIFICATION_CATEGORY_META[category];
        const Icon = meta.icon;
        return (
          <div key={category} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <Icon size={16} className="text-[var(--color-muted)]" />
              <span className="text-sm text-[var(--color-foreground)]">{meta.label}</span>
            </div>
            {savingCategory === category ? (
              <Loader2 size={16} className="spinner text-[var(--color-muted)]" />
            ) : (
              <ToggleSwitch checked={localToggles[category]} onClick={() => void handleToggle(category)} />
            )}
          </div>
        );
      })}
    </Section>
  );
}

function TemplateRow({
  category,
  title,
  message,
  onSaved,
}: {
  category: NotificationCategory;
  title: string;
  message: string;
  onSaved: (title: string, message: string) => void;
}) {
  const [form, setForm] = useState({ title, message });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const meta = NOTIFICATION_CATEGORY_META[category];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateNotificationTemplate({ category, title: form.title, message: form.message });
      onSaved(form.title, form.message);
      setSaved(true);
    } catch (err) {
      console.error("[EmailConfigurationPage] template save failed:", err);
      setError("Couldn't save this template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-2.5">
        <meta.icon size={16} className="text-[var(--color-muted)]" />
        <span className="text-sm font-medium text-[var(--color-foreground)]">{meta.label}</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Default title"
          className={inputClass}
        />
        <textarea
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          placeholder="Default message"
          className={textareaClass}
        />
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex w-fit items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-70"
          >
            {saving ? <Loader2 size={12} className="spinner" /> : <Save size={12} />}
            Save
          </button>
          {saved && <span className="text-xs text-[var(--color-primary)]">Saved.</span>}
        </div>
      </div>
    </div>
  );
}

export default function EmailConfigurationPage() {
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [toggles, setToggles] = useState<Record<NotificationCategory, boolean> | null>(null);
  const [templates, setTemplates] = useState<Record<NotificationCategory, { title: string; message: string }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSmtpSettings(), listNotificationEventSettings(), listNotificationTemplates()])
      .then(([smtpRow, toggleRows, templateRows]) => {
        if (cancelled) return;
        setSmtp(smtpRow);
        const toggleMap = {} as Record<NotificationCategory, boolean>;
        for (const t of toggleRows) toggleMap[t.category] = t.enabled;
        setToggles(toggleMap);
        const templateMap = {} as Record<NotificationCategory, { title: string; message: string }>;
        for (const t of templateRows) templateMap[t.category] = { title: t.title, message: t.message };
        setTemplates(templateMap);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load email configuration.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Email Configuration</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          SMTP reference details, automatic notification toggles, and default message templates.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading email configuration…
        </div>
      ) : loadError || !smtp || !toggles || !templates ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError ?? "Couldn't load email configuration."}</p>
        </div>
      ) : (
        <>
          <SmtpForm settings={smtp} />

          <NotificationsSection toggles={toggles} />

          <Section
            title="Templates"
            description="Default title/message for the categories a Farm Admin or Manager composes by hand. Picking one of these in the Send Notification composer pre-fills it below — still freely editable before sending."
          >
            {MANUAL_NOTIFICATION_CATEGORIES.map((category) => (
              <TemplateRow
                key={category}
                category={category}
                title={templates[category]?.title ?? ""}
                message={templates[category]?.message ?? ""}
                onSaved={(title, message) =>
                  setTemplates((prev) => (prev ? { ...prev, [category]: { title, message } } : prev))
                }
              />
            ))}
          </Section>

          <Section
            title="System-generated notifications"
            description="Fixed in code — not editable here. Changing these means rewriting the trigger functions that already generate them across Feeds & Vitamins, Egg Production, Inventory, and Users."
          >
            {AUTO_NOTIFICATION_CATEGORIES.map((category) => {
              const meta = NOTIFICATION_CATEGORY_META[category];
              return (
                <div key={category} className="flex items-start gap-2.5 border-b border-[var(--color-border)] pb-2.5 last:border-0 last:pb-0">
                  <meta.icon size={15} className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{meta.label}</p>
                    <p className="text-xs text-[var(--color-muted)]">{AUTO_NOTIFICATION_EXAMPLES[category]}</p>
                  </div>
                </div>
              );
            })}
          </Section>
        </>
      )}
    </div>
  );
}
