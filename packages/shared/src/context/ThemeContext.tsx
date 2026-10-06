import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSystemSettings } from "./SystemSettingsContext";
import type { ThemePreference } from "../types/profile";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  /** The user's own 3-way choice — distinct from `theme`, which is always the resolved light/dark value ("system" resolves via matchMedia). */
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

const THEME_KEY = "ph_theme";
const THEME_PREFERENCE_KEY = "ph_theme_preference";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference === "light" || preference === "dark") return preference;
  return prefersDark() ? "dark" : "light";
}

/** Falls back to the pre-3-way-toggle localStorage key so an existing explicit light/dark choice isn't silently reset to "system". */
function getInitialThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  const legacy = localStorage.getItem(THEME_KEY);
  if (legacy === "light" || legacy === "dark") return legacy;
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSystemSettings();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getInitialThemePreference);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(getInitialThemePreference()));
  // Captured once at mount, before the persist-effects below ever write to localStorage.
  const hasStoredPreference = useRef(localStorage.getItem(THEME_PREFERENCE_KEY) !== null || localStorage.getItem(THEME_KEY) !== null);
  const appliedSystemDefault = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    setTheme(resolveTheme(themePreference));
  }, [themePreference]);

  // Live-updates while the preference is "system" and the OS theme changes mid-session.
  useEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [themePreference]);

  // System default arrives async from Supabase, so it can't be part of the synchronous
  // initial state — it's applied here, once, and only for users with no personal
  // preference stored yet. Anyone who already picked light/dark/system is never overridden.
  useEffect(() => {
    if (!settings || hasStoredPreference.current || appliedSystemDefault.current) return;
    appliedSystemDefault.current = true;
    setThemePreferenceState(settings.defaultTheme);
  }, [settings]);

  const toggleTheme = useCallback(() => {
    hasStoredPreference.current = true;
    setThemePreferenceState((current) => (resolveTheme(current) === "dark" ? "light" : "dark"));
  }, []);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    hasStoredPreference.current = true;
    setThemePreferenceState(preference);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
