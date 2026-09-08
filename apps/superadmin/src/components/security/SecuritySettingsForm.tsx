import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { updateSecuritySettings } from "@poultryhub/shared/services/securityService";
import type { SecuritySettings } from "@poultryhub/shared/types/security";

interface SecuritySettingsFormProps {
  settings: SecuritySettings;
  onSaved: (next: SecuritySettings) => void;
}

const checkboxClass = "h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]";
const numberInputClass =
  "w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function SecuritySettingsForm({ settings, onSaved }: SecuritySettingsFormProps) {
  const [form, setForm] = useState<SecuritySettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateSecuritySettings(form);
      onSaved(form);
    } catch (err) {
      console.error("[SecuritySettingsForm] save failed:", err);
      setError("Couldn't save these settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      <Section
        title="Password Policy"
        description="Enforced by this app's own sign-up and reset-password forms — an additional floor on top of Supabase's own project-level minimum, not a replacement for it."
      >
        <div className="flex items-center gap-3">
          <label htmlFor="min-length" className="text-sm text-[var(--color-foreground)]">
            Minimum length
          </label>
          <input
            id="min-length"
            type="number"
            min={6}
            value={form.minPasswordLength}
            onChange={(e) => setForm((prev) => ({ ...prev, minPasswordLength: Number(e.target.value) }))}
            className={numberInputClass}
          />
        </div>
        {(
          [
            ["requireUppercase", "Require an uppercase letter"],
            ["requireLowercase", "Require a lowercase letter"],
            ["requireNumber", "Require a number"],
            ["requireSymbol", "Require a symbol"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--color-foreground)]">
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
              className={checkboxClass}
            />
            {label}
          </label>
        ))}
      </Section>

      <Section
        title="Two-Factor Authentication"
        description="Optional — when enabled, users can set up 2FA from their Profile. Nobody is forced; this just makes it available."
      >
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--color-foreground)]">
          <input
            type="checkbox"
            checked={form.mfaEnabled}
            onChange={(e) => setForm((prev) => ({ ...prev, mfaEnabled: e.target.checked }))}
            className={checkboxClass}
          />
          Offer two-factor authentication to users
        </label>
      </Section>

      <Section
        title="Session Management"
        description="Idle timeout is enforced by this app's own client code — the same way any real single-page app does it. Every user can also end their own other sessions from their Profile page. Removing another specific user's live session isn't possible without a backend component this project doesn't have; the closest real tool for that today is deactivating their account on the Users page."
      >
        <div className="flex items-center gap-3">
          <label htmlFor="session-timeout" className="text-sm text-[var(--color-foreground)]">
            Idle timeout (minutes)
          </label>
          <input
            id="session-timeout"
            type="number"
            min={5}
            value={form.sessionTimeoutMinutes}
            onChange={(e) => setForm((prev) => ({ ...prev, sessionTimeoutMinutes: Number(e.target.value) }))}
            className={numberInputClass}
          />
        </div>
      </Section>

      <Section
        title="Account Lockout Policy"
        description="Blocks further sign-in attempts for an email after too many failures in a row. Enforced by this app's login form before it calls Supabase — kept lenient by default since the underlying failed-attempt log can be written to by anyone (see Failed Login Monitoring below)."
      >
        <div className="flex items-center gap-3">
          <label htmlFor="max-attempts" className="text-sm text-[var(--color-foreground)]">
            Max failed attempts
          </label>
          <input
            id="max-attempts"
            type="number"
            min={3}
            value={form.maxFailedAttempts}
            onChange={(e) => setForm((prev) => ({ ...prev, maxFailedAttempts: Number(e.target.value) }))}
            className={numberInputClass}
          />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="lockout-duration" className="text-sm text-[var(--color-foreground)]">
            Lockout duration (minutes)
          </label>
          <input
            id="lockout-duration"
            type="number"
            min={1}
            value={form.lockoutDurationMinutes}
            onChange={(e) => setForm((prev) => ({ ...prev, lockoutDurationMinutes: Number(e.target.value) }))}
            className={numberInputClass}
          />
        </div>
      </Section>

      <button
        type="submit"
        disabled={saving}
        className="flex w-fit items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
      >
        {saving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
        Save Settings
      </button>
    </form>
  );
}
