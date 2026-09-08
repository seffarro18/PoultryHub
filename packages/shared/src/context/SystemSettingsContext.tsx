import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSystemSettings } from "../services/systemSettingsService";
import type { SystemSettings } from "../types/systemSettings";

interface SystemSettingsContextValue {
  settings: SystemSettings | null;
  /** Re-fetches the settings row — call after saving General Settings so the Sidebar/login logo and name update immediately. */
  refresh: () => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextValue | null>(null);

/** Wraps the whole app, outside AuthProvider — the login screen renders the configured name/logo before anyone signs in. */
export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSettings(await getSystemSettings());
    } catch (err) {
      console.error("[SystemSettingsProvider] failed to load system settings:", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SystemSettingsContext.Provider value={{ settings, refresh }}>{children}</SystemSettingsContext.Provider>;
}

export function useSystemSettings(): SystemSettingsContextValue {
  const ctx = useContext(SystemSettingsContext);
  if (!ctx) throw new Error("useSystemSettings must be used within a SystemSettingsProvider");
  return ctx;
}
