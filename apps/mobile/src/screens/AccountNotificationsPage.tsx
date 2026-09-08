import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import NotificationPreferencesSection from "@poultryhub/shared/components/profile/NotificationPreferencesSection";
import { getMyPreferences, updateMyPreferences } from "@poultryhub/shared/services/profileService";
import AccountScreenHeader from "../components/AccountScreenHeader";
import { getNotificationStatus, openNotificationSettings, requestNotificationPermission } from "../lib/permissions";

const EGG_REMINDER_NOTIFICATION_ID = 1001;
const REMINDER_HOUR = 8;

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

/** The only place in the app that calls requestNotificationPermission() — enabling this toggle is the explicit user action that justifies asking. */
function RemindersSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    getMyPreferences()
      .then((prefs) => setEnabled(prefs?.eggReminderEnabled ?? false))
      .catch((err) => console.error("[RemindersSection] failed to load preference:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setPermissionError(null);

    if (next) {
      const current = await getNotificationStatus();
      const status = current === "granted" ? current : await requestNotificationPermission();
      if (status !== "granted") {
        setPermissionError("Notifications are off for PoultryHub.");
        return;
      }
    }

    setSaving(true);
    try {
      if (next) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: EGG_REMINDER_NOTIFICATION_ID,
              title: "Egg collection reminder",
              body: "Don't forget to log today's egg production.",
              schedule: { on: { hour: REMINDER_HOUR, minute: 0 }, allowWhileIdle: true },
              // Exact scheduling triggers a separate Android "Alarms & reminders" special-access
              // prompt — not needed for a reminder that doesn't require to-the-minute precision.
              isExactNotification: false,
            },
          ],
        });
      } else {
        await LocalNotifications.cancel({ notifications: [{ id: EGG_REMINDER_NOTIFICATION_ID }] });
      }
      await updateMyPreferences({ eggReminderEnabled: next });
      setEnabled(next);
    } catch (err) {
      console.error("[RemindersSection] failed to update reminder:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reminders</h2>

      {loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-2 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-[var(--color-foreground)]">
            <Bell size={15} className="text-[var(--color-muted)]" />
            Daily egg collection reminder
          </div>
          <ToggleSwitch checked={enabled} onClick={() => void handleToggle()} disabled={saving} />
        </div>
      )}

      {permissionError && (
        <div className="mt-3 flex flex-col items-start gap-1 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          <p>{permissionError}</p>
          <button type="button" onClick={() => void openNotificationSettings()} className="font-semibold underline underline-offset-2">
            Open Notification Settings
          </button>
        </div>
      )}
    </div>
  );
}

export default function AccountNotificationsPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <AccountScreenHeader title="Notifications" subtitle="Choose which alerts you want to receive." />

      <RemindersSection />
      <NotificationPreferencesSection role={user.role} />
    </div>
  );
}
