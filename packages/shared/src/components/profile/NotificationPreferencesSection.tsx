import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listMyNotificationPreferences, updateMyNotificationPreference } from "../../services/profileService";
import { NOTIFICATION_GROUP_META, notificationGroupsForRole, type NotificationPreferenceGroup } from "../../types/profile";
import type { UserRole } from "../../types/auth";

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

interface NotificationPreferencesSectionProps {
  role: UserRole;
}

export default function NotificationPreferencesSection({ role }: NotificationPreferencesSectionProps) {
  const groups = notificationGroupsForRole(role);
  const [preferences, setPreferences] = useState<Record<NotificationPreferenceGroup, boolean>>({} as Record<NotificationPreferenceGroup, boolean>);
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState<NotificationPreferenceGroup | null>(null);

  useEffect(() => {
    listMyNotificationPreferences()
      .then(setPreferences)
      .catch((err) => console.error("[NotificationPreferencesSection] failed to load preferences:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (group: NotificationPreferenceGroup) => {
    const next = !(preferences[group] ?? true);
    setPreferences((prev) => ({ ...prev, [group]: next }));
    setSavingGroup(group);
    try {
      await updateMyNotificationPreference(group, next);
    } catch (err) {
      console.error("[NotificationPreferencesSection] failed to save preference:", err);
      setPreferences((prev) => ({ ...prev, [group]: !next }));
    } finally {
      setSavingGroup(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Notification Preferences</h2>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading…
          </div>
        ) : (
          groups.map((group) => {
            const meta = NOTIFICATION_GROUP_META[group];
            const Icon = meta.icon;
            return (
              <div key={group} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-[var(--color-foreground)]">
                  <Icon size={15} className="text-[var(--color-muted)]" />
                  {meta.label}
                </div>
                <ToggleSwitch
                  checked={preferences[group] ?? true}
                  onClick={() => void handleToggle(group)}
                  disabled={savingGroup === group}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
