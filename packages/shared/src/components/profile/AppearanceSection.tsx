import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { getMyPreferences, updateMyPreferences } from "../../services/profileService";
import type { ThemePreference } from "../../types/profile";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System Default", icon: Monitor },
];

export default function AppearanceSection() {
  const { themePreference, setThemePreference } = useTheme();
  const [saving, setSaving] = useState<ThemePreference | null>(null);
  // DB is the cross-device source of truth once signed in — reconcile once on mount, then every change writes to both.
  const reconciled = useRef(false);

  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    getMyPreferences()
      .then((prefs) => {
        if (prefs) setThemePreference(prefs.theme);
      })
      .catch((err) => console.error("[AppearanceSection] failed to load preferences:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (preference: ThemePreference) => {
    setThemePreference(preference);
    setSaving(preference);
    try {
      await updateMyPreferences({ theme: preference });
    } catch (err) {
      console.error("[AppearanceSection] failed to save preference:", err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Appearance</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">Theme</p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = themePreference === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => void handleSelect(value)}
              className={[
                "flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <Icon size={15} />
                {label}
              </span>
              {saving === value ? <Loader2 size={14} className="spinner" /> : active ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
